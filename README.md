# NotifyX — Real-time Notification System

A real-time notification platform built with Node.js, Express, Socket.io, MongoDB, and Redis. Designed as a portfolio-level backend demo: REST API in front, async dispatch in the same process via `setImmediate`, durable storage in MongoDB, and live delivery over WebSockets.

> **summary:** Built and deployed a real-time notification microservice — REST API, async in-process dispatch with two-layer idempotency, Socket.io delivery with offline sync, and a self-service API key dashboard.

---

## Architecture

```
Your App (HTTP)
      │
      ▼
┌─────────────────────────────────────────┐
│  API Server  (Express :3000)            │
│  ─ validate + auth + rate limit         │
│  ─ Redis SETNX idempotency              │
│  ─ res.status(202) ← immediate          │
│  ─ setImmediate(dispatch)               │
│       ├─ check prefs                    │
│       ├─ Notification.create() (Mongo)  │
│       └─ io.to(userId).emit()           │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────┐
│  Socket.io  │
│  (browser)  │
└─────────────┘
```

**Key design decisions:**
- **One process.** Dispatch runs inline in the API server via `setImmediate` and emits straight through Socket.io — no separate worker process, no broker between accept and deliver.
- **Redis is reserved for what genuinely needs it:** idempotency (`SET NX`), unread badge caching, preference caching, delivery counters. No queue, no Pub/Sub, no presence polling.
- **In-memory online presence** via Socket.io rooms (`io.sockets.adapter.rooms.get(userId)`). No `online:{userId}` heartbeat keys.
- **In-memory rate limiter** (per-instance `Map` with a cleanup `setInterval`). Avoids spending a Redis command per request.
- **Two-layer idempotency:** Redis `SET NX` at the API boundary (24h TTL) + MongoDB sparse unique index in the dispatcher. The second layer catches dupes if Redis is wiped.
- **Offline sync:** if recipient isn't connected, the row is saved with `delivered: false` and pushed when their socket reconnects.

> Earlier versions of this project used a BullMQ queue + separate worker + Redis Pub/Sub bridge. That was removed because BullMQ's continuous polling (`BZPOPMIN`, `EVALSHA`, `ZRANGE`) was burning hundreds of thousands of Upstash commands per month with zero users and preventing Render's free tier from auto-sleeping the service.

---

## Stack

| Layer       | Technology                       |
|-------------|----------------------------------|
| API server  | Express.js                       |
| Real-time   | Socket.io                        |
| Database    | MongoDB (Atlas)                  |
| ODM         | Mongoose                         |
| Cache       | Redis (Upstash) — idempotency + caches only |
| Auth        | JWT (jsonwebtoken) + API keys (SHA-256 hashed) |
| Validation  | Joi                              |
| Frontend    | React via CDN (no build step)    |

---

## Project Structure

```
NotifyX/
├── shared/
│   ├── constants.js            # Channel prefix, defaults, notification types
│   └── models/
│       ├── Notification.js     # Factory — recipientId, type, payload, delivered
│       ├── User.js             # Factory — userId, preferences
│       └── ApiKey.js           # Factory — keyHash, prefix, appName
│
├── server/                     # npm package — API + Socket.io + inline dispatcher
│   └── src/
│       ├── app.js              # Entry point — DB, Redis, routes, Socket.io
│       ├── models.js           # Initializes shared models with server's mongoose
│       ├── config/
│       │   ├── db.js           # MongoDB connection
│       │   └── redis.js        # ioredis factory (handles rediss:// TLS)
│       ├── middleware/
│       │   ├── auth.js         # JWT + ApiKey middleware
│       │   └── rateLimiter.js  # In-memory fixed-window limiter
│       ├── routes/
│       │   ├── auth.js         # POST /api/auth/signup, /login, /token
│       │   ├── notify.js       # POST /api/notify — inline setImmediate dispatch
│       │   ├── notifications.js# GET/PATCH inbox + unread count
│       │   ├── preferences.js  # GET/PUT /api/users/preferences
│       │   ├── metrics.js      # GET /api/metrics
│       │   └── apikeys.js      # POST/GET/DELETE /api/keys
│       └── socket/
│           └── socketServer.js # Auth, rooms, offline sync, exports getIO/isOnline
│
├── worker/                     # Deprecated — no-op stub kept for legacy deploy refs
│
├── frontend/                   # React-via-CDN dashboard + landing + integration guide
│
├── render.yaml                 # Render.com — single web service
└── README.md
```

