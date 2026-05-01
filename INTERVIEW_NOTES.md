# NotifyX — Architecture Walkthrough & Interview Prep

---

## 2-Minute Verbal Script

**What the system does (one sentence)**
NotifyX is a distributed notification platform that accepts events from any application via HTTP, queues them reliably, and delivers them to connected browser clients in real time — with offline buffering, preference filtering, and rate limiting built in.

**Why async queue instead of synchronous**
A synchronous call would make the sender wait for delivery to complete — including database writes, preference lookups, and socket pushes — which could take hundreds of milliseconds and would fail entirely if any downstream step is slow or unavailable. The queue decouples send latency from delivery latency: the API acknowledges in under 5 ms and the worker processes in the background. If delivery fails, the job retries automatically with exponential backoff — nothing is lost.

**Why workers are separate processes**
The API server's job is to accept requests quickly and return. If processing logic lived in the same process, a slow job — or a memory leak in the processor — would degrade the entire API. Separate processes mean each can be scaled, deployed, and restarted independently. Redis is the only bridge: the server enqueues, the worker dequeues.

**Why Redis Pub/Sub instead of workers talking to sockets directly**
Workers don't know which server instance a user's socket is connected to — in a multi-server deployment there could be dozens of Socket.io server instances. Publishing to a Redis channel means every server instance receives the event and can forward it to the right socket room. The worker never needs to know about Socket.io; Socket.io never needs to know about BullMQ.

**How failures are handled**
BullMQ retries failed jobs up to 5 times with exponential backoff (5 → 10 → 20 → 40 → 80 seconds). If all retries exhaust, the job moves to a Dead Letter Queue — a separate BullMQ queue — where it can be inspected and replayed manually via the API. Idempotency keys prevent any duplicate notifications even when a job is retried.

**How the system scales**
Horizontally: spin up more worker processes — they all compete for jobs on the same BullMQ queue (competing consumers pattern). Each worker registers a heartbeat key in Redis so the metrics API can list active workers. The API server scales behind a load balancer; Redis Pub/Sub ensures Socket.io delivery works regardless of which server a client is connected to. Vertically: BullMQ concurrency is configurable per worker instance.

**Key trade-offs**
- Redis as the sole bridge is a single point of failure — mitigated by Upstash's HA clusters, but worth noting.
- MongoDB is used for durable storage; Redis for ephemeral state and pub/sub. If Redis restarts, in-flight pub/sub events are lost — but the worker stores `delivered: false` first, so offline sync on reconnect recovers them.
- The two-layer idempotency (Redis SETNX at API + sparse unique index at worker) adds latency but prevents the class of bugs that are hardest to debug in production: silent duplicates.

---

## 5 Likely Follow-Up Questions

**Q1: What happens if the worker crashes mid-job?**
BullMQ uses a lock mechanism — when a worker picks up a job it holds a lock (renewed every 30 seconds). If the worker crashes without completing, the lock expires and BullMQ makes the job available again for another worker to pick up. The job's `attemptsMade` counter increments, so it still counts toward the retry limit. This means at-least-once delivery is guaranteed.

**Q2: How would you prevent a thundering-herd of reconnecting users from overwhelming the server?**
The offline sync query (`find({ delivered: false })`) runs per-user on reconnect. To prevent a spike — say after a deploy — you'd add a short random jitter delay before the sync query, and rate-limit the socket `connect` event handler. A secondary mitigation is pagination: only sync the most recent N undelivered notifications, not all of them.

**Q3: Why BullMQ over a simple `setInterval` or `setTimeout`?**
`setInterval` has no persistence — a restart loses all pending work. BullMQ persists jobs in Redis, gives you retry/backoff, concurrency control, job inspection UI (Bull Board), DLQ handling, delayed jobs, and job event hooks out of the box. The operational maturity difference is substantial for anything beyond a toy use case.

**Q4: How does the idempotency key work across Redis restarts?**
There are two layers. Layer 1 (Redis SETNX with 24-hour TTL) is the fast path — it catches 99% of duplicates before they even enter the queue. Layer 2 (MongoDB sparse unique index on `idempotencyKey`) is the safety net — if Redis restarts and the SETNX key is gone, the worker will attempt to write to MongoDB and hit a `duplicate key` error, which is caught and logged as a skip. The sparse index means the field only participates in uniqueness enforcement when it has a value.

**Q5: How would you add email or push notification channels?**
The worker processor already checks user preferences for `email` and `push` flags. Adding a channel means adding a new step in `notificationProcessor.js`: after saving to MongoDB, if `prefs.email` is true, enqueue a job on a separate `email-queue` processed by a dedicated email worker (SES, SendGrid, etc.). This keeps channel concerns isolated — the core notification flow doesn't change, and each channel can have its own retry policy, rate limits, and provider failover logic.
