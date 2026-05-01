require('dotenv').config();

const express = require('express');
const http    = require('http');
const cors    = require('cors');

const { connectDB }   = require('./config/db');
const { redis }       = require('./config/redis');
const { initSocket }  = require('./socket/socketServer');
const { notificationQueue } = require('./queues/notificationQueue');

const { createBullBoard }  = require('@bull-board/api');
const { BullMQAdapter }    = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter }   = require('@bull-board/express');

const app    = express();
const server = http.createServer(app);

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Bull Board — visual queue monitor at /admin/queues
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({ queues: [new BullMQAdapter(notificationQueue)], serverAdapter });
app.use('/admin/queues', serverAdapter.getRouter());

// API routes
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/keys',          require('./routes/apikeys'));
app.use('/api/notify',        require('./routes/notify'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/users',         require('./routes/preferences'));
app.use('/api/metrics',       require('./routes/metrics'));

// Health check
app.get('/health', async (_req, res) => {
  const queue = await notificationQueue.getJobCounts().catch(() => ({}));
  res.json({ status: 'ok', uptime: process.uptime(), queue });
});

// Global error handler
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
    console.log(`[Server] Bull Board  → http://localhost:${PORT}/admin/queues`);
  });
};

start().catch((err) => {
  console.error('[Server] Startup failed:', err);
  process.exit(1);
});