---

## Features

- **User Authentication** — signup + password login with bcrypt hashing
- **API Keys** — per-app, SHA-256 hashed, self-service or admin generated
- **Async Dispatch** — `setImmediate` after a 202, no queue infrastructure to maintain
- **Real-time Delivery** — direct `io.to(userId).emit()` from the same process; sub-50 ms when online
- **Offline Sync** — undelivered rows pushed on next socket connect
- **Two-layer Idempotency** — Redis `SET NX` + MongoDB sparse unique index
- **In-memory Rate Limiting** — 10,000 req/min global + 50 req/min per user, zero Redis cost
- **User Preferences** — inApp toggle, quiet hours, muted notification types
- **Cache-aside** — preferences cached in Redis (5 min TTL); unread badge count cached (30 s TTL)
- **30-day TTL** — MongoDB TTL index auto-archives old notifications
- **Metrics Endpoint** — running success/failure counters

---

## API Reference

### Auth — User Accounts

```
POST /api/auth/signup
Body: { "userId": "user_alice", "password": "min 8 chars" }
Response 201: { "token": "eyJ...", "userId": "user_alice", "expiresIn": "7d" }

POST /api/auth/login
Body: { "userId": "user_alice", "password": "..." }
Response 200: { "token": "eyJ...", "userId": "user_alice", "expiresIn": "7d" }

POST /api/auth/token   # legacy admin secret
Body: { "userId": "user_alice", "secret": "your_admin_secret" }
```

### Send Notification

```
POST /api/notify
Auth:  Bearer <token>  OR  ApiKey nx_<key>
Body:  {
  "recipientId":    "user_alice",
  "senderId":       "my-app",
  "type":           "like" | "comment" | "follow" | "mention",
  "payload":        { "message": "..." },
  "idempotencyKey": "<unique-id>"
}
Response 202: { "status": "accepted" }
```

The request returns as soon as the row passes validation and the idempotency check. Dispatch (preference filtering, DB write, socket emit) runs in the same process via `setImmediate`.

### Notifications Inbox

```
GET    /api/notifications               # paginated inbox
GET    /api/notifications/unread-count  # Redis-cached badge count (30s TTL)
PATCH  /api/notifications/:id/read      # mark single read
PATCH  /api/notifications/mark-all-read # bulk mark read
```

### API Keys

```
POST   /api/keys/self      # self-service — JWT auth
GET    /api/keys/self
DELETE /api/keys/self/:id

POST   /api/keys           # admin — x-admin-secret header
GET    /api/keys
DELETE /api/keys/:id
```

### Preferences

```
GET /api/users/preferences
PUT /api/users/preferences
Body: { "inApp": true, "mutedTypes": [], "quietHours": { "enabled": false } }
```

### Metrics & Health

```
GET /api/metrics   # { delivery: { total, success, failed, successRate, failureRate } }
GET /health        # { status, uptime } — DB readiness only, no Redis hit
```

---

## Running Locally

**Prerequisites:** Node.js 18+, MongoDB, Redis (local or Upstash).

**1. Clone and install**
```bash
git clone https://github.com/YOUR_USERNAME/notifyx.git
cd notifyx

npm install              # shared/models needs mongoose
cd server && npm install
```

**2. Configure environment**

`server/.env`:
```
PORT=3000
NODE_ENV=development
REDIS_URL=redis://localhost:6379          # or rediss://... for Upstash
MONGODB_URI=mongodb://localhost:27017/notifyx
JWT_SECRET=your-secret-key-min-32-chars
ADMIN_SECRET=notifyx-demo
CORS_ORIGIN=http://localhost:8080
```

**3. Start services**
```bash
# Terminal 1 — API server + dispatcher (one process)
cd server && npm start

# Terminal 2 — Frontend
cd frontend && npx serve . -l 8080
```

**4. Open browser**
- Dashboard: `http://localhost:8080/dashboard.html`
- Landing: `http://localhost:8080/` (or `/landing.html`)
- Health: `http://localhost:3000/health`

