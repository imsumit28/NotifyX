const express = require('express');
const crypto  = require('crypto');
const { ApiKey } = require('../models');
const { verifyJWT } = require('../middleware/auth');

const router = express.Router();

// ─── Admin middleware (server owner only) ────────────────────────────────────
const requireAdmin = (req, res, next) => {
  const secret = req.headers['x-admin-secret'];
  if (secret !== (process.env.ADMIN_SECRET || 'notifyx-demo')) {
    return res.status(401).json({ error: 'Invalid admin secret' });
  }
  next();
};

// ─── Shared key generator ────────────────────────────────────────────────────
const generateKey = async (appName, ownerId = null) => {
  const raw    = 'nx_' + crypto.randomBytes(32).toString('hex');
  const hash   = crypto.createHash('sha256').update(raw).digest('hex');
  const prefix = raw.slice(0, 12);
  await ApiKey.create({ keyHash: hash, prefix, appName, ownerId });
  return { raw, prefix, appName };
};

// ════════════════════════════════════════════════════════════════════════════
//  SELF-SERVICE — any signed-up user can manage their own API keys
//  Auth: Bearer <JWT token> (from signup / login)
// ════════════════════════════════════════════════════════════════════════════

// POST /api/keys/self — create a key owned by the logged-in user
router.post('/self', verifyJWT, async (req, res, next) => {
  try {
    const ownerId = req.user.sub;
    const { appName } = req.body;
    if (!appName || !appName.trim()) {
      return res.status(400).json({ error: 'appName is required' });
    }

    // Limit: max 5 active keys per user
    const count = await ApiKey.countDocuments({ ownerId, active: true });
    if (count >= 5) {
      return res.status(429).json({ error: 'Maximum 5 active API keys per account. Revoke one first.' });
    }

    const { raw, prefix } = await generateKey(appName.trim(), ownerId);

    res.status(201).json({
      key:     raw,
      prefix,
      appName: appName.trim(),
      ownerId,
      note:    'Save this key — it will not be shown again',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/keys/self — list keys belonging to the logged-in user
router.get('/self', verifyJWT, async (req, res, next) => {
  try {
    const ownerId = req.user.sub;
    const keys = await ApiKey.find({ ownerId }, '-keyHash').sort({ createdAt: -1 });
    res.json(keys);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/keys/self/:id — revoke one of the logged-in user's own keys
router.delete('/self/:id', verifyJWT, async (req, res, next) => {
  try {
    const ownerId = req.user.sub;
    const key = await ApiKey.findOne({ _id: req.params.id, ownerId });
    if (!key) return res.status(404).json({ error: 'Key not found or not yours' });
    await ApiKey.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ revoked: true });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN ROUTES — require x-admin-secret header (server owner only)
// ════════════════════════════════════════════════════════════════════════════

// POST /api/keys — admin generates a key for any app (legacy / manual)
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { appName } = req.body;
    if (!appName) return res.status(400).json({ error: 'appName is required' });
    const { raw, prefix } = await generateKey(appName);
    res.status(201).json({ key: raw, prefix, appName, note: 'Save this key — it will not be shown again' });
  } catch (err) {
    next(err);
  }
});

// GET /api/keys — admin lists ALL keys across all users
router.get('/', requireAdmin, async (_req, res, next) => {
  try {
    const keys = await ApiKey.find({}, '-keyHash').sort({ createdAt: -1 });
    res.json(keys);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/keys/:id — admin revokes any key
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await ApiKey.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ revoked: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
