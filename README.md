# Remi — AI Chatbot Widget

A self-contained, embeddable chat widget powered by **Remi**, a warm minimal AI assistant. Users sign in inside the widget, chat with streaming responses, upload documents for RAG-backed answers, export conversations, and generate PDFs—either from the Generate panel or directly in chat with natural language.

**Repository:** [github.com/Akshatha-22/chatbot-widget](https://github.com/Akshatha-22/chatbot-widget)  
**Live demo:** [chatbot-widget-client.vercel.app](https://chatbot-widget-client.vercel.app)  
**API (Railway):** [chatbot-widgetclient-production.up.railway.app](https://chatbot-widgetclient-production.up.railway.app)

This README reflects **what is in the repository today**.

---

## Table of Contents

1. [What This Project Is](#what-this-project-is)
2. [Tech Stack](#tech-stack)
3. [Quick Start](#quick-start)
4. [Architecture](#architecture)
5. [Features](#features)
6. [Project Structure](#project-structure)
7. [Environment Variables](#environment-variables)
8. [API Reference](#api-reference)
9. [Testing & CI](#testing--ci)
10. [Deployment](#deployment)
11. [Troubleshooting](#troubleshooting)

---

## What This Project Is

**Remi** is a floating chatbot widget (React + Vite) backed by a FastAPI API. It drops onto any page: an animated launcher opens a compact chat panel, which can expand into a full workspace with conversation history, file uploads, and document generation.

| Layer | Role |
| --- | --- |
| **Frontend** (`client/`) | React SPA — no router; `App.tsx` renders only the widget |
| **Backend** (`backend/app/`) | FastAPI REST + SSE streaming, JWT auth, RAG, LLM orchestration |
| **Data** | SQLite by default; PostgreSQL via `DATABASE_URL` |
| **Vector store** | **Gemini `gemini-embedding-001`** (768-dim) + **pgvector** in PostgreSQL `embeddings` table; keyword fallback when embedding API fails |

There is **no** LangChain, Redis, Celery, WebSocket server, or Kubernetes runtime in the live codebase. Prompt-injection sanitization, audit logging, and auth rate limiting **are** implemented (see [Auth & security](#auth--security)).

---

## Tech Stack (Actual)

### Frontend (`client/`)

| Technology | Used for |
| --- | --- |
| React 18 + TypeScript | UI |
| Vite 4 | Dev server & production build |
| Tailwind CSS 3 + `@tailwindcss/typography` | Styling |
| Framer Motion | `RemiSphere` launcher animation |
| Axios | HTTP client (`api/client.ts`) |
| lucide-react | Icons |
| react-markdown + remark-gfm | Assistant message rendering |
| jsPDF | Client-side PDF download |
| Radix UI (`dropdown-menu`, `popover`, `tooltip`) | Menus, tooltips on nav buttons |

### Backend (`backend/app/`)

| Technology | Used for |
| --- | --- |
| FastAPI + Uvicorn | HTTP API |
| SQLAlchemy 2 | ORM — models in `database/db.py` |
| Pydantic + pydantic-settings | Schemas & config (`config.py`) |
| python-jose + bcrypt | JWT auth (`core/security.py`) |
| google-genai | Primary Gemini client with Google Search grounding |
| google-generativeai | Legacy Gemini fallback |
| OpenAI SDK | Fallback when Gemini unavailable |
| pgvector (PostgreSQL) | Cosine-similarity vector search over `embeddings` rows |
| cachetools | In-process TTL response cache (no Redis) |
| PyPDF2, python-docx, openpyxl | File text extraction |
| python-magic | Magic-byte MIME validation on uploads |

### Infrastructure

| Tool | Purpose |
| --- | --- |
| GitHub Actions (`.github/workflows/ci.yml`) | pytest + frontend type-check/build on `main` / `develop` |
| GitHub Actions (`.github/workflows/deploy.yml`) | Vercel frontend deploy (backend deploys on **Railway**, not via this workflow) |

---

## Quick Start

### Prerequisites

- **Python 3.12** (3.11+ works locally; CI uses 3.12)
- **Node.js 22** recommended (CI uses 22; 18+ works locally)
- A [Google AI Studio](https://aistudio.google.com/apikey) API key (`GEMINI_API_KEY`) for real AI replies

### Setup

```bash
# 1. Clone and enter the repo
git clone https://github.com/Akshatha-22/chatbot-widget.git
cd chatbot-widget

# 2. Environment — repo root (shared by backend + Vite)
cp .env.example .env.local
# Edit .env.local — minimum:
#   GEMINI_API_KEY=your_key_here
#   SECRET_KEY=<random-string-at-least-32-chars>   # required — no insecure default
#   ENVIRONMENT=development

# 3. Backend
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate
pip install -r requirements.txt

# 4. Frontend (from repo root)
cd ..
npm ci

# 5. Run (two terminals)
# Terminal 1 — API
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — Widget (from repo root)
cd client
npm run dev
# Open http://127.0.0.1:5173
```

Sign up inside the widget, click the Remi launcher, and start chatting.

> **Windows tip:** Stop `npm run dev` before running `npm ci` — Vite locks `esbuild.exe` and causes `EPERM` errors.

---

## Architecture

**Deep-dive (code-level):** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — request lifecycle, RAG, SSE, auth, schema, security, tests, and known gaps with file/line references.

**Diagrams & overview:** [docs/01_system_overview.md](docs/01_system_overview.md) · [docs/02_architecture_diagrams.md](docs/02_architecture_diagrams.md)

```
┌─────────────────────────────────────────────────────────────┐
│  Browser — React widget (client/)                           │
│  main.tsx → App.tsx → FloatingWidget → ChatbotWidget        │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │ RemiLauncher│→ │ CompactWidget│→ │ ExpandedWidget    │   │
│  │ (animated)  │  │ (350px chat) │  │ (sidebar + panels)│   │
│  └─────────────┘  └──────────────┘  └───────────────────┘   │
│         │ WidgetAuthPanel (login/signup inside widget)      │
└─────────┼───────────────────────────────────────────────────┘
          │ REST + SSE (JWT Bearer token)
          ▼
┌─────────────────────────────────────────────────────────────┐
│  FastAPI (backend/app/main.py)                              │
│  /api/v1/auth/*    signup, login, me                        │
│  /api/v1/chat/*    conversations, messages, stream, generate│
│  /api/v1/chat/conversations/{id}/files  upload, list, delete│
│  /api/v1/admin/embedding-health  per-user index version health  │
└─────────┼───────────────────────────────────────────────────┘
          │
    ┌─────┴─────┬──────────────┐
    ▼           ▼              ▼
 SQLite/     pgvector        Gemini (google-genai)
 PostgreSQL  embeddings      + OpenAI fallback
             table           + TTL response cache
```

### Normal chat flow

1. User sends a message → frontend calls `POST …/messages/stream` (SSE via `streamSend.ts`).
2. Backend saves the user message, streams Gemini tokens, persists the assistant reply.
3. Frontend appends chunks live; a final `done` event replaces the placeholder with the saved message.

### PDF intent flow

1. `detect_pdf_request()` in `chat_service.py` matches phrases like *"generate a pdf with the recipe"* or *"export this as pdf"*.
2. Backend skips normal chat; calls the LLM once to produce structured markdown.
3. Assistant message is saved with `has_pdf`, `pdf_content`, `pdf_filename`.
4. Frontend auto-downloads via `jsPDF` (`pdfGenerator.ts`) and shows a **Download PDF again** button.

### RAG flow

1. User uploads PDF, DOCX, XLSX, or plain text to a conversation.
2. Backend validates MIME type + size, saves bytes to `backend/data/uploads/`, and queues embedding (`status=pending`).
3. Background processing: `extracting` → `embedding` → `processed` (or `failed`). Progress appears in `status_detail` (e.g. "Reading 256 pages…", "OCR page 12 of 256…").
4. **PDF extraction:** PyMuPDF reads all pages in parallel; Gemini OCR fills image-only pages (no page cap). Page-marked PDFs get **one embedding chunk per page** in the `embeddings` table with a `page` column.
5. **Embeddings:** Gemini `gemini-embedding-001` (768-dim) stored in PostgreSQL via pgvector cosine search. Stale rows (model version mismatch) are **auto-reindexed** before search.
6. **Document-first routing:** `_prepare_assistant_context()` checks uploaded files before web search. Page queries ("what's on page 115") use direct page retrieval, not semantic search. Unrelated questions may still use Google Search when RAG is empty.
7. **RAG quality tiers:** `rag_quality_service` classifies context as DIRECT / PARTIAL / DEFLECTED / EMPTY to tune prompt instructions.
8. Repeated identical questions from the **same user** with the same RAG context can hit the **per-user TTL response cache** (no second Gemini call). Assistant responses include `cache_hit: true` when served from cache.

### LLM provider order

1. **Gemini** via `google-genai` with Google Search grounding (when `GEMINI_API_KEY` is set).
2. **Gemini legacy** via `google-generativeai` if grounding client fails.
3. **OpenAI** if Gemini returns nothing and `OPENAI_API_KEY` is set.
4. **Local rule-based fallback** when no API keys are configured (used in tests and offline dev).

Model fallbacks: configured `GEMINI_MODEL`, then `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.0-flash`.

---

## Features

### Widget UX

| Feature | Implementation |
| --- | --- |
| **RemiLauncher + RemiSphere** | Floating launcher — dark sphere with soft blue radial halo (`RemiFace.tsx`); replaced earlier amber/yellow theme |
| **RemiAvatar2D / RemiFace** | Shared mascot in headers and message bubbles |
| **NavTooltip** | Hover/tap hints on toolbar, tabs, and header buttons |
| **RateLimitBanner** | Server-authoritative countdown when daily Gemini quota is exceeded (429 + `reset_at`) |
| **FileListItem** | Per-file row with processing status (`extracting` / `embedding`), `status_detail` progress, inline delete confirm + trash icon |
| **CompactWidget** | 350px bottom-right chat panel |
| **ExpandedWidget** | Full workspace: sidebar, chat, files tab, generate tab |
| **WidgetAuthPanel** | Login/signup inside the widget — host page stays untouched |

### Chat & conversations

| Feature | Implementation |
| --- | --- |
| **Streaming replies** | SSE — `POST …/messages/stream` |
| **Markdown rendering** | `react-markdown` + `remark-gfm` |
| **Conversation CRUD** | Create, list, rename, delete via `/chat/conversations` |
| **Auto-title** | First user message sets title when still a placeholder |
| **Message edit & resend** | `MessageEditModal` → `POST …/messages` |
| **Conversation dashboard** | `WidgetConversationDashboard` + `SearchFilterPanel` (text, date, file, status filters — shipped) |
| **Starred conversations** | `localStorage` via `starredStorage.ts` |
| **Archived / Trash** | `localStorage` via `conversationFoldersStorage.ts` (client-only) |

### Mobile (viewport < 768px)

| Feature | Implementation |
| --- | --- |
| **Responsive layout** | `useIsMobile.ts` + `ExpandedWidget` full-screen + bottom tabs |
| **Mobile tabs** | `MobileTabBar.tsx` — Chat / Chats / Files |
| **Mobile lists** | `MobileConversationList.tsx`, `MobileFilesPanel.tsx` |

### Files & RAG

| Feature | Implementation |
| --- | --- |
| **Upload** | PDF, DOCX, XLS/XLSX, TXT, MD, CSV, JSON, LOG — max 100MB; file picker shows **all files** (validated after selection) |
| **Upload modal** | Drag-and-drop, validation error banner, attach-badge file count in chat header |
| **File list** | Expanded widget "Files" tab; status `pending` → `extracting` → `embedding` → `processed` / `failed`; polls every 1.5s while processing |
| **File delete** | Trash icon → inline confirm → optimistic UI + `DELETE …/files/{id}`; removes disk file + `embeddings` rows |
| **RAG search** | pgvector cosine similarity (top 5); page-specific direct lookup; keyword fallback; versioned embeddings |
| **Page queries** | "What's on page N" uses `embeddings.page` direct retrieval, not web search |

### Document generation

| Feature | Implementation |
| --- | --- |
| **Generate panel** | Summary / Report / Analysis → PDF, DOCX, or TXT via `POST …/generate` |
| **Client-side exports** | TXT, PDF, JSON, MD, HTML, CSV from `exportConversation.ts` |
| **Chat-triggered PDFs** | Natural-language PDF requests handled server-side, downloaded client-side |

### Auth & security

| Feature | Implementation |
| --- | --- |
| **JWT sessions** | Token in `localStorage`; restored via `GET /auth/me` on mount |
| **SECRET_KEY** | **Required** (min 32 chars) — app refuses to start without it (except `ENVIRONMENT=test`) |
| **Security headers** | Five headers on every response; HSTS added when `ENVIRONMENT=production` (`SecurityHeadersMiddleware`) |
| **Prompt sanitization** | `core/sanitizer.py` strips injection patterns before RAG/LLM; 400 if message is only injection content |
| **Request body limits** | 1 MB for `/api/v1/chat/*` (messages); 52 MB for file upload routes (`main.py` middleware) |
| **MIME validation** | Extension + Content-Type + first 512 bytes magic-byte check (`python-magic` + fallback) |
| **Auth rate limiting** | In-memory sliding window per IP: 5 failed attempts/min on `/login` and `/signup` (separate scopes) |
| **Audit logging** | `audit_logs` table; background logging on login, message, generate, upload, file/conversation delete (user ID + IP + timestamp) |
| **Gemini daily quota** | 100 calls/user/day UTC calendar reset; 429 includes `retry_after_seconds` + `reset_at` |
| **Response cache privacy** | Cache key scoped to `(user_id, normalized_question, rag_digest, use_search)` |
| **Password hashing** | bcrypt |
| **CORS** | Configured in `main.py` from `CORS_ORIGINS` + optional Vercel preview regex |
| **Per-user isolation** | Conversations and files scoped to authenticated user; file delete returns **403** for non-owners |
| **Cloudflare IP trust** | `CLOUDFLARE_ONLY` validates `CF-Connecting-IP` against Cloudflare ranges; refreshed every 24h |
| **Proxy-aware IP** | `get_real_ip()` for audit logs and rate limiting |

---

## Project Structure

```
chatbot-widget/
├── .env.example / .env.local       # Shared env (repo root; Vite envDir + backend config)
├── .github/workflows/
│   ├── ci.yml                       # pytest + type-check + build
│   └── deploy.yml                   # Vercel production (backend on Railway)
├── client/                          # React widget (Vite)
│   ├── index.html
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx                 # Entry
│       ├── App.tsx                  # Imports default export from FloatingWidget.tsx
│       ├── api/                     # auth.ts, chat.ts, files.ts, rateLimit.ts, client.ts
│       ├── constants/uploadFormats.ts
│       ├── components/
│       │   ├── ChatbotWidget/       # Widget UI + streamSend.ts, NavTooltip, RateLimitBanner, FileListItem
│       │   └── SearchFilterPanel.tsx
│       ├── hooks/useIsMobile.ts
│       ├── types/index.ts
│       ├── utils/                   # pdfGenerator, exportConversation, starredStorage, conversationFoldersStorage, …
│       └── styles/                  # index.css, animations.css
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app, CORS, body limits, lifespan, migrations
│   │   ├── config.py                # Settings (SECRET_KEY, quota, cache, auth rate limit)
│   │   ├── api/v1/                  # auth.py, chat.py, files.py, admin.py
│   │   ├── core/                    # security.py, network.py, mime_validation.py, sanitizer.py
│   │   ├── middleware/              # security_headers.py
│   │   ├── database/
│   │   │   ├── db.py                # ORM models
│   │   │   └── migrations/          # Alembic revision + idempotent startup.py
│   │   ├── services/
│   │   │   ├── chat_service.py      # Chat, stream, RAG, quota, sanitization
│   │   │   ├── quota_service.py     # Per-user daily Gemini limit (UTC midnight)
│   │   │   ├── response_cache.py    # Per-user TTLCache
│   │   │   ├── auth_rate_limit_service.py  # Login/signup brute-force protection
│   │   │   ├── audit_service.py     # Best-effort audit log writes
│   │   │   ├── auth_service.py
│   │   │   ├── file_parser_service.py
│   │   │   ├── rag_quality_service.py   # RAG context quality tiers
│   │   │   └── vector_store_service.py  # Gemini embed + pgvector search + page retrieval
│   │   └── schemas/                 # Pydantic models + audit_log.py ORM
│   ├── tests/                       # test_api_*.py + tests/unit/ (191 tests)
│   ├── requirements.txt
│   └── pytest.ini
├── package.json                     # npm workspace root
└── README.md
```

### Key frontend components

| Component | Role |
| --- | --- |
| `index.tsx` | Widget shell: auth gate, launcher, compact/expanded routing, conversation state |
| `FloatingWidget.tsx` | Re-export entry for `App.tsx` |
| `RemiLauncher.tsx` / `RemiSphere.tsx` | Floating open button |
| `CompactWidget.tsx` | Small chat panel |
| `ExpandedWidget.tsx` | Full workspace with sidebar, files, generate panel |
| `ChatInterface.tsx` | Message list, input, edit, PDF re-download |
| `WidgetAuthPanel.tsx` | In-widget login/signup |
| `FileUploadModal.tsx` | Drag-and-drop upload; no `accept` filter; validation errors |
| `FileListItem.tsx` | File row with status, inline delete confirm, trash icon |
| `NavTooltip.tsx` / `RateLimitBanner.tsx` | Button hints; quota countdown (`reset_at`) |
| `constants/uploadFormats.ts` | Shared supported extensions + 100MB limit |
| `FileGenerationPanel.tsx` | AI summary/report/analysis + client exports |
| `WidgetConversationDashboard.tsx` | Browse and search conversations |
| `MobileTabBar.tsx` / `MobileConversationList.tsx` / `MobileFilesPanel.tsx` | Mobile expanded layout |
| `streamSend.ts` | Shared SSE streaming helper for compact & expanded widgets |

---

## Documentation (`docs/`)

| Doc | Contents |
| --- | --- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Code-level reference (lifecycle, RAG, auth, security, tests) |
| [01_system_overview.md](docs/01_system_overview.md) | System summary and workflows |
| [02_architecture_diagrams.md](docs/02_architecture_diagrams.md) | Mermaid diagrams |
| [03_features_capabilities.md](docs/03_features_capabilities.md) | Shipped features vs not implemented |
| [04_ml_ai_concepts.md](docs/04_ml_ai_concepts.md) | RAG/LLM concepts mapped to this repo |
| [05_project_structure(with_optional_enhancements).md](docs/05_project_structure(with_optional_enhancements).md) | Directory layout |
| [06_Epics_User_stories_and_Use_cases.md](docs/06_Epics_User_stories_and_Use_cases.md) | Has Epics, User stories and Use-cases |
| [07_deployment_guide.md](docs/07_deployment_guide.md) | Local dev, Vercel + Railway |
| [08_frontend_guide.md](docs/08_frontend_guide.md) | React, TypeScript, components, hooks, API client, streaming |

---

## Environment Variables

Copy `.env.example` → `.env.local` at the **repo root**. Both backend (`config.py` + `python-dotenv`) and Vite (`envDir: '..'` in `vite.config.ts`) read from there.

### Variables the code actually reads

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | For real AI | `""` | Primary LLM + Google Search grounding |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model name |
| `EMBEDDING_MODEL` | No | `gemini-embedding-001` | Gemini embedding model (retired names auto-mapped) |
| `OPENAI_API_KEY` | No | `""` | Fallback LLM |
| `OPENAI_MODEL` | No | `gpt-3.5-turbo` | OpenAI model name |
| `SECRET_KEY` | **Yes** (min 32 chars) | none — app fails to start | JWT signing — **not** `JWT_SECRET_KEY` |
| `ENVIRONMENT` | No | `development` | Use `production` on Railway (enables HSTS header) |
| `DATABASE_URL` | No | `sqlite:///./chatbot.db` | SQLAlchemy connection (relative to backend cwd) |
| `GEMINI_DAILY_QUOTA_PER_USER` | No | `100` | Max Gemini calls per user per UTC day (`0` = unlimited) |
| `RESPONSE_CACHE_ENABLED` | No | `true` | TTL cache for identical questions |
| `RESPONSE_CACHE_TTL_SECONDS` | No | `3600` | Cache entry lifetime (seconds) |
| `RESPONSE_CACHE_MAX_SIZE` | No | `500` | Max cached responses in memory |
| `CORS_ORIGINS` | No | localhost/127.0.0.1 Vite ports | Comma-separated allowed origins |
| `CORS_ORIGIN_REGEX` | No | `https://.*\.vercel.app` | Preview deploy origin regex |
| `CLOUDFLARE_ONLY` | No | `false` | When `true`, only trust `CF-Connecting-IP` from Cloudflare origin IPs |
| `AUTH_RATE_LIMIT_ENABLED` | No | `true` | Per-IP login/signup brute-force protection |
| `AUTH_RATE_LIMIT_MAX_ATTEMPTS` | No | `5` | Max failed auth attempts per IP per window |
| `AUTH_RATE_LIMIT_WINDOW_SECONDS` | No | `60` | Sliding window length (seconds) |
| `VITE_API_URL` | No | `http://localhost:8000` | Frontend API base URL (baked at Vercel build time) |

### Not used by the running app

These appear in `.env.example` but have **no corresponding code** in `backend/app/`:

`VITE_WS_URL`, `REDIS_URL`, `JWT_SECRET_KEY`, `JWT_ALGORITHM`, `RATE_LIMIT_*` (legacy; app uses `GEMINI_DAILY_QUOTA_PER_USER` and `AUTH_RATE_LIMIT_*`), `AWS_*`, `SMTP_*`, `SENTRY_DSN`, and most other `.env.example` placeholders.

> **Security:** Never commit `.env.local`. Rotate `SECRET_KEY` and API keys before production.

---

## API Reference

Base URL: `http://localhost:8000/api/v1`

Interactive docs: `http://localhost:8000/docs`

Health: `GET /health` · Root: `GET /`

All chat and file routes require: `Authorization: Bearer <token>`

### Auth (`/auth`)

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/auth/signup` | Register `{ email, password }`; rate-limited per IP |
| `POST` | `/auth/login` | Returns `{ access_token, token_type }`; rate-limited per IP |
| `GET` | `/auth/me` | Current user profile |

### Chat (`/chat`)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/chat/conversations` | List conversations (newest first) |
| `POST` | `/chat/conversations` | Create conversation |
| `GET` | `/chat/conversations/{id}` | Conversation detail with messages |
| `PATCH` | `/chat/conversations/{id}` | Rename `{ title }` |
| `DELETE` | `/chat/conversations/{id}` | Delete conversation (cascades messages & files) |
| `GET` | `/chat/conversations/{id}/messages` | Message history (oldest first) |
| `POST` | `/chat/conversations/{id}/messages` | Send message (returns user + assistant) |
| `POST` | `/chat/conversations/{id}/messages/stream` | Stream assistant reply (SSE); may return **429** if daily Gemini quota exceeded |
| `POST` | `/chat/conversations/{id}/generate` | AI summary/report/analysis export |

### Files (`/chat/conversations/{id}/files`)

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/chat/conversations/{id}/files` | Upload file (multipart); queues RAG indexing |
| `GET` | `/chat/conversations/{id}/files` | List uploaded files |
| `DELETE` | `/chat/conversations/{id}/files/{file_id}` | Delete file, embeddings rows, and disk copy (403 if not owner) |
| `POST` | `/chat/conversations/{id}/files/{file_id}/reindex` | Re-run extraction + embedding (API only; no frontend UI) |

### Admin (`/admin`, JWT required)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/admin/embedding-health` | Current user's files: `embedding_model_version`, `stale` flag |

### Assistant message fields

| Field | When |
| --- | --- |
| `cache_hit` | `true` when assistant reply came from per-user response cache |
| `has_pdf`, `pdf_content`, `pdf_filename` | Chat PDF intent detected |

### PDF fields on assistant messages

When chat PDF intent is detected:

```json
{
  "has_pdf": true,
  "pdf_content": "## Title\n\n…markdown…",
  "pdf_filename": "the_recipe.pdf"
}
```

---

## Testing & CI

### Run tests locally

From `backend/` with venv activated:

```bash
# Windows
venv\Scripts\python.exe -m pytest tests/ -v

# macOS/Linux
python -m pytest tests/ -v
```

**191 tests** in `backend/tests/` (API integration + `tests/unit/` for sanitizer, cache, MIME magic, auth rate limit, audit, RAG routing, page extraction, embedding versioning, file delete). No live LLM calls — `conftest.py` clears API keys and mocks pgvector indexing on uploads by default.

See `backend/tests/README.md` for fixture details.

### Run frontend checks

From repo root:

```bash
npm run type-check
npm run build
```

### CI pipeline (`.github/workflows/ci.yml`)

| Job | What it runs |
| --- | --- |
| **Backend (pytest)** | Python 3.12 · `pip install -r requirements.txt` · `pytest tests/` |
| **Frontend (type-check & build)** | Node 22 · `npm ci` · `npm run type-check` · `npm run build` |

Triggers on push/PR to `main` and `develop`.

---

## Deployment

`.github/workflows/deploy.yml` runs after CI succeeds on `main` (or manually via workflow dispatch) and deploys the **frontend** to Vercel. The **backend** is deployed separately on **Railway** (see `backend/Dockerfile`, `backend/railway.toml`).

| Target | Mechanism | Secret / config |
| --- | --- | --- |
| **Backend** | **Railway** (GitHub-connected service or `railway up`) | `DATABASE_URL`, `GEMINI_API_KEY`, `SECRET_KEY`, `CORS_ORIGINS` in Railway dashboard |
| **Frontend** | Vercel CLI (`vercel build` + `vercel deploy --prebuilt`) | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VITE_API_URL` |

If Vercel secrets are not set, the frontend deploy step is skipped gracefully.

### Production notes

- Set `SECRET_KEY`, `GEMINI_API_KEY`, and `DATABASE_URL` (PostgreSQL recommended) on **Railway**.
- Do **not** set `EMBEDDING_MODEL=text-embedding-004` (retired). Omit it or use `gemini-embedding-001`.
- Set `ENVIRONMENT=production` on Railway (enables HSTS security header).
- Set `VITE_API_URL` to your **Railway** public HTTPS API URL on Vercel (no trailing slash), then **redeploy Vercel** (env is baked at build time).
- Add your Vercel production domain to `CORS_ORIGINS` on Railway (preview `*.vercel.app` matches default regex).
- Embeddings are **persisted in PostgreSQL** (`embeddings` table with pgvector + `embedding_model_version`) so Railway redeploys do not wipe RAG. Railway Postgres must have the **pgvector** extension enabled.
- Alembic chain includes `007_status_detail` and `008_pdf_page_counts`; migration revision IDs must match (healthcheck runs `alembic upgrade head` on startup).
- Verify API health: `curl.exe -sS https://YOUR-RAILWAY-URL.up.railway.app/health` → `{"status":"healthy"}`

### Production (live)

| Item | Value |
| --- | --- |
| Frontend | https://chatbot-widget-client.vercel.app |
| Backend API | https://chatbot-widgetclient-production.up.railway.app |
| `VITE_API_URL` | Set on Vercel → Railway HTTPS URL |
| `ENVIRONMENT` | `production` on Railway (HSTS enabled) |
| `CORS_ORIGINS` | Vercel production domain aligned with Railway |

### Production checklist

- [x] Railway: `SECRET_KEY`, `GEMINI_API_KEY`, `DATABASE_URL` (Postgres), `ENVIRONMENT=production`
- [x] Railway: `CORS_ORIGINS` includes Vercel URL
- [x] Vercel: `VITE_API_URL` = Railway HTTPS URL; production redeploy completed
- [x] Smoke test: signup → chat → upload → delete file
- [x] Security headers + HSTS on `/health`

---

## Remaining work

| Item | Status |
| --- | --- |
| **Conversation Detail tabs** (Messages / Files / Generated Files / Details) | Not built — `getConversationDetail()` unused |
| **Embeddable npm package** (`build:lib` script-tag / drop-in widget) | Not built |

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| **"Loading chat…" stuck** | Ensure backend is running; refresh after login. Check browser console for API errors. |
| **CORS errors** | Add your frontend origin to `CORS_ORIGINS` — include both `localhost` and `127.0.0.1` variants |
| **Gemini quota / 429** | App enforces **100 Gemini calls/user/day**; UI countdown uses server `reset_at`. Resets at UTC midnight. |
| **Login/signup 429** | Auth rate limit (5 failed attempts/min per IP). Wait 60s or tune `AUTH_RATE_LIMIT_*`. |
| **Widget calls localhost in prod** | Set `VITE_API_URL` on Vercel and **redeploy** frontend |
| **301 on Railway curl** | Use `https://` prefix: `curl.exe -sS https://your-api.up.railway.app/health` |
| **Security headers missing on prod** | Set `ENVIRONMENT=production` and redeploy latest backend from `main` |
| **Backend won't start** | Set `SECRET_KEY` (32+ random chars) in `.env.local` — no default is provided |
| **Upload shows "Failed — try again"** | Check Railway logs for extraction/OCR errors. Ensure `GEMINI_API_KEY` is set (needed for OCR on image PDFs). Large flipbooks may take several minutes — watch `status_detail` progress. |
| **Page query returns web search** | Wait until file status is `processed`. Re-upload if indexed before the pgvector migration. Ask "what's on page N" after indexing completes. |
| **Only partial PDF indexed** | Fixed: all pages are extracted (PyMuPDF + OCR). Re-upload older PDFs that were indexed under the previous 74-page cap. |
| **File picker hides files** | Fixed: picker shows all files; unsupported types show a red validation message after selection |
| **No AI responses** | Verify `GEMINI_API_KEY` in `.env.local`; restart backend after env changes |
| **PDF not downloading** | Use phrasing with "pdf" + a verb (generate/create/export); check browser download permissions |
| **`npm ci` EPERM on Windows** | Stop `npm run dev` first (Vite locks `esbuild.exe`) |
| **`tsc` not found** | Run `npm ci` from repo root before `npm run type-check` |
| **Backend import errors** | Activate `backend/venv` and `pip install -r requirements.txt` |
| **Port 8000 in use** | `uvicorn … --port 8001` and set `VITE_API_URL=http://localhost:8001` |

---

## License

MIT — see [LICENSE](LICENSE).

---

**Last updated:** June 2026  
**Status:** Production-deployed widget — pgvector RAG with document-first routing, full PDF extraction (PyMuPDF + Gemini OCR), page-aware retrieval, processing progress UI, security hardening, 191 tests passing, live on Vercel + Railway. Remaining: Conversation Detail tabs and embeddable `build:lib` package.
