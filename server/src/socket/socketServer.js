const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { Notification } = require('../models');

let _io;
const getIO = () => _io;

const isOnline = (userId) => {
  if (!_io) return false;
  const room = _io.sockets.adapter.rooms.get(userId);
  return Boolean(room && room.size > 0);
};

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST'] },
  });
  _io = io;

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
        for (const notif of pending) socket.emit('notification', notif);
        console.log(`[Socket] Synced ${pending.length} offline notifications to ${userId}`);
      }
    } catch (err) {
      console.error(`[Socket] Offline sync error: ${err.message}`);
    }

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${userId}`);
    });
  });

  return io;
};

module.exports = { initSocket, getIO, isOnline };
