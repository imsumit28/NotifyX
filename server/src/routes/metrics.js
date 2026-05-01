const express = require('express');
const { redis } = require('../config/redis');
const { notificationQueue } = require('../queues/notificationQueue');
const { verifyJWT } = require('../middleware/auth');

const router = express.Router();

// Scan Redis for active worker heartbeat keys
const getActiveWorkers = async () => {
  const workers = [];
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', 'worker:*:alive', 'COUNT', 100);
    cursor = next;
    for (const k of keys) workers.push(k.replace(/^worker:/, '').replace(/:alive$/, ''));
  } while (cursor !== '0');
  return workers;
};

// GET /api/metrics — job and delivery statistics
router.get('/', verifyJWT, async (req, res, next) => {
  try {
    const [successStr, failedStr, counts, activeWorkers] = await Promise.all([
      redis.get('metrics:success'),
      redis.get('metrics:failed'),
      notificationQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
      getActiveWorkers(),
    ]);

    const success = parseInt(successStr || '0');
    const failed  = parseInt(failedStr  || '0');
    const total   = success + failed;

    res.json({
      jobs: {
        waiting:   counts.waiting,
        active:    counts.active,
        completed: counts.completed,
        failed:    counts.failed,
        delayed:   counts.delayed,
      },
      delivery: {
        total,
        success,
        failed,
        successRate: total > 0 ? ((success / total) * 100).toFixed(2) : '100.00',
        failureRate: total > 0 ? ((failed  / total) * 100).toFixed(2) : '0.00',
      },
      workers: {
        active: activeWorkers,
        count:  activeWorkers.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
