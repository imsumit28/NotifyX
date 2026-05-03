# NotifyX — Real-time Notification System

A production-grade distributed notification platform built with Node.js, Redis, BullMQ, MongoDB, and Socket.io. Designed as a portfolio-level backend demo showing real-world async patterns, fault tolerance, and real-time delivery.

> **summary:** Built and deployed a real-time notification microservice used by multiple integrations — REST API, BullMQ job queue with dead-letter handling, Socket.io delivery with offline sync, Redis pub/sub, and a self-service API key dashboard.

---

## Architecture

```
Your App (HTTP)
      │
      ▼
┌─────────────┐   BullMQ queue   ┌──────────────┐
│  API Server │ ───────────────► │    Worker    │
│  :3000      │                  │  (processor) │
└─────────────┘                  └──────────────┘
      │                                 │
      │ Redis Pub/Sub                   │ MongoDB save
      ▼                                 │ + Pub/Sub publish
┌─────────────┐                         │
│  Socket.io  │ ◄───────────────────────┘
│  (browser)  │
└─────────────┘
```

**Key design decisions:**
- Server and worker are completely separate npm packages — Redis is the only bridge
- Shared models live in `shared/models/` (factory pattern) so both processes use the same schema without duplicating code
- Redis Pub/Sub subscriber uses a dedicated connection (BullMQ requirement)
- JWT auth on all API routes + Socket.io handshake
- Two-layer idempotency: Redis SETNX at API boundary + MongoDB sparse unique index in worker
- Offline sync: worker stores `delivered: false`; socket server pushes pending on reconnect

---

## Stack

| Layer | Technology |
|-------|-----------|
| API server | Express.js |
| Real-time | Socket.io |
| Job queue | BullMQ |
| Queue store | Redis (Upstash) |
| Database | MongoDB (Atlas) |
| ODM | Mongoose |
| Auth | JWT (jsonwebtoken) |
| Validation | Joi |
| Queue UI | Bull Board |
| Frontend | React via CDN (no build step) |

---

## Project Structure

```
NotifyX/
├── shared/
│   ├── constants.js            # Queue names, channel prefix, defaults
│   └── models/
│       ├── Notification.js     # Factory fn — recipientId, type, payload, delivered
│       ├── User.js             # Factory fn — userId, preferences
│       └── ApiKey.js           # Factory fn — keyHash, prefix, appName
│
├── server/                     # npm package — API + Socket.io
│   └── src/
│       ├── app.js              # Entry point — DB, Redis, routes, Bull Board
│       ├── models.js           # Initializes shared models with server's mongoose
│       ├── config/
│       │   ├── db.js           # MongoDB connection
│       │   └── redis.js        # ioredis factory (handles rediss:// TLS)
│       ├── middleware/
│       │   ├── auth.js         # JWT + ApiKey middleware
│       │   └── rateLimiter.js  # Sliding window — 10K/min global, 50/min per user
│       ├── queues/
│       │   └── notificationQueue.js
│       ├── routes/
│       │   ├── auth.js         # POST /api/auth/signup, /login, /token
│       │   ├── notify.js       # POST /api/notify, DLQ endpoints
│       │   ├── notifications.js# GET/PATCH inbox + unread count
│       │   ├── preferences.js  # GET/PUT /api/users/preferences
│       │   ├── metrics.js      # GET /api/metrics (includes active workers)
│       │   └── apikeys.js      # POST/GET/DELETE /api/keys
│       └── socket/
│           └── socketServer.js # Auth middleware, rooms, offline sync, Pub/Sub
│
├── worker/                     # npm package — BullMQ consumer
│   └── src/
│       ├── worker.js           # BullMQ Worker, DLQ handler, failed event
│       ├── models.js           # Initializes shared models with worker's mongoose
│       ├── config/
│       │   ├── db.js
│       │   └── redis.js
│       └── processors/
│           └── notificationProcessor.js  # Core job logic
│
├── frontend/
│   ├── index.html              # Dashboard app shell
│   ├── landing.html            # Public demo + integration docs page
│   ├── styles.css              # Full design system
│   ├── icons.jsx               # SVG icon component
│   ├── charts.jsx              # Sparkline/bar chart components
│   ├── data.jsx                # API layer + mock data (window.NTFX_AUTH)
│   ├── screens.jsx             # Dashboard, Queue, Notifications, Settings, Metrics
│   └── app.jsx                 # App shell, routing, Socket.io init, login
│
├── render.yaml                 # Render.com deployment (API + worker)
├── .gitignore
└── README.md
```

