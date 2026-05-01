const express = require('express');
const Joi = require('joi');
const { Queue } = require('bullmq');
const { notificationQueue, connection } = require('../queues/notificationQueue');
const { redis } = require('../config/redis');
const { verifyJWT } = require('../middleware/auth');
const { globalRateLimiter, perUserRateLimiter } = require('../middleware/rateLimiter');
const { DLQ_NAME } = require('../../../shared/constants');

const router = express.Router();

const schema = Joi.object({
  recipientId:    Joi.string().required(),
  senderId:       Joi.string().required(),
  type:           Joi.string().valid('like', 'comment', 'follow', 'mention').required(),
  payload:        Joi.object().default({}),
  idempotencyKey: Joi.string().required(),
  priority:       Joi.number().min(1).max(10).default(5),
});

// POST /api/notify — enqueue a notification
router.post('/', verifyJWT, globalRateLimiter, perUserRateLimiter, async (req, res, next) => {
  try {
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { recipientId, senderId, type, payload, idempotencyKey, priority } = value;

    // Layer 1 idempotency — reject duplicate at API boundary
    const set = await redis.set(`idem:${idempotencyKey}`, '1', 'EX', 86400, 'NX');
    if (!set) return res.status(409).json({ error: 'duplicate', message: 'Notification already queued' });

    const job = await notificationQueue.add('notify', { recipientId, senderId, type, payload, idempotencyKey }, { priority });
    res.status(202).json({ status: 'queued', jobId: job.id });
  } catch (err) {
    next(err);
  }
});

// Lazy-load DLQ queue
let _dlq;
const dlq = () => _dlq || (_dlq = new Queue(DLQ_NAME, { connection }));

// GET /api/notify/dlq — list dead-letter jobs
router.get('/dlq', verifyJWT, async (req, res, next) => {
  try {
    const jobs = await dlq().getJobs(['failed', 'waiting'], 0, 100);
    res.json({
      jobs: jobs.map(j => ({
        id:          j.id,
        data:        j.data,
        failedReason: j.failedReason,
        attemptsMade: j.attemptsMade,
        timestamp:   j.timestamp,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/notify/dlq/:jobId/retry — replay a dead-letter job
router.post('/dlq/:jobId/retry', verifyJWT, async (req, res, next) => {
  try {
    const job = await dlq().getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const newJob = await notificationQueue.add('notify', job.data);
    await job.remove();
    res.json({ status: 'requeued', newJobId: newJob.id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
