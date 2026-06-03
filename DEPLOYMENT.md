# NotifyX Deployment Guide

Deploy NotifyX for free on **Vercel** (frontend) + **Render** (backend) using **MongoDB Atlas** and **Upstash Redis**.

## Overview

| Component | Service | Cost | Notes |
|-----------|---------|------|-------|
| Frontend (React SPA) | Vercel | **Free** | Auto-deploys on git push |
| Backend API | Render | **Free** | Spins down after 15 min inactivity (~30s cold start) |
| MongoDB | Atlas | **Free** | 512MB storage, shared cluster |
| Redis | Upstash | **Free** | 10K commands/day, HTTP API |
| **Total** | — | **$0** | Upgrade Render to $7/mo if cold starts become annoying |

---

## Step 1: Set Up MongoDB Atlas (Database)

### 1.1 Create Account & Cluster
1. Go to [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas)
2. Sign up with Google or GitHub
3. Create a new **free tier cluster** (M0 - Sandbox)
4. Choose region closest to you
5. Wait 5–10 minutes for cluster to initialize

### 1.2 Create Database User
1. In Atlas → **Database Access** → **Add Database User**
2. **Username:** `notifyx` (or your choice)
3. **Password:** Generate a strong one (copy it somewhere safe)
4. **Database User Privileges:** Select "Read and write to any database"
5. Click **Add User**

