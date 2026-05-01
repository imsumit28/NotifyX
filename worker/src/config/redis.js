const Redis = require('ioredis');

const parseRedisUrl = (url) => {
  if (!url) return { host: 'localhost', port: 6379 };
  const u = new URL(url);
  return {
    host:     u.hostname,
    port:     parseInt(u.port || '6379'),
    password: u.password || undefined,
    tls:      u.protocol === 'rediss:' ? {} : undefined,
  };
};

const createRedisClient = (name = 'worker') => {
  const opts = { ...parseRedisUrl(process.env.REDIS_URL), maxRetriesPerRequest: null, enableReadyCheck: false, lazyConnect: true };
  const client = new Redis(opts);
  client.on('connect', () => console.log(`[Redis:${name}] Connected`));
  client.on('error',   (err) => console.error(`[Redis:${name}] Error: ${err.message}`));
  return client;
};

const redis = createRedisClient();
module.exports = { redis, createRedisClient, parseRedisUrl };