Sign up with any User ID (3–30 alphanumeric) and password (min 8 chars).

---

## Cloud Setup (Free)

| Service        | Provider                                  | Free tier               |
|----------------|-------------------------------------------|-------------------------|
| MongoDB        | [Atlas](https://atlas.mongodb.com)        | M0 — 512 MB             |
| Redis          | [Upstash](https://upstash.com)            | 10K commands/day        |
| API server     | [Render.com](https://render.com)          | 750 hrs/month           |
| Frontend       | [Vercel](https://vercel.com)              | Unlimited static        |

> No background-worker service is needed. Render's free web service can sleep when idle because nothing polls Redis in a loop.

---

## Deployment

**Render (single web service)** — `render.yaml` is configured:
1. Push to GitHub
2. Render → New → Blueprint → connect repo
3. Set env vars: `REDIS_URL`, `MONGODB_URI`, `JWT_SECRET`, `ADMIN_SECRET`, `CORS_ORIGIN`
4. Deploy

**Vercel (Frontend):**
1. Vercel → Import → root `frontend/`
2. Update `window.NOTIFYX_API_URL` in `frontend/dashboard.html`

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
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      recipientId,
      senderId,
      type,                              // 'like' | 'comment' | 'follow' | 'mention'
      payload:        { message, link: '/posts/123' },
      idempotencyKey: crypto.randomUUID(),
      priority:       5,                 // 1-10, optional
    }),
  });

  if (!response.ok) {
    console.error('Failed:', await response.json());
    return null;
  }

  return response.json();                // { status: 'accepted' }
}

await notifyUser('user_alice', 'my-blog', 'comment', 'Great post!');
```

### For Browser Clients (Socket.io)

**Step 1 — Log in and get a JWT**
```js
const { token } = await fetch('https://YOUR_API_URL/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'user_alice', password: '...' }),
}).then(r => r.json());

localStorage.setItem('jwt_token', token);
```

**Step 2 — Connect Socket.io and listen for notifications**
```js
const socket = io('https://YOUR_API_URL', {
  auth: { token: localStorage.getItem('jwt_token') }
});

socket.on('notification', (notif) => {
  // { _id, recipientId, senderId, type, payload, delivered, createdAt }
  showNotificationToast(`${notif.senderId}: ${notif.payload.message}`);
});

socket.on('connect',    () => console.log('connected — offline sync triggered'));
socket.on('disconnect', () => console.log('disconnected — will re-sync on reconnect'));
```

### Notification Types

Currently supported: `like`, `comment`, `follow`, `mention`. Add more in `shared/constants.js` → `NOTIFICATION_TYPES`, then update the Joi enum in `server/src/routes/notify.js`.

---

## How Dispatch Works

```
POST /api/notify
    │
    ├─► Auth + Joi validate
    ├─► Layer 1 idempotency:  SET NX idem:{key} EX 86400
    │       └─ duplicate? → 409
    ├─► res.status(202).json({ status: 'accepted' })
    │
    └─► setImmediate(() => dispatch(data))
            │
            ├─► fetch user preferences (Redis cache → Mongo fallback)
            │       └─ inApp off / type muted / quiet hours? → skip
            │
            ├─► isOnline(recipientId)   // io.sockets.adapter.rooms.get(...)
            │
            ├─► Notification.create({ ..., delivered: isOnline })
            │       └─ E11000 (Layer 2 idempotency) → skip
            │
            └─► if online: io.to(recipientId).emit('notification', notif)
                else:      stored as delivered:false; pushed on next connect