---

## Features

- **User Authentication** — Per-user account signup + password-based login with bcrypt hashing
- **API Keys** — Per-app authentication for server-to-server integration (doesn't require user login)
- **Async Job Queue** — BullMQ with 5 retry attempts and exponential backoff (5s → 10s → 20s → 40s)
- **Dead Letter Queue** — Failed jobs moved to DLQ after max retries; replay endpoint available
- **Real-time Delivery** — Redis Pub/Sub → Socket.io → browser, sub-50ms latency
- **Offline Sync** — Notifications queued as `delivered: false`; pushed on next socket connection
- **Two-layer Idempotency** — Prevents duplicate notifications even across Redis restarts
- **Sliding Window Rate Limiting** — 10,000 req/min global + 50 req/min per user
- **Batch Notifications** — Automatic grouping of repeated actions (likes, follows) within 30s window
- **User Preferences** — inApp/email/push toggles, quiet hours, muted notification types
- **Cache-aside** — User preferences cached in Redis (5 min TTL)
- **Bull Board UI** — Visual queue monitor at `/admin/queues`
- **30-day TTL** — MongoDB TTL index auto-archives old notifications
- **Metrics Dashboard** — Real-time success/failure/queue counts with active worker tracking

---

## API Reference

### Auth — User Accounts

**Create Account (Sign up)**
```
POST /api/auth/signup
Body: {
  "userId": "user_alice",
  "password": "your_password_min_8_chars"
}
Response 201: { "token": "eyJ...", "userId": "user_alice", "expiresIn": "7d" }
Errors:
  - 400: "userId must be 3-30 characters"
  - 400: "userId must be alphanumeric or underscore"
  - 400: "Password must be at least 8 characters"
  - 409: "User ID already taken"
```

**Sign In**
```
POST /api/auth/login
Body: {
  "userId": "user_alice",
  "password": "your_password"
}
Response 200: { "token": "eyJ...", "userId": "user_alice", "expiresIn": "7d" }
Errors:
  - 401: "Invalid credentials"
```

**Legacy — Admin Secret (for programmatic use)**
```
POST /api/auth/token
Body: { "userId": "user_alice", "secret": "your_admin_secret" }
Response: { "token": "eyJ...", "userId": "user_alice" }
```

### Send Notification
```
POST /api/notify
Auth: Bearer <token>  OR  ApiKey nx_<key>
Header: Idempotency-Key: <unique-id>
Body: {
  "recipientId": "user_alice",
  "senderId": "my-app",
  "type": "like" | "comment" | "follow" | "mention",
  "payload": { "message": "..." }
}
Response 202: { "status": "queued", "jobId": "..." }
```

### Notifications Inbox
```
GET    /api/notifications               # paginated inbox
GET    /api/notifications/unread-count  # Redis-cached badge count
PATCH  /api/notifications/:id/read      # mark single read
PATCH  /api/notifications/mark-all-read # bulk mark read
```

### API Keys (admin)
```
POST   /api/keys           # generate key — Header: x-admin-secret
GET    /api/keys           # list keys (hashes never returned)
DELETE /api/keys/:id       # revoke key
```

### Preferences
```
GET /api/users/preferences
PUT /api/users/preferences
Body: { "inApp": true, "email": false, "quietHours": { "enabled": false } }
```

### Metrics & Health
```
GET /api/metrics   # success/failure/queue counts
GET /health        # uptime + queue counts
```

---

## Running Locally

**Prerequisites:** Node.js 18+, MongoDB, Redis (or use cloud — see below)

**1. Clone and install**
```bash
git clone https://github.com/YOUR_USERNAME/notifyx.git
cd notifyx

# Install shared dependencies (mongoose for shared models)
npm install

# Install server and worker deps
cd server && npm install
cd ../worker && npm install
```

**2. Configure environment**

`server/.env`:
```
PORT=3000
NODE_ENV=development
REDIS_URL=redis://localhost:6379         # or rediss://... for Upstash
MONGODB_URI=mongodb://localhost:27017/notifyx  # or mongodb+srv://... for Atlas
JWT_SECRET=your-secret-key-min-32-chars
ADMIN_SECRET=notifyx-demo                 # for legacy /api/auth/token endpoint
CORS_ORIGIN=http://localhost:8080
```

`worker/.env`:
```
REDIS_URL=redis://localhost:6379
MONGODB_URI=mongodb://localhost:27017/notifyx
WORKER_ID=worker-1                        # optional: worker name for monitoring
WORKER_CONCURRENCY=5
```

**3. Start services**
```bash
# Terminal 1 — API server
cd server && npm start

# Terminal 2 — Worker
cd worker && npm start

# Terminal 3 — Frontend
cd frontend && npx serve . -l 8080
```

**4. Open browser**
- Dashboard: `http://localhost:8080/dashboard.html`
- Landing page: `http://localhost:8080/` or `/index.html`
- Bull Board: `http://localhost:3000/admin/queues`

**Sign up** with any User ID and password (min 8 chars). You'll see the onboarding popup on first login showing how to use the system.

---

## Cloud Setup (Free)

| Service | Provider | Free tier |
|---------|----------|-----------|
| MongoDB | [Atlas](https://atlas.mongodb.com) | M0 — 512 MB |
| Redis | [Upstash](https://upstash.com) | 10K commands/day |
| API server | [Render.com](https://render.com) | 750 hrs/month |
| Worker | [Render.com](https://render.com) | Background worker |
| Frontend | [Vercel](https://vercel.com) | Unlimited static |

---

## Deployment

**Render (API + Worker)** — `render.yaml` is already configured:
1. Push to GitHub
2. Render → New → Blueprint → connect repo
3. Add env vars in Render dashboard (REDIS_URL, MONGODB_URI, JWT_SECRET, ADMIN_SECRET, CORS_ORIGIN)
4. Deploy

**Vercel (Frontend)**:
1. Vercel → Import → select repo → set root to `frontend/`
2. Update `window.NOTIFYX_API_URL` in `frontend/index.html` to your Render URL

---

## Integration Guide

### For Server-to-Server (API Keys)

**Step 1 — Create an API key**
```bash
curl -X POST https://YOUR_API_URL/api/keys \
  -H "x-admin-secret: your-admin-secret" \
  -H "Content-Type: application/json" \
  -d '{"appName": "my-blog"}'
# Returns: { "key": "nx_...", "note": "Save this — shown once only" }
```

**Step 2 — Send notifications from your backend**
```js
const API_KEY = process.env.NOTIFYX_API_KEY;

async function notifyUser(recipientId, senderId, type, message) {
  const response = await fetch('https://YOUR_API_URL/api/notify', {
    method: 'POST',
    headers: {
      'Authorization': `ApiKey ${API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      recipientId,              // who receives the notification
      senderId,                 // who triggered it (your app name)
      type: 'comment',          // 'like' | 'comment' | 'follow' | 'mention'
      payload: {                // custom data
        message,
        link: '/posts/123',
      },
      priority: 5,              // 1-10 (optional, default 5)
    }),
  });
  
  if (!response.ok) {
    const err = await response.json();
    console.error('Failed to queue:', err);
    return null;
  }
  
  const { jobId } = await response.json();
  return jobId;
}

// Usage
await notifyUser('user_alice', 'my-blog', 'comment', 'Great post!');
```

### For Browser Clients (Socket.io)

**Step 1 — User logs in and gets JWT token**
```js
// When user signs up or logs in
const response = await fetch('https://YOUR_API_URL/api/auth/signup', {
  method: 'POST',
  body: JSON.stringify({
    userId: 'user_alice',
    password: 'secure_password',
  }),
});
const { token } = await response.json();
localStorage.setItem('jwt_token', token);
```

**Step 2 — Connect Socket.io and listen for notifications**
```js
const socket = io('https://YOUR_API_URL', {
  auth: { token: localStorage.getItem('jwt_token') }
});

socket.on('notification', (notif) => {
  // notif = {
  //   _id: '...',
  //   recipientId: 'user_alice',
  //   senderId: 'my-blog',
  //   type: 'comment',
  //   payload: { message: 'Great post!', link: '/posts/123' },
  //   delivered: true,
  //   createdAt: '2026-05-01T...'
  // }
  
  showNotificationToast(`${notif.senderId}: ${notif.payload.message}`);
});

socket.on('connect', () => {
  console.log('Connected — missed notifications will be synced');
});

socket.on('disconnect', () => {
  console.log('Disconnected — will re-sync on reconnect');
});
```

### Notification Types

Currently supported types:
- `like` — User liked something
- `comment` — User left a comment
- `follow` — User followed an account
- `mention` — User was mentioned
- `batch` — Batched notifications (internal, auto-generated)

Add more in `shared/constants.js` → `NOTIFICATION_TYPES`.

---

## Dashboard Features

### Onboarding Popup
New users see an interactive onboarding tour on first login, guiding them through:
1. Queue tab — send test notifications
2. Notifications tab — view real-time arrivals
3. Metrics — monitor delivery success rates
4. Settings — configure delivery preferences

Toggle dismissal with the `ntfx_onboarded` localStorage flag.

### Quick Access Bar
Dashboard bottom panel shows:
- Dashboard URL (copy button)
- Landing page URL
- API base URL
- Bull Board admin link

### Metrics Dashboard
Real-time metrics showing:
- Queue depth (waiting, active, completed, failed, delayed jobs)
- Delivery stats (success rate, failure rate)
- Active workers (WORKER_ID + heartbeat)

### Batch Notifications (Automatic)
Repeated actions (likes, follows) within 30 seconds are automatically batched:
```
User A likes Post 1 → (0ms)
User B likes Post 1 → (5ms) 
User C likes Post 1 → (12ms) ✓ Batched as single notification
     │
     └─► "User A and 2 others liked your post"
```

Enable for notification types in `shared/constants.js` → `BATCH_TYPES`.

---

## How the Notification Processor Works

```
job received
    │
    ├─► Layer 2 idempotency check (MongoDB)
    │       └─ duplicate? → skip
    │
    ├─► Fetch user preferences (Redis cache → MongoDB fallback)
    │       └─ inApp disabled? → skip
    │       └─ type muted? → skip
    │       └─ quiet hours? → skip
    │
    ├─► Check online presence (Redis key online:{userId})
    │
    ├─► Save Notification to MongoDB
    │       └─ delivered: isOnline
    │
    ├─► If online: publish to Redis user:{userId} channel
    │       └─ Socket.io picks up → emits to browser room
    │
    └─► If offline: stored as delivered:false
            └─ Socket.io pushes on next connection
```

---

## FAQ

**Q: How do I prevent duplicate notifications?**
A: Every notification requires an `idempotencyKey`. NotifyX uses two layers:
1. **Redis SETNX** at API boundary (immediate, 24h TTL)
2. **MongoDB sparse unique index** in worker (safety net if Redis restarts)

If you send the same key twice, the second request gets a 409 "already queued" response.

**Q: What happens if the worker crashes?**
A: BullMQ holds a lock on the job. If the worker dies, the lock expires (30s) and another worker picks up the job. The `attemptsMade` counter increments, so it still counts toward the 5-retry limit.

**Q: Can I rate limit per user?**
A: Yes. The default is 50 notifications/min per recipient. Change in `middleware/rateLimiter.js`. Global limit is 10K/min to prevent API abuse.

**Q: How do I scale workers?**
A: Start multiple worker processes competing for the same queue:
```bash
# Terminal 1
WORKER_ID=worker-1 npm start

# Terminal 2
WORKER_ID=worker-2 npm start

# Terminal 3
WORKER_ID=worker-3 npm start
```

Each registers a heartbeat key in Redis. The metrics API lists them.

**Q: How do I add more notification types?**
A: Update `shared/constants.js`:
```js
const NOTIFICATION_TYPES = ['like', 'comment', 'follow', 'mention', 'share', 'tag'];
```

Then update the validation in `server/src/routes/notify.js`.

**Q: How are offline notifications synced?**
A: When a user goes offline, unread notifications stay in MongoDB with `delivered: false`. On reconnect, the Socket.io server queries for them and pushes them immediately. The query is limited to prevent thundering-herd issues.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Port 3000 already in use" | Kill the process: `lsof -i :3000 \| awk 'NR==2 {print $2}' \| xargs kill` |
| MongoDB connection fails | Check `MONGODB_URI` in `.env` — ensure whitelist IP or local server running |
| Redis connection fails | Check `REDIS_URL` — ensure TLS (`rediss://`) if using Upstash |
| Notifications not arriving | Check user preferences (`/api/users/preferences`) — type may be muted or notifications disabled |
| Socket.io not connecting | Verify JWT token is valid and CORS is enabled on API server |
| Batch notifications not working | Ensure type is in `BATCH_TYPES` in `shared/constants.js` |
| Bull Board showing no queues | Restart the server or check Redis connection |

---

## Architecture Decisions

**Why BullMQ instead of simple job queue?**
- Persistence across restarts (jobs live in Redis, survives outages with backups)
- Built-in retry with exponential backoff
- Job inspection UI (Bull Board)
- Dead Letter Queue for failed jobs
- Delayed jobs (used for batch flushing)
- Concurrency control per worker

**Why Redis Pub/Sub for Socket.io delivery?**
- Multi-server deployment: workers don't know which API server instance a user is connected to
- Publishing to a channel ensures all server instances receive the event
- Decouples workers from Socket.io — workers never touch Socket.io code

**Why two layers of idempotency?**
- Layer 1 (Redis SETNX) catches 99% of duplicates in <1ms
- Layer 2 (MongoDB unique index) protects if Redis restarts and SETNX key expires
- Cost: minimal latency trade-off, maximum safety in production

**Why separate server and worker packages?**
- Different scaling profiles (API server = I/O bound, worker = CPU/memory)
- Independent restart/deployment cycles
- Cleaner responsibility separation
- Each can be optimized independently

**Why MongoDB + Redis (not just Redis)?**
- MongoDB: durable, queryable history (30-day TTL keeps disk bounded)
- Redis: fast, pub/sub, locks, rate limiting, caching, job queue
- Together: best of both — Redis for speed, MongoDB for persistence

---

## Interview Prep

See [INTERVIEW_NOTES.md](./INTERVIEW_NOTES.md) for a 2-minute verbal script and 5 follow-up Q&As covering:
- System architecture
- Failure handling (retries, DLQ)
- Scaling patterns (horizontal workers, multi-server Socket.io)
- Idempotency across Redis restarts
- Adding new notification channels (email, push)

---

## License

MIT License

Copyright (c) 2026 Sumit Kumar

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

**Built by Sumit Kumar** — Student Developer
