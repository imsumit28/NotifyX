const express = require('express');
const crypto  = require('crypto');
const { ApiKey } = require('../models');

const router = express.Router();

const requireAdmin = (req, res, next) => {
  const secret = req.headers['x-admin-secret'];
  if (secret !== (process.env.ADMIN_SECRET || 'notifyx-demo')) {
    return res.status(401).json({ error: 'Invalid admin secret' });
  }
  next();
};

// POST /api/keys — generate a new API key (shown once only)
router.post('/', requireAdmin, async (req, res) => {
  const { appName } = req.body;
  if (!appName) return res.status(400).json({ error: 'appName is required' });

  const raw    = 'nx_' + crypto.randomBytes(32).toString('hex');
  const hash   = crypto.createHash('sha256').update(raw).digest('hex');
  const prefix = raw.slice(0, 12);

  await ApiKey.create({ keyHash: hash, prefix, appName });

  res.status(201).json({
    key:     raw,
    prefix,
    appName,
    note: 'Save this key — it will not be shown again',
  });
});

// GET /api/keys — list all keys (hashes never returned)
router.get('/', requireAdmin, async (_req, res) => {
  const keys = await ApiKey.find({}, '-keyHash').sort({ createdAt: -1 });
  res.json(keys);
});

// DELETE /api/keys/:id — revoke a key
router.delete('/:id', requireAdmin, async (req, res) => {
  await ApiKey.findByIdAndUpdate(req.params.id, { active: false });
  res.json({ revoked: true });
});

module.exports = router;
