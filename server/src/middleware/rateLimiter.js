const { redis } = require('../config/redis');

const checkRateLimit = async (key, max, windowSecs) => {
  const window = Math.floor(Date.now() / (windowSecs * 1000));
  const rKey = `rl:${key}:${window}`;
  const count = await redis.incr(rKey);
  if (count === 1) await redis.expire(rKey, windowSecs);
  if (count > max) {
    const err = new Error(`Rate limit exceeded`);
    err.status = 429;
    throw err;
  }
};

const globalRateLimiter = async (req, res, next) => {
  try {
    await checkRateLimit('global', 10000, 60);
    next();
  } catch {
    res.status(429).json({ error: 'Global rate limit exceeded. Try again in a minute.' });
  }
};

const perUserRateLimiter = async (req, res, next) => {
  const userId = req.user?.sub || req.body?.senderId;
  if (!userId) return next();
  try {
    await checkRateLimit(`user:${userId}`, 50, 60);
    next();
  } catch {
    res.status(429).json({ error: 'Per-user rate limit exceeded (50/min).' });
  }
};

module.exports = { globalRateLimiter, perUserRateLimiter, checkRateLimit };
