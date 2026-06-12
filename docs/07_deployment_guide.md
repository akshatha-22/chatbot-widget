# Deployment Guide

How to run and deploy **Remi** using the **actual** stack in this repository.

| Topic | Doc |
|-------|-----|
| Implementation | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Env vars (full list) | [../README.md](../README.md#environment-variables) |

---

## 1. Overview

| Layer | Production (live) | Local dev |
|-------|-------------------|-----------|
| Frontend | **Vercel** — https://chatbot-widget-client.vercel.app | Vite `npm run dev` :5173 |
| Backend | **Railway** — https://chatbot-widgetclient-production.up.railway.app | Uvicorn :8000 |
| Database | Managed **PostgreSQL** on Railway | **SQLite** (`sqlite:///./chatbot.db`) |
| Vector / uploads | **PostgreSQL blobs** + optional disk cache | `backend/data/` |

**Deployment hardening:** complete — `VITE_API_URL` on Vercel, `ENVIRONMENT=production` on Railway, `CORS_ORIGINS` aligned with Vercel domain.

**Not required:** Redis, RabbitMQ, Kubernetes, Docker Compose (root `docker-compose.yml` is empty).

---

## 2. Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ (CI uses 3.12) |
| Node.js | 18+ (CI uses 22) |
| npm | 9+ |
| Gemini API key | [Google AI Studio](https://aistudio.google.com/apikey) |

---

## 3. Local development

See [README Quick Start](../README.md#quick-start). Minimum `.env.local`:

```env
GEMINI_API_KEY=your_key_here
SECRET_KEY=your-random-string-at-least-32-characters-long
ENVIRONMENT=development
DATABASE_URL=sqlite:///./chatbot.db
VITE_API_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

---

## 4. Production: Frontend (Vercel)

### 4.1 Build settings

Root `vercel.json`:

```json
{
  "installCommand": "npm ci",
  "buildCommand": "npm run build",
  "outputDirectory": "client/dist"
}
```

### 4.2 Environment variables (Vercel dashboard)

| Variable | Required | Example |
|----------|----------|---------|
| `VITE_API_URL` | Yes | `https://chatbot-widgetclient-production.up.railway.app` |

Rules:

- Use **https**, no trailing slash.
- Set on **Production** (and Preview if you test PRs).
- **Redeploy after changing** — value is baked at build time.

### 4.3 GitHub Actions deploy

`.github/workflows/deploy.yml` deploys frontend after CI on `main`. Requires secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VITE_API_URL`.

---

## 5. Production: Backend (Railway)

| File | Purpose |
|------|---------|
| `backend/Dockerfile` | Production image |
| `backend/railway.toml` | Build/deploy config, `/health` check |

### 5.1 Railway variables (required)

| Variable | Example / notes |
|----------|-----------------|
| `SECRET_KEY` | Strong random string (min 32 chars) — **generate new for prod** |
| `ENVIRONMENT` | `production` (enables HSTS) |
| `GEMINI_API_KEY` | Google AI Studio key |
| `DATABASE_URL` | From Railway **PostgreSQL** plugin |
| `CORS_ORIGINS` | `https://your-app.vercel.app` |

### 5.2 Railway variables (recommended)

| Variable | Default | Notes |
|----------|---------|-------|
| `GEMINI_DAILY_QUOTA_PER_USER` | `100` | `0` = unlimited |
| `AUTH_RATE_LIMIT_ENABLED` | `true` | Per-IP login/signup protection |
| `AUTH_RATE_LIMIT_MAX_ATTEMPTS` | `5` | |
| `AUTH_RATE_LIMIT_WINDOW_SECONDS` | `60` | Sliding window |
| `CLOUDFLARE_ONLY` | `false` | Set `true` if API is behind Cloudflare |

### 5.3 Verify deployment

**Health body** (use `https://`):

```powershell
curl.exe -sS "https://YOUR-RAILWAY-URL.up.railway.app/health"
```

Expect: `{"status":"healthy"}`

**Security headers** (`/health` supports GET only, not HEAD):

```powershell
curl.exe -sS -D - -o NUL "https://YOUR-RAILWAY-URL.up.railway.app/health"
```

With `ENVIRONMENT=production` and latest backend deployed, expect:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

If headers are missing, redeploy from latest `main` and confirm `ENVIRONMENT=production`.

### 5.4 Schema & migrations

On startup:

1. `Base.metadata.create_all()` creates tables (including `audit_logs`)
2. `app/database/migrations/startup.py` applies idempotent column/index patches
3. Optional: `alembic upgrade head` using `app/database/migrations/versions/20250603_0001_*.py`

FAISS data persists in PostgreSQL: `uploaded_files.faiss_index_blob`, `chunks_blob`, `embedding_model_version`.

---

## 6. End-to-end production smoke test

1. Open Vercel production URL (not localhost).
2. Sign up / log in inside widget.
3. Send a chat message — streaming reply.
4. Upload a `.txt` file — wait for **Ready**.
5. Delete the file from Files panel — confirm inline, see success toast.
6. DevTools → Network: API calls hit Railway HTTPS URL.
7. Console: no CORS errors.

---

## 7. Environment configuration reference

### Read by application code

| Variable | Required prod | Default / notes |
|----------|---------------|-----------------|
| `SECRET_KEY` | **Yes** (min 32 chars) | No default |
| `ENVIRONMENT` | `production` | `development` |
| `GEMINI_API_KEY` | For real AI | Empty → fallback |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` |
| `GEMINI_DAILY_QUOTA_PER_USER` | No | `100` |
| `RESPONSE_CACHE_ENABLED` | No | `true` |
| `RESPONSE_CACHE_TTL_SECONDS` | No | `3600` |
| `RESPONSE_CACHE_MAX_SIZE` | No | `500` |
| `AUTH_RATE_LIMIT_ENABLED` | No | `true` |
| `AUTH_RATE_LIMIT_MAX_ATTEMPTS` | No | `5` |
| `AUTH_RATE_LIMIT_WINDOW_SECONDS` | No | `60` |
| `CLOUDFLARE_ONLY` | No | `false` |
| `OPENAI_API_KEY` | No | Fallback LLM |
| `DATABASE_URL` | Postgres recommended | `sqlite:///./chatbot.db` |
| `CORS_ORIGINS` | Prod Vercel URL | Localhost Vite ports |
| `CORS_ORIGIN_REGEX` | No | `https://.*\.vercel.app` |
| `VITE_API_URL` | Frontend build | `http://localhost:8000` |

### In `.env.example` but **not used** by app

`REDIS_URL`, `VITE_WS_URL`, `JWT_SECRET_KEY`, `AWS_*`, `SMTP_*`, `SENTRY_DSN`, legacy `RATE_LIMIT_*`, etc.

---

## 8. CI/CD

### CI (`.github/workflows/ci.yml`)

- Backend: `pytest tests/` (105 tests)
- Frontend: `npm run type-check`, `npm run build`

### Deploy (`.github/workflows/deploy.yml`)

- Frontend → Vercel (after CI on `main`)
- Backend → Railway separately (GitHub integration or `railway up`)

---

## 9. CORS checklist

1. Add exact Vercel production URL to Railway `CORS_ORIGINS`.
2. Include `localhost` and `127.0.0.1` variants for local dev.
3. Preview deploys match default `CORS_ORIGIN_REGEX` (`https://.*\.vercel.app`).

---

## 10. Health checks & monitoring

| Endpoint | Response |
|----------|----------|
| `GET /health` | `{"status":"healthy"}` |
| `GET /` | Welcome JSON + docs link |

**Not implemented:** Prometheus, Sentry (unless you add it), structured log shipping.

Use Railway logs for `[RAG]`, `[EMBED]`, `[FAISS]`, sanitization info lines.

---

## 11. Scaling notes

| Concern | Guidance |
|---------|----------|
| In-memory rate limit / cache | Per Railway replica — upgrade to Redis when `numReplicas > 1` |
| FAISS | Indexes in Postgres blobs; memory cache per process |
| Auth rate limit | Set `AUTH_RATE_LIMIT_ENABLED=false` temporarily if debugging lockouts |

---

## 12. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `301` on curl without `https://` | Use `curl.exe -sS https://...` |
| Wrong health JSON (`RDF AB Challenge`, etc.) | Wrong Railway service URL — use Remi API URL |
| Widget calls `localhost:8000` in prod | Set `VITE_API_URL` on Vercel, **redeploy** |
| CORS error | Add Vercel URL to Railway `CORS_ORIGINS` |
| No security headers | `ENVIRONMENT=production` + redeploy latest backend |
| Login 429 | Auth rate limit — wait 60s |
| Gemini 429 | Daily quota — UI uses `reset_at` from server |

---

## 13. Production checklist (completed)

- [x] Railway: `SECRET_KEY`, `GEMINI_API_KEY`, `DATABASE_URL` (Postgres), `ENVIRONMENT=production`
- [x] Railway: `CORS_ORIGINS` = Vercel production URL
- [x] Vercel: `VITE_API_URL` = `https://chatbot-widgetclient-production.up.railway.app`; redeploy completed
- [x] `curl.exe -sS https://chatbot-widgetclient-production.up.railway.app/health` → `{"status":"healthy"}`
- [x] Security headers + HSTS visible on `/health`
- [x] Smoke: signup → chat → upload → delete file on https://chatbot-widget-client.vercel.app

---

## Related

- [01_system_overview.md](./01_system_overview.md)
- [03_features_capabilities.md](./03_features_capabilities.md)
- [05_project_structure(with_optional_enhancements).md](./05_project_structure(with_optional_enhancements).md)
