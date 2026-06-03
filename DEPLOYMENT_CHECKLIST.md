# Quick Deployment Checklist

## Prereqs (Do These First)
- [ ] Generate JWT Secret: `openssl rand -hex 32`
- [ ] Push repo to GitHub

## Step 1: MongoDB Atlas (5 min)
- [ ] Create free account at [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas)
- [ ] Create M0 (free tier) cluster
- [ ] Create database user (username: `notifyx`)
- [ ] **Copy MongoDB connection string** (Step 1.3 in DEPLOYMENT.md)
- [ ] Whitelist `0.0.0.0/0` in Network Access

## Step 2: Upstash Redis (3 min)
- [ ] Create account at [upstash.com](https://upstash.com)
- [ ] Create new Redis database (region: `us-east-1`)
- [ ] **Copy Redis URL** (starts with `rediss://`)

## Step 3: Deploy Backend to Render (10 min)
- [ ] Sign up at [render.com](https://render.com) with GitHub
- [ ] Create Web Service from `NotifyX` repo
- [ ] Set env vars:
  - [ ] `MONGODB_URI` = your Atlas connection string
  - [ ] `REDIS_URL` = your Upstash Redis URL
  - [ ] `JWT_SECRET` = your generated secret
  - [ ] `NODE_ENV` = `production`
  - [ ] `PORT` = `3000`
  - [ ] `ADMIN_SECRET` = `notifyx-demo`
- [ ] **Copy Render service URL** (looks like: `https://notifyx-api.onrender.com`)

## Step 4: Deploy Frontend to Vercel (5 min)
- [ ] Sign up at [vercel.com](https://vercel.com) with GitHub
- [ ] Create new project from `NotifyX` repo
- [ ] Set root directory to `frontend`
- [ ] Set env var:
  - [ ] `VITE_API_URL` = your Render service URL
- [ ] **Copy Vercel frontend URL** (looks like: `https://notifyX-xxx.vercel.app`)

## Step 5: Fix CORS (2 min)
- [ ] Go back to Render dashboard → **notifyx-api** → **Environment**
- [ ] Set `CORS_ORIGIN` = your Vercel frontend URL
- [ ] Save (Render auto-restarts)

## Step 6: Test (5 min)
- [ ] Visit `https://notifyx-api.onrender.com/health` → should return `{"status":"ok",...}`
- [ ] Visit your Vercel URL
- [ ] Login with any userId + password `notifyx-demo`
- [ ] Send a test notification
- [ ] Should see real-time delivery

---

## If Something Fails

1. **Check Render logs:** Render dashboard → **Logs**
2. **Check Vercel logs:** Vercel dashboard → **Deployments** → **Build Logs**
3. **Read DEPLOYMENT.md** troubleshooting section

## Cost Summary

| Service | Free Tier | Cost |
|---------|-----------|------|
| Vercel | Unlimited bandwidth, 1 concurrency | **$0** |
| Render | Web service + DB | **$0** (cold starts after 15 min inactivity) |
| MongoDB Atlas | 512MB storage | **$0** |
| Upstash Redis | 10K commands/day | **$0** |
| **Total** | — | **$0/month** |

### When to Upgrade
- **30-second cold starts bother you?** Upgrade Render to $7/mo for always-on
- **Hitting Redis command limit?** Upgrade Upstash (cheap, pay-as-you-go)
- **Need more MongoDB storage?** Upgrade Atlas (~$15/mo for more)

---

**Need help?** See DEPLOYMENT.md for detailed step-by-step guide.
