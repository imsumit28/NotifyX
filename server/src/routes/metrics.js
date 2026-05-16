const express = require('express');
const { redis } = require('../config/redis');
const { verifyJWT } = require('../middleware/auth');

const router = express.Router();

// GET /api/metrics — delivery statistics (queue/worker stats removed along with BullMQ)
router.get('/', verifyJWT, async (req, res, next) => {
  try {
    const [successStr, failedStr] = await Promise.all([
      redis.get('metrics:success'),
      redis.get('metrics:failed'),
    ]);

    const success = parseInt(successStr || '0');
    const failed  = parseInt(failedStr  || '0');
    const total   = success + failed;

    res.json({
      delivery: {
        total,
        success,
        failed,
        successRate: total > 0 ? ((success / total) * 100).toFixed(2) : '100.00',
        failureRate: total > 0 ? ((failed  / total) * 100).toFixed(2) : '0.00',
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
