# Contributing to NotifyX

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. **Clone the repo:**
```bash
git clone https://github.com/YOUR_USERNAME/notifyx.git
cd notifyx
npm install
```

2. **Set up environment:**
```bash
# Server
cd server
cp .env.example .env
# Edit .env with your local MongoDB + Redis URLs

# Worker
cd ../worker
cp .env.example .env
# Use same REDIS_URL and MONGODB_URI as server
```

3. **Start services (3 terminals):**
```bash
# Terminal 1 — API Server
cd server && npm start

# Terminal 2 — Worker
cd worker && npm start

# Terminal 3 — Frontend (optional)
cd frontend && npx serve . -l 8080
```

## Code Style

- **JavaScript:** ES6+, use descriptive variable names
- **No semicolons** (configured in .eslintrc if added)
- **2-space indents**
- **Comments:** Only for WHY, not WHAT

### Example:
```js
// ✓ Good — explains the why
const attempts = job.attemptsMade;
if (attempts >= 5) {
  // Exhausted retries, move to DLQ
  await dlq().add(job.data);
}

// ✗ Bad — obvious from code
const attempts = job.attemptsMade; // get attempts made
```

## Commit Messages

Format: `<type>: <description>`

Types:
- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code cleanup
- `docs:` Documentation
- `test:` Tests
- `perf:` Performance improvement

Examples:
```
feat: add email notification channel
fix: prevent race condition in batch flusher
docs: update API reference with examples
refactor: extract user preference cache logic
```

## Pull Request Process

1. **Fork and create a branch:**
```bash
git checkout -b feat/your-feature-name
```

2. **Make changes:**
   - Keep commits atomic and focused
   - Test thoroughly
   - Update tests if needed
   - Update README/docs if user-facing

3. **Before pushing:**
```bash
# Run tests (if configured)
npm test

# Check for lint issues
npm run lint  # if configured

# Verify no .env files included
git status | grep .env
```

4. **Push and open PR:**
```bash
git push origin feat/your-feature-name
```

5. **PR Description:**
   - What changed and why
   - Link relevant issues
   - Describe testing done
   - Note any breaking changes

## What to Contribute

### Good Issues for First-Time Contributors
- [ ] Add more notification types (email, SMS, push)
- [ ] Improve error messages
- [ ] Add more unit tests
- [ ] Improve documentation
- [ ] Add example integrations
- [ ] Fix typos in README

### Medium Difficulty
- [ ] Add GraphQL support
- [ ] Implement webhook delivery
- [ ] Add metrics export (Prometheus)
- [ ] Improve rate limiting logic
- [ ] Add request validation middleware

### Advanced
- [ ] Multi-region replication
- [ ] Event sourcing
- [ ] Add streaming updates
- [ ] Implement scheduling service
- [ ] Database query optimization

## Testing

```bash
# Run tests (if configured)
npm test

# Test a specific file
npm test -- auth.test.js

# Watch mode
npm test -- --watch
```

## Documentation

If adding a feature, update:
- [ ] `README.md` — feature overview
- [ ] `SECURITY.md` — if security-relevant
- [ ] `DEPLOYMENT.md` — if deployment changes
- [ ] Code comments — for complex logic
- [ ] API docs — if endpoint changes

## Performance Considerations

Before submitting:
- [ ] No N+1 database queries
- [ ] Batch operations where possible
- [ ] Cache frequently accessed data
- [ ] Use indexes on large collections
- [ ] Profile with DevTools if UI changes

## Security Review Checklist

Before submitting, verify:
- [ ] No hardcoded secrets in code
- [ ] All user input validated
- [ ] No SQL/NoSQL injection possible
- [ ] Passwords hashed (bcrypt)
- [ ] Tokens properly validated
- [ ] CORS headers correct
- [ ] Rate limiting still works
- [ ] No sensitive data in logs

## Questions?

- Ask in GitHub Discussions
- Email: sumit@example.com
- Check [SECURITY.md](./SECURITY.md) for security questions
- Check [README.md](./README.md) for architecture questions

---

## License

By contributing, you agree your code will be licensed under the MIT license.

**Thanks for contributing!** ❤️
