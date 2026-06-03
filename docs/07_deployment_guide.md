# Deployment Guide

How to run and deploy **Remi** using the **actual** stack in this repository.

| Topic | Doc |
|-------|-----|
| Implementation | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Env vars (full list) | [../README.md](../README.md#environment-variables) |

---

## 1. Overview

| Layer | Typical production | Local dev |
|-------|-------------------|-----------|
| Frontend | **Vercel** (static `client/dist`) | Vite `npm run dev` :5173 |
| Backend | **Render** (CI hook) or **Railway** (Dockerfile) | Uvicorn :8000 |
| Database | Managed **PostgreSQL** | **SQLite** (`sqlite:///./chatbot.db`) |
| Vector / uploads | **Local disk** on API server | `backend/data/` |

**Not required:** Redis, RabbitMQ, Kubernetes, Docker Compose (root `docker-compose.yml` is empty).

---

## 2. Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ (CI uses 3.12) |
| Node.js | 18+ (CI uses 22) |
| npm | 9+ |
| Gemini API key | [Google AI Studio](https://aistudio.google.com/apikey) |

PostgreSQL and Redis are **optional** for local development.

---

## 3. Local development

### 3.1 Environment

Copy env at **repo root** (shared by backend and Vite):

```bash
cp .env.example .env.local
```

Minimum for AI replies:

```env
GEMINI_API_KEY=your_key_here
DATABASE_URL=sqlite:///./chatbot.db
VITE_API_URL=http://localhost:8000
SECRET_KEY=change-me-to-a-long-random-string
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

> Backend reads `SECRET_KEY`, not `JWT_SECRET_KEY` from the example file.

### 3.2 Backend

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Verify:

- http://127.0.0.1:8000/health → `{"status":"healthy"}`
- http://127.0.0.1:8000/docs → OpenAPI UI

Tables are created automatically via `Base.metadata.create_all` in `main.py` (no Alembic migration folder shipped).

### 3.3 Frontend

From repo root:

```bash
npm ci
npm run dev
```

Open http://127.0.0.1:5173 — sign up inside the widget.

**No Vite proxy:** the browser calls `VITE_API_URL` directly; CORS must allow your dev origin.

### 3.4 Windows notes

- Stop `npm run dev` before `npm ci` if `esbuild.exe` is locked (EPERM).
- Use PowerShell `;` instead of `&&` if chaining commands fails.

---

## 4. Production: Vercel (frontend)

### 4.1 Build settings

Root `vercel.json`:

```json
{
  "installCommand": "npm ci",
  "buildCommand": "npm run build",
  "outputDirectory": "client/dist"
}
```

Deploy from the **repository root** so install sees the workspace `package-lock.json`.

### 4.2 Environment variables (Vercel dashboard)

| Variable | Required | Example |
|----------|----------|---------|
| `VITE_API_URL` | Yes | `https://your-api.onrender.com` or Railway URL |

Rules:

- Use **https**, no trailing slash.
- Set on **Production** (and Preview if you test PRs).
- Redeploy after changing — value is baked at build time via `vite.config.ts` `define`.

### 4.3 Monorepo upload limit

If deploy fails with too many files, use root `.vercelignore` (already in repo) to exclude `backend/data`, `.ci-venv`, etc.

---

## 5. Production: Backend

### 5.1 Render (CI default)

`.github/workflows/deploy.yml` posts to `RENDER_DEPLOY_HOOK` when the secret is set.

On Render:

1. Web service, Docker or Python environment.
2. Set environment variables (see §7).
3. Add deploy hook URL to GitHub secret `RENDER_DEPLOY_HOOK`.

### 5.2 Railway (supported in repo)

| File | Purpose |
|------|---------|
| `backend/Dockerfile` | Production image (CPU torch, `requirements-docker.txt`) |
| `backend/railway.toml` | Railway config |
| `backend/railway.toml` / Dockerfile | Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

Set Railway variables:

- `DATABASE_URL` (Railway Postgres; `postgres://` auto-normalized to `postgresql://`)
- `GEMINI_API_KEY`
- `SECRET_KEY`
- `CORS_ORIGINS` — your Vercel URL(s)
- Optional: rely on default `https://.*\.vercel.app` regex for preview apps

Point Vercel `VITE_API_URL` to the Railway public URL.

### 5.3 Persistent disk

Uploads and FAISS indices live under `backend/data/`:

- `data/uploads/`
- `data/vector_store/`

On ephemeral containers, **uploads are lost on redeploy** unless you attach persistent volume or move to object storage (not implemented in code).

---

## 6. Database

### SQLite (local only)

```env
DATABASE_URL=sqlite:///./chatbot.db
```

File is created relative to the **backend working directory** when you start uvicorn from `backend/`.

### PostgreSQL (production)

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

`config.py` normalizes `postgres://` → `postgresql://` for SQLAlchemy.

No migration scripts in repo — schema comes from `create_all` on startup. For existing production DBs, coordinate schema changes manually or add Alembic later.

---

## 7. Environment configuration reference

### Read by application code

| Variable | Required prod | Default / notes |
|----------|---------------|-----------------|
| `SECRET_KEY` | **Yes** | Dev placeholder in code if unset — **must override in prod** |
| `GEMINI_API_KEY` | For real AI | Empty → fallback messages |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` |
| `OPENAI_API_KEY` | No | Fallback LLM |
| `DATABASE_URL` | No | `sqlite:///./chatbot.db` |
| `CORS_ORIGINS` | No | Localhost Vite ports |
| `CORS_ORIGIN_REGEX` | No | `https://.*\.vercel.app` |
| `VITE_API_URL` | Frontend build | `http://localhost:8000` |

### In `.env.example` but **not used** by app

`REDIS_URL`, `VITE_WS_URL`, `JWT_SECRET_KEY`, `AWS_*`, `SMTP_*`, `RATE_LIMIT_*`, etc.

---

## 8. CI/CD

### CI (`.github/workflows/ci.yml`)

On push/PR to `main` / `develop`:

1. Backend: `pip install -r requirements-ci.txt`, `pytest` in `backend/`
2. Frontend: `npm ci`, `npm run type-check`, `npm run build`

### Deploy (`.github/workflows/deploy.yml`)

After successful CI on `main`:

1. `curl` Render deploy hook (if configured)
2. Vercel production deploy with `VITE_API_URL` from secrets

Required GitHub secrets for full deploy:

| Secret | Purpose |
|--------|---------|
| `VERCEL_TOKEN` | Vercel CLI |
| `VERCEL_ORG_ID` | Vercel team |
| `VERCEL_PROJECT_ID` | Vercel project |
| `VITE_API_URL` | Production API URL for frontend build |
| `RENDER_DEPLOY_HOOK` | Optional Render trigger |

---

## 9. CORS checklist

Production errors often look like:

> Access to fetch … has been blocked by CORS policy

Fix:

1. Add exact Vercel URL to Railway/Render `CORS_ORIGINS`, e.g.  
   `https://remi-zeta-nine.vercel.app`
2. Include both `localhost` and `127.0.0.1` variants for local dev.
3. Preview deployments match default regex `https://.*\.vercel.app` unless disabled.

---

## 10. Health checks & monitoring

| Endpoint | Response |
|----------|----------|
| `GET /health` | `{"status":"healthy"}` |
| `GET /` | Welcome JSON |

**Not implemented:** Prometheus metrics, structured logging service, Sentry (unless you add it).

Use platform logs (Vercel, Render, Railway) for API errors. Backend prints `[RAG]`, `[EMBED]`, `[FAISS]` diagnostic lines to stdout.

---

## 11. Scaling & performance

| Concern | Guidance |
|---------|----------|
| Concurrent users | Prefer PostgreSQL; scale API replicas; note FAISS is local per instance |
| Large uploads | 100MB cap; embedding is CPU-heavy |
| Gemini quota | Users see fallback text mentioning quota / API key |
| SSE | Long-lived connections; configure platform timeout > chat duration |

Horizontal scaling **without shared disk** means each replica has its own FAISS files — uploads on instance A are invisible on B unless you use shared storage.

---

## 12. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ERR_CONNECTION_REFUSED` on :8000 | API not running | Start uvicorn from `backend/` |
| Postgres auth failed on start | Bad `DATABASE_URL` | Use SQLite locally or fix credentials |
| CORS error from Vercel | Origin not allowed | Update `CORS_ORIGINS` on API |
| Widget calls `localhost:8000` in prod | `VITE_API_URL` not set at build | Set in Vercel, redeploy |
| File stuck `pending` | Embedding failed or server restarted | Check API logs; re-upload |
| Chat returns fallback text | Missing/invalid `GEMINI_API_KEY` | Set key, restart API |
| `npm ci` fails on Vercel | Wrong root directory | Deploy from monorepo root |
| Stream continues after close | Known gap | `close()` does not abort — see ARCHITECTURE.md |

---

## 13. Optional: Docker (scaffold)

`backend/Dockerfile` is used for Railway-style deploys. Additional files under `docker/` and `docker-compose.prod.yml` are **samples** — not the primary path documented in CI.

To experiment locally with Docker:

```bash
# Build from backend folder — see Dockerfile for context
docker build -f backend/Dockerfile -t remi-api ./backend
```

Ensure `GEMINI_API_KEY`, `SECRET_KEY`, and `DATABASE_URL` are passed at runtime.

---

## 14. Optional: Kubernetes

Manifests under `docker/kubernetes/` are **not** maintained as the production deployment path. Use only if you operate your own cluster and adapt env/volumes for `backend/data`.

---

## 15. Pre-production checklist

- [ ] `SECRET_KEY` is a strong random value (not default)  
- [ ] `GEMINI_API_KEY` set on API host  
- [ ] `DATABASE_URL` points to PostgreSQL  
- [ ] `CORS_ORIGINS` includes production Vercel URL  
- [ ] `VITE_API_URL` on Vercel matches API HTTPS URL  
- [ ] Persistent volume or accept ephemeral uploads  
- [ ] GitHub secrets set for deploy workflow  
- [ ] Smoke test: signup → chat → upload → RAG question  

---

## Related

- [01_system_overview.md](./01_system_overview.md)  
- [05_project_structure(with_optional_enhancements).md](./05_project_structure(with_optional_enhancements).md)  
