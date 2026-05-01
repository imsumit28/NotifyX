require('dotenv').config();

const { Worker, Queue } = require('bullmq');
const { connectDB }            = require('./config/db');
const { redis, parseRedisUrl } = require('./config/redis');
const { processNotification }  = require('./processors/notificationProcessor');
const { batchFlush }           = require('./processors/batchFlusher');
const { QUEUE_NAME, DLQ_NAME } = require('../../shared/constants');

const WORKER_ID   = process.env.WORKER_ID || 'worker-1';
const connection  = parseRedisUrl(process.env.REDIS_URL);
const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5');

let dlqQueue;

// Route jobs by name: 'batch-flush' goes to batchFlusher, everything else to processNotification
const processor = async (job) => {
  if (job.name === 'batch-flush') return batchFlush(job);
  return processNotification(job);
};

const start = async () => {
  await connectDB();
  await redis.connect();

  // Register this worker in Redis — other services can discover active workers
  const workerKey = `worker:${WORKER_ID}:alive`;
  await redis.set(workerKey, '1', 'EX', 60);
  const heartbeat = setInterval(() => redis.set(workerKey, '1', 'EX', 60), 30_000);

  dlqQueue = new Queue(DLQ_NAME, { connection });

  const worker = new Worker(QUEUE_NAME, processor, { connection, concurrency });

  worker.on('completed', (job, result) => {
    const note = result?.skipped ? `(${result.skipped})` : result?.batched ? `(batched ×${result.count})` : '';
    console.log(`[${WORKER_ID}] ✓ Job ${job.id} completed ${note}`);
  });

  worker.on('failed', async (job, err) => {
    const attempts    = job.attemptsMade;
    const maxAttempts = job.opts?.attempts ?? 5;
    console.error(`[${WORKER_ID}] ✗ Job ${job.id} failed (attempt ${attempts}/${maxAttempts}): ${err.message}`);

    await redis.incr('metrics:failed');

    if (attempts >= maxAttempts) {
      console.log(`[${WORKER_ID}] Moving ${job.id} to DLQ`);
      await dlqQueue.add('dlq', {
        ...job.data,
        _originalJobId: job.id,
        _failedReason:  err.message,
        _failedAt:      new Date().toISOString(),
      });
    }
  });

  worker.on('error', (err) => console.error(`[${WORKER_ID}] Error:`, err.message));

  console.log(`[${WORKER_ID}] Started — queue: ${QUEUE_NAME} · concurrency: ${concurrency}`);

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`[${WORKER_ID}] ${signal} received — shutting down gracefully`);
    clearInterval(heartbeat);
    await redis.del(workerKey);
    await worker.close();
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
};

start().catch((err) => {
  console.error(`[${WORKER_ID}] Startup failed:`, err);
  process.exit(1);
});
