# NotifyX — Architecture Walkthrough & Interview Prep

---

## 2-Minute Verbal Script

**What the system does (one sentence)**
NotifyX is a notification platform that accepts events from any application via HTTP and delivers them to connected browser clients in real time — with offline buffering, preference filtering, and rate limiting built in.

**Why async dispatch instead of synchronous response**
A synchronous response would make the sender wait for preference lookups, the DB write, and the socket emit — easily a few hundred milliseconds of tail latency, and a hard failure for the caller if any downstream step is slow. Instead, the API validates, runs an idempotency check, returns `202 Accepted`, and runs dispatch inline via `setImmediate`. The caller is unblocked in under 5 ms; delivery happens on the next tick of the event loop.

**Why I removed the BullMQ worker**
The original design had a separate worker process pulling jobs off a BullMQ queue and publishing to Redis Pub/Sub for the API server to forward to sockets. That gave durable retries and a DLQ — but at zero load, BullMQ's worker continuously polls Redis with `BZPOPMIN` / `EVALSHA` / `ZRANGE`. On Upstash that was hundreds of thousands of commands per month with no users, and on Render's free tier it kept the worker process awake so the dyno couldn't sleep. For this project the cost-benefit clearly inverted, so I deleted the queue, the worker process, and the Pub/Sub bridge. Dispatch now runs in the same process as the API and emits directly via `io.to(userId).emit()`. Simpler, cheaper, fewer moving parts. The trade-off is no automatic retry — callers retry themselves using the same `idempotencyKey`, which the two-layer idempotency guarantees is safe.

**How failures are handled**
A failed dispatch logs the error and increments a `metrics:failed` counter — that's it. There's no DLQ. This is a deliberate trade-off: the 202 has already been sent, so retrying would be partial-failure semantics for the caller anyway. For a production system that needed at-least-once, I'd put a real queue back in (Kafka or a dedicated worker on a dedicated Redis); for a portfolio demo, this is correct.

**How idempotency works**
Two layers. Layer 1 is `SET NX idem:{key} EX 86400` at the API boundary — catches the fast path in a single Redis command and returns `409 Conflict`. Layer 2 is a MongoDB sparse unique index on `idempotencyKey` in the dispatcher — catches the rare case where Redis was wiped between attempts. The second layer surfaces as an `E11000` error that the dispatcher catches and treats as a silent skip.

**How the system would scale**
Horizontally behind a load balancer. Two things would need to change. First, the rate limiter is an in-memory `Map` — fine on one instance, but becomes per-instance with replicas, so bursts can slip past the global ceiling. Second, `io.to(userId).emit()` only reaches sockets on the same instance, so I'd reintroduce a real-time bus (the Socket.io Redis adapter, or NATS) so emits fan out across replicas. The point is: I deliberately didn't pay that cost upfront — the project doesn't need it.

**Key trade-offs**
- Redis is now used only for what genuinely needs it: idempotency, two small caches (preferences, unread badge), delivery counters. No queue, no Pub/Sub, no presence polling — those were the cost drivers.
- In-memory rate limiting and in-memory online presence (via Socket.io rooms) buy a lot of Redis savings at the cost of being single-instance assumptions.
- No retry/DLQ. Callers retry; idempotency keys keep that safe.

---

## 5 Likely Follow-Up Questions

**Q1: What happens if the server crashes after returning 202 but before the dispatch completes?**
The notification is lost — the row was never inserted. Since the caller got a 202, they assume it was accepted. This is the price of removing BullMQ. The mitigation is the idempotency key: a caller that wants stronger guarantees can implement a short retry on a timeout, and the two-layer idempotency makes those retries safe (no duplicates). For a real production system requiring at-least-once, you'd reintroduce a durable queue — but the queue can be a single-process in-process queue with disk-persistence, or a low-poll-rate alternative like Postgres-backed `pg-boss`, rather than BullMQ.

**Q2: Why setImmediate over a simple Promise that you don't await?**
`setImmediate` schedules the callback for the next tick, after I/O callbacks. That means the response is fully flushed to the socket before dispatch starts touching Mongo or Redis. With an un-awaited async function, dispatch starts synchronously up to its first `await`, which can include the prefs-cache `redis.get` — small, but it adds latency to the response. `setImmediate` is the cleaner separation. For higher-throughput cases I'd use a bounded in-memory queue + worker pool, but for this load `setImmediate` is the right primitive.

**Q3: How does the idempotency key work across Redis restarts?**
Layer 1 (Redis `SET NX`, 24h TTL) catches >99% of duplicates in <1 ms — the same key sent twice returns `409 Conflict` the second time. Layer 2 (MongoDB sparse unique index on `idempotencyKey`) is the safety net: if Redis is flushed or the TTL expires and the same key is retried, the dispatcher tries to insert and Mongo throws `E11000`. The dispatcher catches that and skips silently. The index is sparse so docs without an idempotencyKey don't participate in the uniqueness check.

**Q4: How are offline notifications delivered?**
When dispatch runs, it checks `io.sockets.adapter.rooms.get(userId)?.size > 0` to determine if the recipient has a live socket. If yes, the row is saved with `delivered: true` and `io.to(userId).emit('notification', ...)` fires immediately. If no, the row is saved with `delivered: false` — nothing else happens. When the user reconnects, the Socket.io `connection` handler queries for unread + undelivered rows for that user, marks them delivered in bulk, and emits each one over the new socket. Trade-off: a thundering herd of reconnects after a deploy could spike Mongo. Mitigation would be a short random jitter on connect and pagination on the sync query.

**Q5: How would you add email or push channels?**
The dispatcher already reads `prefs.email` and `prefs.push`, so the hook is there. For email, I'd call out to a transactional provider (SES, Resend, Postmark) — but probably not from the same `setImmediate` callback, because email APIs are slower (200–500 ms) and rate-limited, which would clog the event loop under load. Instead I'd fire-and-forget into a small in-process bounded queue with a tiny pool of workers, or post a message to a provider-managed queue (SQS for example). Push is similar — APNs/FCM through their SDKs. The point is that adding channels doesn't change the core notification flow; it adds independent fan-out steps that fail independently.
