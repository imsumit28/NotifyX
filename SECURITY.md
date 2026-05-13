# Security Guidelines

## ⚠️ Before Deploying to Production

### 1. Environment Variables
**NEVER commit `.env` files to Git.** Always use environment variables for secrets:

```bash
# ✗ Wrong — do not do this
git add .env
git commit -m "Add env vars"

# ✓ Correct — only commit .env.example
git add .env.example
git commit -m "Add env var template"
```

All sensitive keys must be set via:
- Cloud provider dashboard (Render, Vercel, AWS, etc.)
- CI/CD secrets (GitHub Actions, GitLab CI, etc.)
- Local `.env` file (for development only, never committed)

### 2. Required Secrets

Generate strong secrets before production deployment:

```bash
# Generate JWT_SECRET (32+ chars)
openssl rand -hex 32

# Generate ADMIN_SECRET (only needed for legacy /api/auth/token)
openssl rand -hex 16
```

Update your `.env`:
```env
JWT_SECRET=your-generated-secret-here
ADMIN_SECRET=your-generated-admin-secret
```

### 3. Environment Variables Checklist

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `PORT` | No | 3000 | API server port |
| `NODE_ENV` | No | development | Set to `production` for deploy |
| `REDIS_URL` | Yes | — | Use `rediss://` (TLS) for production |
| `MONGODB_URI` | Yes | — | Use `mongodb+srv://` (Atlas) for production |
| `JWT_SECRET` | Yes | — | Generate with openssl, min 32 chars |
| `ADMIN_SECRET` | No | notifyx-demo | For legacy API key endpoint |
| `CORS_ORIGIN` | Yes | * | Set to your frontend URL (not `*` in prod) |
| `LOG_LEVEL` | No | info | `debug`, `info`, `warn`, `error` |
| `WORKER_ID` | No | worker-1 | Unique ID per worker instance |
| `WORKER_CONCURRENCY` | No | 5 | Jobs per worker |

### 4. Database Credentials

**MongoDB Atlas:**
```
✓ Use IP whitelist (not 0.0.0.0/0)
✓ Use strong passwords (min 20 chars, mixed case + numbers + symbols)
✓ Enable two-factor authentication (2FA)
✓ Rotate credentials regularly
✗ Never hardcode credentials in code
```

**Redis/Upstash:**
```
✓ Use rediss:// (TLS encrypted)
✓ Set IP whitelist for database
✓ Rotate API tokens annually
✗ Never expose tokens in logs or client code
```

### 5. API Keys

API keys are managed in the dashboard (`POST /api/keys`):

```bash
# Create API key (admin only)
curl -X POST http://localhost:3000/api/keys \
  -H "x-admin-secret: ${ADMIN_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"appName": "my-website"}'

# Response: { "key": "nx_...", "note": "Save this — shown once only" }
```

**Best practices:**
- ✓ Treat API keys like passwords — store securely
- ✓ Rotate keys every 90 days
- ✓ Use different keys per environment (dev, staging, prod)
- ✓ Revoke keys immediately if exposed
- ✗ Never commit keys to Git
- ✗ Never paste keys in logs or error messages
- ✗ Never share keys via chat/email (use secret management)

### 6. JWT Token Security

JWT tokens are issued after login/signup and expire after 7 days.

**Frontend security:**
```js
// ✓ Correct — store in localStorage (this demo)
localStorage.setItem('jwt_token', token);

// Consider httpOnly cookies in production
// (requires backend to set Set-Cookie header)
```

**Backend security:**
```js
// ✓ Validate JWT signature
jwt.verify(token, JWT_SECRET);

// ✓ Check expiration
// (done automatically by jwt.verify)

// ✗ Never expose JWT_SECRET in client code
// ✗ Never log JWT tokens
```

### 7. Rate Limiting

Default rate limits are configured:
- **Global:** 10,000 requests/minute (per API)
- **Per-user:** 50 notifications/minute per recipient

Adjust in `server/src/middleware/rateLimiter.js` for your use case.

### 8. Idempotency

All notifications require an `idempotencyKey` to prevent duplicates:

```js
// ✓ Correct — unique key per notification
const idempotencyKey = crypto.randomUUID();

// ✗ Wrong — reusing keys
const idempotencyKey = 'static-key';
```

### 9. CORS Configuration

**Development:**
```env
CORS_ORIGIN=http://localhost:8080
```

**Production:**
```env
CORS_ORIGIN=https://yourdomain.com
```

Never use `CORS_ORIGIN=*` in production — it allows any website to access your API.

### 10. Logging & Monitoring

**DO NOT log:**
- ✗ Passwords
- ✗ JWT tokens
- ✗ API keys
- ✗ Database credentials
- ✗ User sensitive data

**DO log:**
- ✓ Error messages (sanitized)
- ✓ Request paths and methods
- ✓ Response status codes
- ✓ Request/response times
- ✓ User IDs (not passwords)

### 11. Secrets in This Repo

Files that should NEVER be committed:
- `server/.env` (development config with real secrets)
- `worker/.env` (development config with real secrets)
- `*.key`, `*.pem` (SSL/TLS certificates)
- `.env.production.local` (production overrides)

Files that SHOULD be committed:
- `.env.example` (template with placeholder values)
- `.gitignore` (exclusion rules)
- `SECURITY.md` (this file)

### 11.1 Local Git Protection (Required)

This repo includes local Git hooks that block commits/pushes when secret-like content or key files are detected.

Enable hooks once per clone:

```bash
npm run setup:hooks
```

Manual scan commands:

```bash
# scan staged files
npm run scan:secrets:staged

# scan files changed compared to upstream branch
npm run scan:secrets:range
```

### 12. Security Checklist Before Deployment

- [ ] `.env` files NOT committed to Git
- [ ] `npm run setup:hooks` executed in local clone
- [ ] `JWT_SECRET` is unique (generated with openssl)
- [ ] `MONGODB_URI` uses `mongodb+srv://` and IP whitelist
- [ ] `REDIS_URL` uses `rediss://` (TLS) for Upstash
- [ ] `CORS_ORIGIN` is set to your frontend domain (not `*`)
- [ ] `NODE_ENV=production`
- [ ] Database backups enabled
- [ ] Redis backups enabled (if using Upstash)
- [ ] 2FA enabled on all cloud accounts (MongoDB, Upstash, etc.)
- [ ] API keys rotated if ever exposed
- [ ] Rate limiting tested
- [ ] HTTPS/TLS enabled on frontend and API
- [ ] Error messages don't expose internal paths
- [ ] Logs don't contain sensitive data

### 13. If You Accidentally Expose Secrets

**Immediately:**
1. Rotate all exposed credentials (JWT_SECRET, API keys, database passwords)
2. Check logs for unauthorized access
3. If on GitHub, use BFG Repo-Cleaner or git-filter-branch to remove from history
4. Enable 2FA on cloud accounts
5. Force re-login for all sessions

### 14. Reporting Security Issues

If you find a security vulnerability:
1. **DO NOT** open a public GitHub issue
2. Email: [security@notifyx.dev] (replace with your contact)
3. Include: description, reproduction steps, severity
4. We'll respond within 48 hours

---

**Last Updated:** 2026-05-01
**Built by:** Sumit Kumar
