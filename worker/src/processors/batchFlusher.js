const { Notification } = require('../models');
const { redis, createRedisClient } = require('../config/redis');
const { CHANNEL_PREFIX } = require('../../../shared/constants');

let _publisher;
const publisher = () => {
  if (!_publisher) {
    _publisher = createRedisClient('batch-publisher');
    _publisher.connect().catch(console.error);
  }
  return _publisher;
};

// Atomically drain the Redis LIST and return all items
const drainList = async (batchKey) => {
  const raw = await redis.lrange(batchKey, 0, -1);
  if (raw.length === 0) return [];
  await redis.del(batchKey);
  return raw.map(item => JSON.parse(item));
};

const batchFlush = async (job) => {
  const { recipientId, type, batchKey } = job.data;

  const items = await drainList(batchKey);
  if (items.length === 0) {
    // Already flushed by a threshold-triggered job
    console.log(`[Worker] Batch flush skipped (already drained): ${batchKey}`);
    return { skipped: 'already drained' };
  }

  const count    = items.length;
  const senders  = [...new Set(items.map(i => i.senderId))];
  const typeLabel = type === 'like' ? 'liked' : type === 'follow' ? 'followed' : `${type}d`;
  const message  = count === 1
    ? `${senders[0]} ${typeLabel} your post`
    : `${senders[0]} and ${count - 1} other${count - 1 > 1 ? 's' : ''} ${typeLabel} your post`;

  // Use the idempotencyKey from the first item for the batched notification
  const idempotencyKey = `batch:${items[0].idempotencyKey}`;

  const notif = await Notification.create({
    recipientId,
    senderId:      senders[0],
    type,
    payload:       { message },
    idempotencyKey,
    batchCount:    count,
    delivered:     Boolean(await redis.exists(`online:${recipientId}`)),
  });

  await Promise.all([
    redis.incr('metrics:success'),
    redis.del(`unread:${recipientId}`),
  ]);

  if (notif.delivered) {
    await publisher().publish(`${CHANNEL_PREFIX}${recipientId}`, JSON.stringify(notif));
    console.log(`[Worker] Batch flushed + delivered: ${count} ${type}s → ${recipientId}`);
  } else {
    console.log(`[Worker] Batch flushed (offline): ${count} ${type}s → ${recipientId}`);
  }

  return { batchCount: count, notifId: notif._id.toString(), delivered: notif.delivered };
};

module.exports = { batchFlush };
