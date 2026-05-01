const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { createRedisClient } = require('../config/redis');
const { Notification } = require('../models');

// Dedicated subscriber connection — must not be shared with commands
const subscriber = createRedisClient('subscriber');

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST'] },
  });

  // Socket-level JWT authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
      socket.userId = decoded.sub;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId } = socket;
    console.log(`[Socket] Connected: ${userId}`);
    socket.join(userId);

    // Mark user as online with 30s TTL
    const { redis } = require('../config/redis');
    await redis.set(`online:${userId}`, '1', 'EX', 30);

    // Refresh presence every 20s while connected
    const heartbeat = setInterval(() => redis.set(`online:${userId}`, '1', 'EX', 30), 20000);

    // Offline sync — push notifications that arrived while disconnected
    try {
      const pending = await Notification.find({
        recipientId: userId,
        delivered:   false,
        status:      'unread',
      }).lean();

      if (pending.length > 0) {
        await Notification.updateMany(
          { recipientId: userId, delivered: false },
          { $set: { delivered: true } }
        );
        for (const notif of pending) {
          socket.emit('notification', notif);
        }
        console.log(`[Socket] Synced ${pending.length} offline notifications to ${userId}`);
      }
    } catch (err) {
      console.error(`[Socket] Offline sync error: ${err.message}`);
    }

    socket.on('disconnect', async () => {
      clearInterval(heartbeat);
      await redis.del(`online:${userId}`);
      console.log(`[Socket] Disconnected: ${userId}`);
    });
  });

  // Subscribe to all user channels from Redis Pub/Sub
  subscriber.connect().then(() => {
    subscriber.psubscribe('user:*', (err) => {
      if (err) console.error(`[PubSub] Subscribe error: ${err.message}`);
      else     console.log('[PubSub] Subscribed to user:* channels');
    });

    subscriber.on('pmessage', (_pattern, channel, message) => {
      const userId = channel.replace('user:', '');
      try {
        io.to(userId).emit('notification', JSON.parse(message));
      } catch (err) {
        console.error(`[PubSub] Parse error: ${err.message}`);
      }
    });
  });

  return io;
};

module.exports = { initSocket };
