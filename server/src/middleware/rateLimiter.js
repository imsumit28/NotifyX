// In-memory fixed-window rate limiter. Replaces the previous Redis-backed
// version to avoid Upstash command charges on every request to high-volume
// endpoints. Trade-off: counters are per-instance, not shared across replicas.

const buckets = new Map();

// Periodic cleanup — drop windows that are at least one full window old.
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) {
    if (now - b.windowStart > b.windowMs * 2) buckets.delete(key);
  }
}, 60_000).unref();

const checkRateLimit = (key, max, windowSecs) => {
  const windowMs = windowSecs * 1000;
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.windowStart >= windowMs) {
    b = { windowStart: now, windowMs, count: 0 };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > max) {
    const err = new Error('Rate limit exceeded');
    err.status = 429;
    throw err;
  }
};

const globalRateLimiter = (req, res, next) => {
  try {
    checkRateLimit('global', 10000, 60);
    next();
  } catch {
    res.status(429).json({ error: 'Global rate limit exceeded. Try again in a minute.' });
  }
};

const perUserRateLimiter = (req, res, next) => {
  const userId = req.user?.sub || req.body?.senderId;
  if (!userId) return next();
  try {
    checkRateLimit(`user:${userId}`, 50, 60);
    next();
  } catch {
    res.status(429).json({ error: 'Per-user rate limit exceeded (50/min).' });
  }
};

module.exports = { globalRateLimiter, perUserRateLimiter, checkRateLimit };