### 1.3 Get Connection String
1. In Atlas → **Database** → Click **Connect** on your cluster
2. Choose **Drivers** → **Node.js** → Copy the connection string
3. Keep the Atlas URI private and paste it into `MONGODB_URI` as provided by MongoDB Atlas.
4. If your password contains special characters, URL-encode them first using [this tool](https://www.urlencoder.org/).

### 1.4 Whitelist Render IP
1. In Atlas → **Network Access** → **Add IP Address**
2. Click **Allow Access from Anywhere** (toggle `0.0.0.0/0`)
3. Confirm — this is safe since auth is JWT-based

**✅ Save your MongoDB connection string — you'll need it in Step 4**

---

## Step 2: Set Up Upstash Redis (Cache & Pub/Sub)

### 2.1 Create Account & Database
1. Go to [upstash.com](https://upstash.com) → Sign up
2. Create a **new Redis database**
3. **Region:** Pick the one closest to Render's region (e.g., `us-east-1`)
4. **Eviction Policy:** `allkeys-lru` (safe default)
5. Create database

### 2.2 Get Connection String
1. In Upstash dashboard → click your database
2. Copy the **Redis URL** from the dashboard and store it in `REDIS_URL`.
3. Make sure you keep the SSL-enabled production URL from Upstash (the dashboard will provide the correct one).

**✅ Save your Upstash Redis URL — you'll need it in Step 4**

---

## Step 3: Prepare Your Repository

### 3.1 Verify `render.yaml` exists
Your repo already has `render.yaml` configured. No changes needed — Render reads this automatically.

### 3.2 Generate JWT Secret
In your terminal, run:
```bash
openssl rand -hex 32
```
Copy the output (looks like: `a3f8c2e9d1b5f7a4c6e8f2d4a9b1c3e5`)

**✅ Save this JWT secret — you'll need it in Step 4**

### 3.3 Push to GitHub (if not already)
```bash
git add .
git commit -m "chore: prepare for Render deployment"
git push origin main
```

---

## Step 4: Deploy Backend to Render

### 4.1 Connect Render to GitHub
1. Go to [render.com](https://render.com) and sign up with GitHub
2. Grant Render permission to access your repositories
3. Click **New** → **Web Service**
4. Select your `NotifyX` repository
5. **Name:** `notifyx-api`
6. **Runtime:** Node
7. **Build Command:** `npm install` (auto-filled from render.yaml)
8. **Start Command:** `node src/app.js` (auto-filled from render.yaml)
9. Click **Create Web Service**

### 4.2 Set Environment Variables
In Render dashboard → **Environment** → Add these:

| Key | Value | From |
|-----|-------|------|
| `NODE_ENV` | `production` | Fixed |
| `PORT` | `3000` | Fixed |
| `MONGODB_URI` | Your MongoDB connection string | Step 1.3 |
| `REDIS_URL` | Your Upstash Redis URL | Step 2.2 |
| `JWT_SECRET` | Your generated secret | Step 3.2 |
| `CORS_ORIGIN` | (leave blank for now) | Will set after frontend deploys (Step 6) |
| `ADMIN_SECRET` | `notifyx-demo` | Fixed (demo value) |

### 4.3 Deploy
1. Click **Deploy** (or auto-deploys on git push)
2. Wait 3–5 minutes for build to complete
3. Once deployed, Render shows your service URL: `https://notifyx-api.onrender.com`

**✅ Copy your Render service URL — you'll need it in Step 6**

---

## Step 5: Deploy Frontend to Vercel

### 5.1 Connect Vercel to GitHub
1. Go to [vercel.com](https://vercel.com) and sign up with GitHub
2. Click **New Project**
3. Select your `NotifyX` repository
4. **Root Directory:** `frontend`
5. Click **Deploy**

### 5.2 Set Environment Variables
In Vercel dashboard → **Settings** → **Environment Variables**:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | Your Render service URL from Step 4.3 (e.g., `https://notifyx-api.onrender.com`) |

**Note:** If your frontend doesn't use `VITE_API_URL`, check your code and set the env var that matches.

### 5.3 Deploy
1. Click **Deploy** (or auto-deploys on git push)
2. Vercel shows your frontend URL: `https://your-project.vercel.app`

**✅ Copy your Vercel frontend URL — you'll need it in Step 6**

---

## Step 6: Update CORS on Render

Now that you have both URLs, fix the CORS setting:

1. Go to Render dashboard → **notifyx-api** → **Environment**
2. Update `CORS_ORIGIN` = your Vercel URL (e.g., `https://your-project.vercel.app`)
3. Click **Save** → Render auto-restarts your service

---

## Step 7: Test Your Deployment

### 7.1 Test Health Check
Open in browser:
```
https://notifyx-api.onrender.com/health
```
Should return: `{"status":"ok","uptime":...}`

### 7.2 Test Frontend
1. Open your Vercel URL
2. Login with **any userId** + **password:** `notifyx-demo`
3. Send a test notification
4. Should see real-time delivery

### 7.3 Monitor Logs
- **Backend logs:** Render dashboard → **Logs**
- **Frontend errors:** Browser DevTools → Console

---

## Troubleshooting

### Cold Start Takes 30 Seconds
**Normal on Render free tier.** The server spins down after 15 min of inactivity.
- **Solution:** Upgrade Render to paid tier ($7/mo) for instant cold starts, or add a keep-alive ping.

### "Connection refused" / "Cannot reach database"
- Check `MONGODB_URI` and `REDIS_URL` are correct and URL-encoded properly
- Verify Atlas network access allows `0.0.0.0/0`
- Check Render logs for specific error

### Socket.io Events Not Working
- Verify `CORS_ORIGIN` matches your Vercel URL exactly
- Browser DevTools → Network → check WebSocket handshake succeeds
- Check Render logs for connection errors

### Upstash Commands Exceeded
- You get 10K commands/day on free tier
- Check `/api/metrics` endpoint to see Redis usage
- If you hit limits, upgrade to paid Upstash (~$0.50–2/day depending on usage)

---

## Auto-Deploy on Git Push

Both Vercel and Render auto-deploy on every push to `main`:

```bash
# Make a change
git commit -am "feat: add new endpoint"
git push origin main

# Vercel + Render both deploy automatically
# Check dashboard for build status
```

---

## Next Steps

- **Scale backend:** Upgrade Render to paid ($7/mo) for always-on + faster cold starts
- **Custom domain:** Add your domain to Vercel (free)
- **Email notifications:** Integrate SendGrid or similar (add API key to env vars)
- **Monitoring:** Set up Render error alerts or Upstash metrics dashboard

---

## Costs at Scale

- **100 users:** ~$7/mo (Render paid) + small Upstash upgrade (~$1/mo)
- **1K users:** ~$7/mo (Render) + $5/mo (Upstash) + potential MongoDB upgrade
- **10K+ users:** Consider managed infrastructure (AWS, Heroku, Railway)

For now, **you're at $0/month**. Upgrade pieces as needed.

---

**Questions?** Check your service logs in Render/Vercel dashboards — they'll show exactly what's failing.

---

## Appendix: Frontend API Configuration

Your frontend is static HTML/JSX. The API URL is hardcoded in [frontend/dashboard.html:16](frontend/dashboard.html#L16):

```javascript
window.NOTIFYX_API_URL = 'http://localhost:3000';
```

**After deploying to Render (Step 4.3), you have two options:**

### Option A: Manual Update (Simple, One-Time)
1. In your repo, edit `frontend/dashboard.html` line 16:
   ```javascript
   window.NOTIFYX_API_URL = 'https://notifyx-api.onrender.com';
   ```
2. Push to GitHub
3. Vercel auto-redeploys
4. Done!

### Option B: Automated with Build Script (Better for CI/CD)
Create `frontend/build.sh`:
```bash
#!/bin/bash
API_URL="${VITE_API_URL:-http://localhost:3000}"
sed -i "s|window.NOTIFYX_API_URL = '[^']*'|window.NOTIFYX_API_URL = '$API_URL'|g" dashboard.html
```

Then in Vercel dashboard:
- **Build Command:** `cd frontend && bash build.sh`
- **Output Directory:** `.` (current folder)
- **Env Var:** `VITE_API_URL` = your Render URL

This way, your frontend automatically picks up the API URL at build time.

---
