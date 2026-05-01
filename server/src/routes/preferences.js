const express = require('express');
const { User } = require('../models');
const { redis } = require('../config/redis');
const { verifyJWT } = require('../middleware/auth');
const { DEFAULT_PREFERENCES } = require('../../../shared/constants');

const router = express.Router();

// GET /api/users/preferences
router.get('/preferences', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    let user = await User.findOne({ userId }).lean();
    if (!user) {
      user = await User.create({ userId, preferences: DEFAULT_PREFERENCES });
    }
    res.json(user.preferences);
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/preferences
router.put('/preferences', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const user = await User.findOneAndUpdate(
      { userId },
      { $set: { preferences: req.body, updatedAt: new Date() } },
      { new: true, upsert: true }
    );
    // Invalidate worker's preference cache
    await redis.del(`prefs:${userId}`);
    res.json(user.preferences);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
