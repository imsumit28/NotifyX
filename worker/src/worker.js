// BullMQ worker removed.
//
// The standalone background worker was decommissioned to eliminate the
// continuous BZPOPMIN/EVALSHA/ZRANGE polling that BullMQ performs against
// Upstash Redis 24/7, which was burning the command quota with zero users
// and preventing Render's free tier from auto-sleeping the service.
//
// Notification processing now runs inline in the API server (server/src/routes/notify.js)
// via setImmediate + direct MongoDB inserts + direct Socket.io emit. No Redis
// queue, no Redis Pub/Sub bridge, no separate process.
//
// This file is kept only so that any leftover deploy config referencing
// `node src/worker.js` does not error out — it exits immediately.
console.log('[worker] BullMQ worker removed — exiting. See file header for context.');
process.exit(0);
