const express = require('express');
const Joi = require('joi');
const { Notification, User } = require('../models');
const { redis } = require('../config/redis');
const { verifyJWT } = require('../middleware/auth');
const { globalRateLimiter, perUserRateLimiter } = require('../middleware/rateLimiter');
const { getIO, isOnline } = require('../socket/socketServer');
const { DEFAULT_PREFERENCES } = require('../../../shared/constants');

const router = express.Router();

const schema = Joi.object({
  recipientId:    Joi.string().required(),
  senderId:       Joi.string().required(),
  type:           Joi.string().valid('like', 'comment', 'follow', 'mention').required(),
  payload:        Joi.object().default({}),
  idempotencyKey: Joi.string().required(),
  priority:       Joi.number().min(1).max(10).default(5),
});

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

const dispatch = async (data) => {
  const { recipientId, senderId, type, payload, idempotencyKey } = data;

  const prefs = await getUserPreferences(recipientId);
  if (!prefs.inApp) return;
  if (prefs.mutedTypes?.includes(type)) return;
  if (inQuietHours(prefs.quietHours)) return;

  const online = isOnline(recipientId);

  let notif;
  try {
    notif = await Notification.create({
      recipientId, senderId, type, payload, idempotencyKey,
      delivered: online,
    });
  } catch (err) {
    // Duplicate idempotencyKey (Layer 2 via sparse unique index) — silently skip
    if (err.code === 11000) return;
    throw err;
  }

  // Best-effort metrics + unread-cache invalidation
  redis.incr('metrics:success').catch(() => {});
  redis.del(`unread:${recipientId}`).catch(() => {});

  if (online) {
    const io = getIO();
    if (io) io.to(recipientId).emit('notification', notif);
  }
};

// POST /api/notify — accept a notification, dispatch async via setImmediate
router.post('/', verifyJWT, globalRateLimiter, perUserRateLimiter, async (req, res, next) => {
  try {
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { idempotencyKey } = value;

    // Layer 1 idempotency — single Redis SET NX, cheap and high-value
    const set = await redis.set(`idem:${idempotencyKey}`, '1', 'EX', 86400, 'NX');
    if (!set) return res.status(409).json({ error: 'duplicate', message: 'Notification already queued' });

    res.status(202).json({ status: 'accepted' });

    setImmediate(() => {
      dispatch(value).catch((err) => {
        console.error('[Notify] dispatch failed:', err.message);
        redis.incr('metrics:failed').catch(() => {});
      });
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
