const { Queue } = require('bullmq');
const { parseRedisUrl } = require('../config/redis');
const { QUEUE_NAME } = require('../../../shared/constants');

const connection = parseRedisUrl(process.env.REDIS_URL);

const notificationQueue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: false,
  },
});

module.exports = { notificationQueue, connection };
