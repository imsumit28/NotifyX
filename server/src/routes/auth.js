const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../models');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const issueToken = (userId) => jwt.sign(
  { sub: userId },
  JWT_SECRET,
  { expiresIn: '7d' }
);

// POST /api/auth/signup — register new user
router.post('/signup', async (req, res, next) => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ error: 'userId and password are required' });
    }

    if (userId.length < 3 || userId.length > 30) {
      return res.status(400).json({ error: 'userId must be 3-30 characters' });
    }

    if (!/^[a-z0-9_]+$/i.test(userId)) {
      return res.status(400).json({ error: 'userId must be alphanumeric or underscore' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await User.findOne({ userId });
    if (existing && existing.passwordHash) {
      return res.status(409).json({ error: 'User ID already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    if (existing) {
      existing.passwordHash = passwordHash;
      await existing.save();
    } else {
      await User.create({ userId, passwordHash });
    }

    const token = issueToken(userId);
    res.status(201).json({ token, userId, expiresIn: '7d' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login — user password authentication
router.post('/login', async (req, res, next) => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ error: 'userId and password are required' });
    }

    const user = await User.findOne({ userId });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = issueToken(userId);
    res.json({ token, userId, expiresIn: '7d' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/token — legacy admin secret (for programmatic use)
router.post('/token', (req, res) => {
  const { userId, secret } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const adminSecret = process.env.ADMIN_SECRET || 'notifyx-demo';
  if (secret !== adminSecret) {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  const token = issueToken(userId);
  res.json({ token, userId, expiresIn: '7d' });
});

module.exports = router;
