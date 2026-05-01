const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { ApiKey } = require('../models');

const verifyApiKey = async (req, res, next, raw) => {
  try {
    const hash   = crypto.createHash('sha256').update(raw).digest('hex');
    const apiKey = await ApiKey.findOne({ keyHash: hash, active: true });
    if (!apiKey) return res.status(401).json({ error: 'Invalid API key' });

    ApiKey.findByIdAndUpdate(apiKey._id, { lastUsedAt: new Date() }).exec();

    req.user = { sub: apiKey.appName, apiKey: true, keyId: String(apiKey._id) };
    next();
  } catch {
    res.status(500).json({ error: 'Auth error' });
  }
};

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization || '';

  if (authHeader.startsWith('ApiKey ')) {
    return verifyApiKey(req, res, next, authHeader.slice(7));
  }

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { verifyJWT };
