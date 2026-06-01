# Remi — AI Chatbot Widget

A self-contained, embeddable chat widget powered by **Remi**, a warm minimal AI assistant. Users sign in inside the widget, chat with streaming responses, upload documents for RAG-backed answers, export conversations, and generate PDFs—either from the Generate panel or directly in chat with natural language.

This README reflects **what is in the repository today**, derived from the running code—not aspirational docs or empty scaffold folders.

---

## Table of Contents

1. [What This Project Is](#what-this-project-is)
2. [Tech Stack (Actual)](#tech-stack-actual)
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
| **Vector store** | Local FAISS indices + sentence-transformers embeddings on disk |

There is **no** LangChain, Redis, Celery, WebSocket server, Kubernetes runtime, or safety/moderation pipeline in the live codebase.

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
| Radix UI (`dropdown-menu`, `popover`) | Menus in chat & search filter |

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
| FAISS + sentence-transformers | RAG chunk storage & search |
| PyPDF2, python-docx, openpyxl | File text extraction |

### Infrastructure

| Tool | Purpose |
| --- | --- |
| GitHub Actions (`.github/workflows/ci.yml`) | pytest + frontend type-check/build on `main` / `develop` |
| GitHub Actions (`.github/workflows/deploy.yml`) | Render backend hook + Vercel frontend (secrets optional) |

---

## Quick Start

### Prerequisites

- **Python 3.12** (3.11+ works locally; CI uses 3.12)
- **Node.js 22** recommended (CI uses 22; 18+ works locally)
- A [Google AI Studio](https://aistudio.google.com/apikey) API key (`GEMINI_API_KEY`) for real AI replies

### Setup

```bash
# 1. Clone and enter the repo
git clone <your-repo-url> chatbot-widget
cd chatbot-widget

# 2. Environment — repo root (shared by backend + Vite)
cp .env.example .env.local
# Edit .env.local and set GEMINI_API_KEY=your_key_here

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
npm run dev
# Open http://127.0.0.1:5173
```

Sign up inside the widget, click the Remi launcher, and start chatting.

> **Windows tip:** Stop `npm run dev` before running `npm ci` — Vite locks `esbuild.exe` and causes `EPERM` errors.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser — React widget (client/)                           │
│  main.tsx → App.tsx → FloatingWidget → ChatbotWidget        │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ RemiLauncher│→ │ CompactWidget│→ │ ExpandedWidget    │  │
│  │ (animated)  │  │ (350px chat) │  │ (sidebar + panels)│  │
│  └─────────────┘  └──────────────┘  └───────────────────┘  │
│         │ WidgetAuthPanel (login/signup inside widget)      │
└─────────┼───────────────────────────────────────────────────┘
          │ REST + SSE (JWT Bearer token)
          ▼
┌─────────────────────────────────────────────────────────────┐
│  FastAPI (backend/app/main.py)                              │
│  /api/v1/auth/*     signup, login, me                       │
│  /api/v1/chat/*     conversations, messages, stream, generate│
│  /api/v1/chat/conversations/{id}/files  upload + list       │
└─────────┼───────────────────────────────────────────────────┘
          │
    ┌─────┴─────┬──────────────┐
    ▼           ▼              ▼
 SQLite/     FAISS on disk   Gemini (google-genai)
 PostgreSQL  (per file)     + OpenAI fallback
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
2. Backend extracts text (`file_parser_service.py`), chunks and embeds it (`vector_store_service.py`), stores a FAISS index under `backend/data/vector_store/`.
3. Indexing runs in a FastAPI `BackgroundTasks` worker (synchronous when `INLINE_FILE_PROCESSING=1` in tests).
4. On each chat turn, top-k chunks are retrieved and injected into the LLM prompt.

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
| **RemiLauncher + RemiSphere** | Floating animated launcher (Framer Motion) |
| **RemiAvatar2D** | Flat mascot in headers and message bubbles |
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
| **Conversation dashboard** | `WidgetConversationDashboard` + `SearchFilterPanel` |
| **Starred conversations** | `localStorage` via `starredStorage.ts` |

### Files & RAG

| Feature | Implementation |
| --- | --- |
| **Upload** | PDF, DOCX, XLSX, TXT, MD, CSV and other text-readable formats |
| **File list** | Expanded widget "Files" tab; status `pending` → `processed` / `failed` |
| **RAG search** | FAISS L2 index per uploaded file |

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
| **Password hashing** | bcrypt |
| **CORS** | Configured in `main.py` from `CORS_ORIGINS` env var |
| **Per-user isolation** | Conversations and files scoped to authenticated user |

---

## Project Structure

```
chatbot-widget/
├── .env.example / .env.local       # Shared env (repo root; Vite envDir + backend config)
├── .github/workflows/
│   ├── ci.yml                       # pytest + type-check + build
│   └── deploy.yml                   # Render + Vercel
├── client/                          # React widget (Vite)
│   ├── index.html
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx                 # Entry
│       ├── App.tsx                  # Renders ChatbotWidget only
│       ├── api/                     # auth.ts, chat.ts, files.ts, client.ts
│       ├── components/
│       │   ├── ChatbotWidget/       # All widget UI (14 components)
│       │   └── SearchFilterPanel.tsx
│       ├── types/index.ts
│       ├── utils/                   # pdfGenerator, exportConversation, starredStorage, …
│       └── styles/                  # index.css, animations.css
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app, CORS, PDF column migration
│   │   ├── config.py                # Settings from .env.local
│   │   ├── api/v1/                  # auth.py, chat.py, files.py
│   │   ├── core/security.py         # JWT + bcrypt
│   │   ├── database/db.py           # User, Conversation, Message, UploadedFile
│   │   ├── services/
│   │   │   ├── chat_service.py      # Chat, stream, RAG, PDF intent, generate
│   │   │   ├── auth_service.py
│   │   │   ├── file_parser_service.py
│   │   │   └── vector_store_service.py
│   │   └── schemas/                 # Pydantic request/response models
│   ├── tests/                       # test_api_*.py (55 tests)
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
| `FileUploadModal.tsx` | Drag-and-drop file upload |
| `FileGenerationPanel.tsx` | AI summary/report/analysis + client exports |
| `WidgetConversationDashboard.tsx` | Browse and search conversations |
| `streamSend.ts` | Shared SSE streaming helper for compact & expanded widgets |

---

## Environment Variables

Copy `.env.example` → `.env.local` at the **repo root**. Both backend (`config.py` + `python-dotenv`) and Vite (`envDir: '..'` in `vite.config.ts`) read from there.

### Variables the code actually reads

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | For real AI | `""` | Primary LLM + Google Search grounding |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model name |
| `OPENAI_API_KEY` | No | `""` | Fallback LLM |
| `OPENAI_MODEL` | No | `gpt-3.5-turbo` | OpenAI model name |
| `SECRET_KEY` | Prod | dev placeholder | JWT signing — **the code reads `SECRET_KEY`, not `JWT_SECRET_KEY`** |
| `DATABASE_URL` | No | `sqlite:///./chatbot.db` | SQLAlchemy connection (relative to backend cwd) |
| `CORS_ORIGINS` | No | localhost/127.0.0.1 Vite ports | Comma-separated allowed origins |
| `VITE_API_URL` | No | `http://localhost:8000` | Frontend API base URL |

### Not used by the running app

These appear in `.env.example` but have **no corresponding code** in `backend/app/`:

`VITE_WS_URL`, `REDIS_URL`, `JWT_SECRET_KEY`, `JWT_ALGORITHM`, `RATE_LIMIT_*`, `AWS_*`, `SMTP_*`, `SENTRY_DSN`, and most other backend placeholders.

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
| `POST` | `/auth/signup` | Register `{ email, password }` |
| `POST` | `/auth/login` | Returns `{ access_token, token_type }` |
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
| `POST` | `/chat/conversations/{id}/messages/stream` | Stream assistant reply (SSE) |
| `POST` | `/chat/conversations/{id}/generate` | AI summary/report/analysis export |

### Files (`/chat/conversations/{id}/files`)

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/chat/conversations/{id}/files` | Upload file (multipart); queues RAG indexing |
| `GET` | `/chat/conversations/{id}/files` | List uploaded files |

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

**55 tests** in `test_api_*.py`. No live LLM calls — `conftest.py` clears API keys and mocks FAISS indexing on uploads.

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

`.github/workflows/deploy.yml` runs after CI succeeds on `main` (or manually via workflow dispatch).

| Target | Mechanism | Secret |
| --- | --- | --- |
| **Backend** | Render deploy hook | `RENDER_DEPLOY_HOOK` |
| **Frontend** | Vercel CLI (`vercel build` + `vercel deploy --prebuilt`) | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VITE_API_URL` |

If secrets are not set, the corresponding deploy step is skipped gracefully.

### Production notes

- Set `SECRET_KEY`, `GEMINI_API_KEY`, and `DATABASE_URL` (PostgreSQL recommended) on Render.
- Set `VITE_API_URL` to your Render API URL on Vercel.
- Add your Vercel domain to `CORS_ORIGINS` on the backend.
- FAISS indices and uploads are stored on local disk (`backend/data/`). Ephemeral filesystems (some free tiers) will lose RAG indexes on redeploy — use persistent disk or external storage for production RAG.

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| **"Loading chat…" stuck** | Ensure backend is running; refresh after login. Check browser console for API errors. |
| **CORS errors** | Add your frontend origin to `CORS_ORIGINS` — include both `localhost` and `127.0.0.1` variants |
| **Gemini quota / 429** | Check [AI Studio billing](https://aistudio.google.com/apikey); model fallbacks will retry alternate Gemini models |
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

**Last updated:** May 2026  
**Status:** Production-oriented widget with chat, RAG, PDF generation, and CI/CD. Codebase trimmed to live runtime paths only.
