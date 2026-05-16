# Deployment Guide

## Quick Start — Render + Vercel (Free Tier)

### Step 1: Set Up MongoDB (Atlas)

1. Go to [atlas.mongodb.com](https://atlas.mongodb.com)
2. Create free M0 cluster
3. Create database user with strong password
4. Copy connection string: `mongodb+srv://user:password@cluster.mongodb.net/?appName=Cluster0`
5. Add your IP to whitelist (or use 0.0.0.0/0 for development only)

### Step 2: Set Up Redis (Upstash)

1. Go to [upstash.com](https://upstash.com)
2. Create free Redis database
3. Copy connection string: `rediss://default:password@host:port`
4. Enable TLS (should be default)

### Step 3: Deploy API Server (Render)

1. Push to GitHub (make sure `.env` is NOT committed)
2. Go to [render.com](https://render.com)
3. New → Blueprint → Connect your repo
4. Render auto-detects `render.yaml` and deploys a single web service. There is no separate background-worker service — dispatch runs in-process via `setImmediate`.

**Set environment variables in Render dashboard:**
```
PORT=3000
NODE_ENV=production
REDIS_URL=rediss://default:password@host:port
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/?appName=Cluster0
JWT_SECRET=<generate with: openssl rand -hex 32>
ADMIN_SECRET=<generate with: openssl rand -hex 16>
CORS_ORIGIN=https://yourdomain.vercel.app
LOG_LEVEL=info
```

### Step 4: Deploy Frontend (Vercel)

1. Create `vercel.json` in project root:
```json
{
  "buildCommand": "true",
  "outputDirectory": "frontend"
}
```

2. Go to [vercel.com](https://vercel.com)
3. Import GitHub repo
4. Set root directory: `frontend`
5. Deploy

**Update frontend API URL in `frontend/dashboard.html`:**
```html
<script>
  window.NOTIFYX_API_URL = 'https://your-render-api.onrender.com';
</script>
```

### Step 5: Test End-to-End

1. Visit `https://yourdomain.vercel.app`
2. Sign up with a new account
3. Open browser DevTools → Console
4. Send a test notification via API:
```bash
curl -X POST https://your-render-api.onrender.com/api/notify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientId": "your_user_id",
    "senderId": "test",
    "type": "like",
    "payload": {"message": "Test!"},
    "idempotencyKey": "'$(uuidgen)'"
  }'
```

5. Check that the notification arrives in real-time on the dashboard.

---

## Manual Deployment (Heroku, AWS, DigitalOcean, etc.)

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Redis/Upstash account
- Hosting account (Heroku, AWS, DigitalOcean, etc.)

### API Server Deployment

**1. Build for production:**
```bash
cd server
npm install --production
```

**2. Set environment variables on host:**
```bash
export NODE_ENV=production
export PORT=3000
export REDIS_URL=rediss://...
export MONGODB_URI=mongodb+srv://...
export JWT_SECRET=<strong-secret>
export CORS_ORIGIN=https://yourdomain.com
```

**3. Start server:**
```bash
npm start
```

That's the entire deployment. No separate worker process is needed — the API server handles both HTTP and dispatch in one Node.js process.

### Frontend Deployment (Static Hosting)

**Option A: Vercel (Recommended)**
```bash
npm install -g vercel
cd frontend
vercel --prod
```

**Option B: Netlify**
```bash
npm install -g netlify-cli
cd frontend
netlify deploy --prod --dir .
```

**Option C: GitHub Pages**
```bash
# Push frontend/ to gh-pages branch
git subtree push --prefix frontend origin gh-pages
```

**Option D: Any Static Host (AWS S3, Cloudflare, etc.)**
```bash
# Just upload frontend/ directory to CDN
```

---

## Production Checklist

### Security
- [ ] No `.env` files in Git
- [ ] `JWT_SECRET` is strong (32+ chars, random)
- [ ] Database credentials are environment variables only
- [ ] IP whitelist enabled on MongoDB and Redis
- [ ] 2FA enabled on all cloud accounts
- [ ] HTTPS/TLS enforced everywhere
- [ ] `CORS_ORIGIN` set to a specific domain (not `*`)

### Performance
- [ ] Enable HTTP/2 on the API server
- [ ] Enable gzip compression
- [ ] Set Cache-Control headers on static files
- [ ] Enable CDN for the frontend (Vercel/Netlify default)
- [ ] Monitor database query performance

### Monitoring
- [ ] Error logging configured (Sentry, LogRocket, etc.)
- [ ] Database backups automated
- [ ] Redis backups enabled
- [ ] API uptime monitoring (Pingdom, UptimeRobot)
- [ ] Alert on high error rate

### Scaling
- [ ] Add API instances behind a load balancer when CPU consistently exceeds budget
- [ ] If you add a second instance, add the Socket.io Redis adapter so emits fan out across replicas (see note below)
- [ ] Monitor Redis memory usage and command count
- [ ] Set MongoDB auto-scaling
- [ ] Load test before going live

> **Scaling note.** Dispatch is in-process. `io.to(userId).emit()` only reaches sockets on the same instance — if you scale horizontally, install the Socket.io Redis adapter (`@socket.io/redis-adapter`) so emits fan out. The in-memory rate limiter also becomes per-instance; bursts can slip past the global ceiling proportionally to the replica count. Move it back to Redis only if that actually matters for your traffic.

---

## Troubleshooting Deployments

| Issue                                | Solution                                                                                  |
|--------------------------------------|-------------------------------------------------------------------------------------------|
| "Connection refused" on MongoDB      | Check IP whitelist, credentials, and TLS                                                  |
| "Connection refused" on Redis        | Check password and TLS setting (`rediss://` vs `redis://`)                                |
| Socket.io connection fails           | Verify `CORS_ORIGIN` matches the frontend domain                                          |
| Notifications not delivering         | Check user preferences (`/api/users/preferences`) — type may be muted or `inApp` is off   |
| `[Notify] dispatch failed` in logs   | A row didn't land in Mongo; the 202 was already returned. Inspect the stack trace.        |
| High latency on `POST /api/notify`   | Should be <5 ms — investigate Redis latency to Upstash                                    |
| Database full                        | Verify the 30-day TTL index is in place; or shorten the TTL                               |

---

## Zero-Downtime Deployment

**For the API server:**
1. Deploy new version to staging
2. Test thoroughly
3. Switch load balancer to the new version
4. Keep the old version running for 5 min (rollback if needed)
5. Shut down the old version

> The previous version of this guide had separate steps for "worker" deployment. That's no longer relevant — there is no separate worker process. The API server is the only Node.js process.

**For the frontend:**
1. Deploy to a staging subdomain
2. Test across browsers
3. Update DNS/CDN to point to the new version
4. Old version cached by browsers for ~24h

---

## Secrets Management in CI/CD

**GitHub Actions example:**
```yaml
name: Deploy
on: [push]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Render
        run: |
          curl -X POST https://api.render.com/deploy/srv-${{ secrets.RENDER_SERVICE_ID }}?key=${{ secrets.RENDER_API_KEY }}
        env:
          REDIS_URL: ${{ secrets.REDIS_URL }}
          MONGODB_URI: ${{ secrets.MONGODB_URI }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

Store secrets in GitHub Settings → Secrets → Actions.

---

## Rollback Procedure

If deployment breaks:

1. **API Server:**
   - Render: Click "Rollback" in the dashboard
   - Manual: Restart the previous version

2. **Frontend:**
   - Vercel: Click "Rollback" in deployments
   - Manual: Re-deploy the previous commit

3. **Database:**
   - Restore from backup if data is corrupted

---

**For questions:** See [README.md](./README.md).
