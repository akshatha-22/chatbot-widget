# Environment Configuration Guide

## Overview

This project uses environment variables to manage configuration across development, staging, and production environments.

## Files

- **`.env.example`** (repo root) — Template only; safe to commit. Copy it to `.env.local` when setting up locally.
- **`.env.local`** (repo root) — git-ignored. **Both** runtimes use this single file:
  - Vite reads it from `client/` via `envDir: '..'` (see `client/vite.config.ts`).
  - FastAPI reads it from `backend/app/config.py`.
- **`.env`** (optional, under `backend/`) — If present, pydantic loads it first, then overlays root `.env.local`.
- **`.env.prod`** / **`.env.staging`** — Optional deployment files (git-ignored).

## Setup Instructions

### 1. Local Development Setup

From the repository root, copy `.env.example` to `.env.local` and edit values:

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your local configuration:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
BACKEND_PORT=8000
DATABASE_URL=sqlite:///./chatbot_widget.db
JWT_SECRET_KEY=dev-secret-key
```

### 2. Frontend (Vite — same root `.env.local`)

Put browser-exposed vars in the **root** `.env.local`; Vite discovers them automatically when you run `npm run dev` from the repo (`cd client && vite` loads `envDir: ..`).

```env
# API Configuration (must include VITE_ prefix)
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws

# Environment
VITE_ENV=development
```

**Frontend variables must be prefixed with `VITE_` to be injected into client code.**

Do **not** maintain a duplicate `client/.env.local`; it is ignored intentionally.

### 3. Backend Configuration

The backend reads from `.env.local` in the project root:

```env
# Server
BACKEND_PORT=8000
ENVIRONMENT=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/chatbot_widget
# Or for local dev:
DATABASE_URL=sqlite:///./chatbot_widget.db

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

## Environment Variables Reference

### Frontend (VITE_*)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8000` |
| `VITE_WS_URL` | WebSocket URL for real-time updates | `ws://localhost:8000/ws` |
| `VITE_ENV` | Environment (development/production) | `development` |
| `VITE_ENABLE_ANALYTICS` | Enable analytics tracking | `false` |
| `VITE_ENABLE_SENTRY` | Enable error tracking | `false` |

### Backend - Server

| Variable | Description | Default |
|----------|-------------|---------|
| `BACKEND_HOST` | Server host | `0.0.0.0` |
| `BACKEND_PORT` | Server port | `8000` |
| `ENVIRONMENT` | Environment type | `development` |

### Backend - Database

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | `postgresql://user:pass@localhost/db` |
| `DATABASE_POOL_SIZE` | Connection pool size | `20` |
| `DATABASE_MAX_OVERFLOW` | Max overflow connections | `10` |

### Backend - Redis

| Variable | Description | Example |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `REDIS_CACHE_TTL` | Cache TTL in seconds | `3600` |

### Backend - Security

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET_KEY` | JWT signing key | `your-secret-key` |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` |
| `JWT_EXPIRATION_HOURS` | Token expiration | `24` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:5173` |

### Backend - LLM/AI

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `OPENAI_MODEL` | Model to use | `gpt-4` |
| `OPENAI_MAX_TOKENS` | Max tokens | `2048` |
| `OPENAI_TEMPERATURE` | Temperature | `0.7` |

### Backend - File Upload

| Variable | Description | Example |
|----------|-------------|---------|
| `MAX_UPLOAD_FILE_SIZE` | Max file size in bytes | `10485760` (10MB) |
| `ALLOWED_FILE_TYPES` | Allowed file extensions | `pdf,doc,docx,txt` |
| `UPLOAD_DIRECTORY` | Upload directory path | `./uploads` |

## Local Development

For local development, `.env.local` is already created with safe defaults. Just run:

```bash
npm run dev        # Frontend
python app/main.py # Backend (in another terminal)
```

## Production Deployment

1. Create `.env.prod` with production values
2. Set secure values for:
   - `JWT_SECRET_KEY` - Generate a strong random key
   - `DATABASE_URL` - Use production database
   - `OPENAI_API_KEY` - Use production API key
   - `CORS_ORIGINS` - Set to your domain

Example production setup:
```bash
# Use with Docker or deployment script
export $(cat .env.prod | xargs)
python app/main.py
```

## Security Best Practices

1. ✅ **Never commit `.env` files** - They're in `.gitignore`
2. ✅ **Use `.env.example`** - Share this as a template
3. ✅ **Generate strong secrets** - Use `openssl rand -base64 32` for JWT_SECRET_KEY
4. ✅ **Different keys per environment** - Dev, staging, and prod should have different secrets
5. ✅ **Rotate secrets regularly** - Especially API keys and JWT secrets
6. ✅ **Use environment-specific values** - Don't copy dev settings to production

## Troubleshooting

### Variables not loading

Check that:
- `.env.local` exists in the project root (one file for Vite + backend)
- Variables are properly formatted: `KEY=value`
- Frontend variables start with `VITE_`
- Restart the **dev server(s)** after changes (both Vite and Uvicorn)

### Frontend can't reach backend

- Check `VITE_API_URL` matches backend `BACKEND_PORT`
- Verify CORS origins include frontend URL
- Check both services are running

### Database connection failed

- Verify `DATABASE_URL` format
- Check database service is running
- For SQLite: ensure `./` path exists or use absolute path

## References

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-config.html)
- [Python-dotenv Documentation](https://python-dotenv.readthedocs.io/)
- [FastAPI Environment Variables](https://fastapi.tiangolo.com/advanced/settings/)
