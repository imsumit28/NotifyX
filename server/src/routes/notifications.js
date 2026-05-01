const express = require('express');
const { Notification } = require('../models');
const { redis } = require('../config/redis');
const { verifyJWT } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — paginated inbox for the authenticated user
router.get('/', verifyJWT, async (req, res, next) => {
  try {
    const recipientId = req.user.sub;
    const { status, limit = 20, page = 1 } = req.query;

    const query = { recipientId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [notifications, total, unread] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipientId, status: 'unread' }),
    ]);

    res.json({
      notifications,
      total,
      unread,
      page:    parseInt(page),
      hasMore: skip + notifications.length < total,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/notifications/unread-count — fast Redis-cached badge count
router.get('/unread-count', verifyJWT, async (req, res, next) => {
  try {
    const recipientId = req.user.sub;
    const cacheKey = `unread:${recipientId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json({ count: parseInt(cached) });

    const count = await Notification.countDocuments({ recipientId, status: 'unread' });
    await redis.set(cacheKey, count, 'EX', 30);
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/mark-all-read — bulk mark read
router.patch('/mark-all-read', verifyJWT, async (req, res, next) => {
  try {
    const recipientId = req.user.sub;
    const { modifiedCount } = await Notification.updateMany(
      { recipientId, status: 'unread' },
      { $set: { status: 'read', readAt: new Date() } }
    );
    await redis.del(`unread:${recipientId}`);
    res.json({ status: 'ok', updated: modifiedCount });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read — mark single notification read
router.patch('/:id/read', verifyJWT, async (req, res, next) => {
  try {
    const notif = await Notification.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'read', readAt: new Date() } },
      { new: true }
    );
    if (!notif) return res.status(404).json({ error: 'Not found' });
    await redis.del(`unread:${notif.recipientId}`);
    res.json(notif);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
