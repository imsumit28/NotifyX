require('dotenv').config();

const express = require('express');
const http    = require('http');
const cors    = require('cors');

const { connectDB }   = require('./config/db');
const { redis }       = require('./config/redis');
const { initSocket }  = require('./socket/socketServer');

const app    = express();
const server = http.createServer(app);

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/keys',          require('./routes/apikeys'));
app.use('/api/notify',        require('./routes/notify'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/users',         require('./routes/preferences'));
app.use('/api/metrics',       require('./routes/metrics'));

// Health check — DB only. Do not call redis.ping() here: readiness probes
// would burn Upstash commands on every poll.
app.get('/health', async (_req, res) => {
  const mongoose = require('mongoose');
  const dbReady = mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({ status: dbReady ? 'ok' : 'degraded', uptime: process.uptime() });
});

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status === 500) console.error('[Error]', err);
  res.status(status).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

const start = async () => {
  await connectDB();
  await redis.connect();
  initSocket(server);
  server.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
};

start().catch((err) => {
  console.error('[Server] Startup failed:', err);
  process.exit(1);
});
