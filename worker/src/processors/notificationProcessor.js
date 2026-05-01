const { Queue }   = require('bullmq');
const { Notification, User } = require('../models');
const { redis, createRedisClient, parseRedisUrl } = require('../config/redis');
const { DEFAULT_PREFERENCES, CHANNEL_PREFIX, QUEUE_NAME, BATCH_TYPES, BATCH_WINDOW_S, BATCH_THRESHOLD } = require('../../../shared/constants');

// Lazy Queue used only for adding delayed batch-flush jobs from within the worker process
let _batchQueue;
const batchQueue = () => {
  if (!_batchQueue) _batchQueue = new Queue(QUEUE_NAME, { connection: parseRedisUrl(process.env.REDIS_URL) });
  return _batchQueue;
};

// Publisher uses a dedicated connection — Pub/Sub requires isolation
let _publisher;
const publisher = () => {
  if (!_publisher) {
    _publisher = createRedisClient('publisher');
    _publisher.connect().catch(console.error);
  }
  return _publisher;
};

const getUserPreferences = async (userId) => {
  const key = `prefs:${userId}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const user = await User.findOne({ userId }).select('preferences').lean();
  const prefs = user?.preferences || DEFAULT_PREFERENCES;
  await redis.set(key, JSON.stringify(prefs), 'EX', 300);
  return prefs;
};

const inQuietHours = (quietHours) => {
  if (!quietHours?.enabled) return false;
  const hour = new Date().getHours();
  const { startHour, endHour } = quietHours;
  return startHour > endHour
    ? hour >= startHour || hour < endHour
    : hour >= startHour && hour < endHour;
};

// ─── Batching ─────────────────────────────────────────────────────────────────
const enqueueBatch = async (job) => {
  const { recipientId, type } = job.data;
  const batchKey = `batch:${recipientId}:${type}`;

  const count = await redis.lpush(batchKey, JSON.stringify(job.data));

  if (count === 1) {
    // First item in this window — set expiry and schedule a flush
    await redis.expire(batchKey, BATCH_WINDOW_S + 10);
    await batchQueue().add('batch-flush', { recipientId, type, batchKey }, { delay: BATCH_WINDOW_S * 1000 });
    console.log(`[Worker] Batch started: ${batchKey} — flush in ${BATCH_WINDOW_S}s`);
  } else if (count >= BATCH_THRESHOLD) {
    // Threshold hit — flush immediately (delayed flush will find an empty list and no-op)
    await batchQueue().add('batch-flush', { recipientId, type, batchKey });
    console.log(`[Worker] Batch threshold reached: ${batchKey} (${count}) — flushing now`);
  }

  return { batched: true, count, recipientId, type };
};

// ─── Main processor ───────────────────────────────────────────────────────────
const processNotification = async (job) => {
  const { recipientId, senderId, type, payload, idempotencyKey } = job.data;

  // Route high-volume types through the 30-second batch window
  if (BATCH_TYPES.includes(type)) return enqueueBatch(job);

  // Layer 2 idempotency — catch duplicates that slipped past the API gate
  const exists = await Notification.findOne({ idempotencyKey }).lean();
  if (exists) {
    console.log(`[Worker] Duplicate detected: ${idempotencyKey}`);
    return { skipped: 'duplicate' };
  }

  // Preference checks
  const prefs = await getUserPreferences(recipientId);
  if (!prefs.inApp) {
    console.log(`[Worker] ${recipientId} disabled inApp — skipping`);
    return { skipped: 'inApp disabled' };
  }
  if (prefs.mutedTypes?.includes(type)) {
    console.log(`[Worker] ${recipientId} muted type "${type}" — skipping`);
    return { skipped: 'muted type' };
  }
  if (inQuietHours(prefs.quietHours)) {
    console.log(`[Worker] Quiet hours active for ${recipientId} — skipping`);
    return { skipped: 'quiet hours' };
  }

  // Check online presence
  const isOnline = Boolean(await redis.exists(`online:${recipientId}`));

  // Persist notification
  const notif = await Notification.create({
    recipientId, senderId, type, payload, idempotencyKey,
    delivered: isOnline,
  });

  // Update metrics + invalidate unread cache
  await Promise.all([
    redis.incr('metrics:success'),
    redis.del(`unread:${recipientId}`),
  ]);

  // Deliver via Pub/Sub only when user is online (socket server handles offline sync)
  if (isOnline) {
    await publisher().publish(`${CHANNEL_PREFIX}${recipientId}`, JSON.stringify(notif));
    console.log(`[Worker] Delivered live → ${recipientId} (job ${job.id})`);
  } else {
    console.log(`[Worker] Stored for offline sync → ${recipientId} (job ${job.id})`);
  }

  return { notifId: notif._id.toString(), delivered: isOnline };
};

module.exports = { processNotification };