```

---

## FAQ

**Q: How do I prevent duplicate notifications?**
A: Pass a unique `idempotencyKey` per request. Two layers protect against duplicates:
1. **Redis `SET NX`** at the API boundary (24h TTL) — catches the fast path
2. **MongoDB sparse unique index** in the dispatcher — catches the rare case where Redis is wiped before the TTL expires

Sending the same key twice returns `409 Conflict` from layer 1, or is silently dropped by layer 2 if Redis was reset.

**Q: What happens if dispatch fails (e.g., DB write throws)?**
A: It logs the error and increments `metrics:failed`. There is no automatic retry — the 202 has already been sent to the caller. Callers that need stronger delivery guarantees should retry themselves using the same `idempotencyKey`. This is the trade-off of removing BullMQ: simpler, cheaper, but no built-in retry/DLQ.

**Q: Can I rate-limit per user?**
A: Yes. Default is 50 notifications/min per recipient, 10,000/min global. Counters live in an in-memory `Map` so they don't cost Redis commands. Change in `middleware/rateLimiter.js`.

**Q: How does this scale?**
A: For a portfolio demo, it doesn't need to. For a real deployment, scale the API server horizontally behind a load balancer. The cost of doing that: the rate limiter becomes per-instance (so bursts can slip through proportionally to the replica count), and a notification can only be emitted on the instance the recipient's socket is connected to — to fix that you'd reintroduce a real-time bus (Redis Pub/Sub adapter for Socket.io, or NATS). At which point your traffic justifies it.

**Q: How are offline notifications synced?**
A: Rows for offline users are saved with `delivered: false`. On socket `connect`, the server queries those rows for that user, marks them `delivered: true`, and emits each one over the new socket.

**Q: How do I add more notification types?**
A: Update `shared/constants.js` → `NOTIFICATION_TYPES` and the Joi enum in `server/src/routes/notify.js`.

---

## Troubleshooting

| Issue                                | Solution                                                                                  |
|--------------------------------------|-------------------------------------------------------------------------------------------|
| "Port 3000 already in use"           | `lsof -i :3000 \| awk 'NR==2 {print $2}' \| xargs kill`                                   |
| MongoDB connection fails             | Check `MONGODB_URI` — Atlas IP whitelist or local server running                          |
| Redis connection fails               | Check `REDIS_URL` — use `rediss://` for Upstash TLS                                       |
| Notifications not arriving           | Check `/api/users/preferences` — type may be muted, quiet hours active, or `inApp` off    |
| Socket.io not connecting             | Verify JWT and `CORS_ORIGIN`                                                              |
| `[Notify] dispatch failed` in logs   | Check Mongo connectivity; the 202 was returned but the row didn't land                    |

---

## Architecture Decisions

**Why no queue?**
BullMQ provided durable retries, a DLQ, and concurrency control, but it polls Redis continuously (`BZPOPMIN` / `EVALSHA` / `ZRANGE`) regardless of load. On Upstash that was hundreds of thousands of commands per month with zero users, and on Render it pinned the worker process awake so the free tier couldn't sleep. For a portfolio demo with no incoming load, the cost-benefit clearly favored deletion. The dispatcher now runs inline via `setImmediate` — same async semantics, zero broker.

**Why no Redis Pub/Sub?**
With one process owning both the HTTP API and the Socket.io server, the Pub/Sub bridge between worker → API was load-bearing for nothing. Direct `io.to(userId).emit()` is faster and free. Reintroduce Pub/Sub only when you scale to multiple replicas.

**Why in-memory rate limiting?**
The previous Redis-backed limiter cost one `INCR` (plus an `EXPIRE` on the first hit of each window) for every request to every rate-limited endpoint. That's the single biggest Redis hit on the hot path. An in-memory `Map` with a cleanup `setInterval` does the same job free of charge as long as you're on one instance.

**Why two layers of idempotency?**
Layer 1 (Redis `SET NX`) catches ~99% of duplicates in <1 ms and gives the caller a clear 409. Layer 2 (MongoDB sparse unique index) is the safety net for the rare case where Redis is flushed or the key TTL elapses before the second attempt. Trade-off: minimal cost, eliminates the class of bug that's hardest to debug — silent duplicate notifications.

**Why Mongo + Redis?**
MongoDB owns the durable inbox (30-day TTL keeps disk bounded). Redis owns idempotency, two small caches, and counters. Each tool does what it's actually good at — nothing more.

---

## Interview Prep

See [INTERVIEW_NOTES.md](./INTERVIEW_NOTES.md) for a 2-minute verbal script and follow-up Q&As covering:
- Architecture and the deliberate choice to drop BullMQ
- Failure handling (no retries — trade-off accepted)
- Scaling patterns (in-memory limits, when to reintroduce Pub/Sub)
- Two-layer idempotency
- Adding email / push channels

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
