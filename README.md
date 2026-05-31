# Remi — AI Chatbot Widget

A self-contained, embeddable chat widget powered by **Remi**, a warm minimal AI assistant. Users sign in inside the widget, chat with streaming responses, upload documents for RAG-backed answers, export conversations, and generate PDFs—either from the Generate panel or directly in chat with natural language.

This README describes **what is built today** and **why** each piece exists.

---

## Table of Contents

1. [What This Project Is](#what-this-project-is)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [What's Implemented (and Why)](#whats-implemented-and-why)
5. [Project Structure](#project-structure)
6. [Environment Variables](#environment-variables)
7. [API Overview](#api-overview)
8. [Development Notes](#development-notes)
9. [Troubleshooting](#troubleshooting)
10. [Roadmap](#roadmap)

---

## What This Project Is

**Remi** is a floating chatbot widget (React + Vite) backed by a FastAPI API. It is designed to drop onto any page: a 3D animated launcher opens a compact chat panel, which can expand to a full workspace with sidebar, file panel, and document generation tools.

| Layer | Stack |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion |
| Backend | FastAPI, SQLAlchemy, SQLite (dev) / PostgreSQL (prod-ready) |
| AI | Google Gemini 2.5 Flash (primary), OpenAI (fallback) |
| RAG | FAISS + sentence-transformers for uploaded file search |
| Auth | JWT (email + password, bcrypt) |

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com/apikey) API key (`GEMINI_API_KEY`)

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
npm install

# 5. Run (two terminals)
# Terminal 1 — API
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — Widget
cd client
npm run dev
# Open http://127.0.0.1:5173
```

Sign up inside the widget, click the Remi launcher, and start chatting.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser — React widget (client/)                           │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ RemiLauncher│→ │ CompactWidget│→ │ ExpandedWidget    │  │
│  │ (3D sphere) │  │ (350px chat) │  │ (sidebar + panels)│  │
│  └─────────────┘  └──────────────┘  └───────────────────┘  │
│         │ WidgetAuthPanel (login/signup inside widget)       rrfonfr=│
└─────────┼───────────────────────────────────────────────────┘
          │ REST + SSE (JWT)
          ▼
┌─────────────────────────────────────────────────────────────┐
│  FastAPI (backend/app/)                                     │
│  /api/v1/auth    — signup, login, me                        │
│  /api/v1/chat    — conversations, messages, stream, generate│
│  /api/v1/chat/…/files — upload + RAG indexing               │
└─────────┼───────────────────────────────────────────────────┘
          │
    ┌─────┴─────┬──────────────┐
    ▼           ▼              ▼
 SQLite/     FAISS          Gemini /
 PostgreSQL  vector store   OpenAI APIs
```

### Message flow (normal chat)

1. User sends a message → frontend calls `POST …/messages/stream` (SSE).
2. Backend saves the user message, streams Gemini tokens, persists the assistant reply.
3. Frontend appends chunks live; final `done` event replaces the placeholder with the saved message.

### Message flow (PDF intent)

1. `detect_pdf_request()` matches phrases like *"generate the pdf with the recipe"* or *"export this as pdf"*.
2. Backend skips normal chat; calls the LLM once to produce structured markdown.
3. Assistant message is saved with `has_pdf`, `pdf_content`, `pdf_filename`.
4. Frontend auto-downloads the PDF via `jsPDF` and shows a **Download PDF again** link.

### RAG flow (uploaded files)

1. User uploads PDF/DOCX/TXT/etc. to a conversation.
2. Backend extracts text, chunks it, embeds with sentence-transformers, stores in FAISS.
3. On each chat turn, relevant chunks are injected into the Gemini prompt as context.

---

## What's Implemented (and Why)

### Widget UX & branding

| Feature | What it does | Why |
| --- | --- | --- |
| **RemiLauncher** | Floating 3D amber sphere (Framer Motion, cycling expressions) | Draws attention; feels alive without cluttering the host page |
| **RemiAvatar2D** | Flat 2D circle mascot with dot eyes | Consistent brand in headers and bot bubbles at small sizes where 3D detail is lost |
| **CompactWidget** | 350px panel, bottom-right | Default chat experience—unobtrusive on any site |
| **ExpandedWidget** | Full-screen layout with conversation sidebar, chat, files/generate panel | Power users: history, uploads, exports without leaving the widget |
| **Warm Minimal design** | White/gray palette, amber accents, soft shadows | Readable, friendly, works on light host pages |

### Authentication inside the widget

| Feature | What it does | Why |
| --- | --- | --- |
| **WidgetAuthPanel** | Login/signup form in the widget shell | Host page stays clean—no separate auth route required for embed scenarios |
| **JWT sessions** | Token in `localStorage`, `GET /auth/me` on mount | Stateless API; widget restores session after refresh |
| **Logout** | Button in compact/expanded headers | Users can switch accounts without clearing site data manually |

### Chat & conversations

| Feature | What it does | Why |
| --- | --- | --- |
| **Streaming replies** | SSE token streaming | Feels responsive; users see text appear immediately |
| **Markdown rendering** | Assistant messages via `react-markdown` | Lists, bold, headings render cleanly in bubbles |
| **Conversation list** | Create, switch, delete sessions | Separate topics per user |
| **Rename (persisted)** | `PATCH /chat/conversations/{id}` | Users can label chats; renames survive restarts (not overwritten by auto-title) |
| **Auto-title** | First user message seeds title | Only for placeholder titles (`New Conversation`, etc.) |
| **Message edit** | Edit a user message → new assistant reply | Fix typos without retyping the whole thread |
| **Conversation dashboard** | Starred + browse all conversations | Quick access in expanded mode |

### Files & RAG

| Feature | What it does | Why |
| --- | --- | --- |
| **File upload** | Per-conversation uploads (PDF, DOCX, TXT, …) | Ground answers in user documents |
| **FAISS search** | Top-k chunk retrieval per question | Keeps prompts within context limits while staying relevant |
| **File panel** | List uploaded files in expanded view | Visibility into what the bot can reference |

### Document generation

| Feature | What it does | Why |
| --- | --- | --- |
| **Generate panel** | Summary / Report / Analysis → PDF, DOCX, or TXT | Structured exports without manual copy-paste |
| **AI-authored markdown** | Backend prompts Gemini for headings, bullets, numbered steps | PDFs look professional, not like raw chat logs |
| **Chat-triggered PDFs** | *"generate a pdf with the recipe"*, *"export this as pdf"*, etc. | No panel navigation—natural language matches how users ask |
| **Flexible intent matching** | Handles *"the pdf"*, *"can you…"*, contextual *"the recipe"* | Real phrasing varies; strict patterns miss common requests |
| **Re-download button** | On assistant bubbles when `has_pdf` is true | Users can fetch the file again without regenerating |

### Resilience

| Feature | What it does | Why |
| --- | --- | --- |
| **Gemini model fallbacks** | Tries configured model, then flash/lite variants | Reduces outages when one model name is unavailable |
| **OpenAI fallback** | Used if Gemini returns nothing | Optional second provider via `OPENAI_API_KEY` |
| **Local fallback** | Rule-based replies when no API key | Dev/demo still works without keys |
| **SQLite + auto-migrate** | Tables created on startup; PDF columns added if missing | Low-friction local dev on Windows/macOS/Linux |

---

## Project Structure

```
chatbot-widget/
├── .env.example / .env.local     # Shared env (repo root)
├── client/                       # React widget (Vite)
│   └── src/
│       ├── api/                  # auth, chat, files HTTP clients
│       ├── components/
│       │   └── ChatbotWidget/    # Launcher, Compact, Expanded, Auth, …
│       ├── utils/
│       │   ├── pdfGenerator.ts   # Chat-triggered PDF download
│       │   └── exportConversation.ts
│       └── types/
├── backend/
│   └── app/
│       ├── main.py               # FastAPI app + PDF column migration
│       ├── config.py             # Settings from .env.local
│       ├── api/v1/               # auth, chat, files routes
│       ├── services/
│       │   ├── chat_service.py   # Chat, stream, RAG, PDF intent
│       │   ├── auth_service.py
│       │   ├── file_parser_service.py
│       │   └── vector_store_service.py
│       ├── database/db.py        # User, Conversation, Message, UploadedFile
│       └── schemas/              # Pydantic request/response models
└── README.md
```

### Key frontend components

| Component | Role |
| --- | --- |
| `index.tsx` | Widget shell: auth gate, launcher, compact/expanded routing |
| `RemiLauncher.tsx` | 3D floating button |
| `RemiSphere.tsx` | Animated 3D mascot (launcher only) |
| `RemiAvatar2D.tsx` | Flat mascot (headers, message avatars) |
| `CompactWidget.tsx` | Small chat panel |
| `ExpandedWidget.tsx` | Full workspace |
| `ChatInterface.tsx` | Shared message list, input, actions |
| `WidgetAuthPanel.tsx` | In-widget login/signup |
| `FileGenerationPanel.tsx` | Manual summary/report/analysis export |
| `FileUploadModal.tsx` | Attach files to a conversation |

---

## Environment Variables

Copy `.env.example` → `.env.local` at the **repo root**. Both backend (`pydantic-settings`) and Vite read from there.

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes (for AI) | Primary LLM |
| `GEMINI_MODEL` | No | Default `gemini-2.5-flash` |
| `OPENAI_API_KEY` | No | Fallback LLM |
| `VITE_API_URL` | No | Default `http://localhost:8000` |
| `DATABASE_URL` | No | Default SQLite `./chatbot.db` in backend cwd |
| `CORS_ORIGINS` | No | Include both `localhost` and `127.0.0.1` variants |
| `JWT_SECRET_KEY` / `SECRET_KEY` | Prod | Change from dev defaults before deploy |

> **Security:** Never commit `.env.local`. It contains secrets. `.env.example` has placeholders only.

---

## API Overview

Base URL: `http://localhost:8000/api/v1`

All chat/file routes require: `Authorization: Bearer <token>`

### Auth

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/auth/signup` | Register |
| `POST` | `/auth/login` | Returns JWT |
| `GET` | `/auth/me` | Current user |

### Chat

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/chat/conversations` | List conversations |
| `POST` | `/chat/conversations` | Create conversation |
| `PATCH` | `/chat/conversations/{id}` | Rename (persisted) |
| `DELETE` | `/chat/conversations/{id}` | Delete |
| `GET` | `/chat/conversations/{id}/messages` | Message history |
| `POST` | `/chat/conversations/{id}/messages` | Send message (returns user + assistant) |
| `POST` | `/chat/conversations/{id}/messages/stream` | Stream assistant reply (SSE) |
| `POST` | `/chat/conversations/{id}/generate` | AI summary/report/analysis file |

### Files

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/chat/conversations/{id}/files` | Upload + index for RAG |
| `GET` | `/chat/conversations/{id}/files` | List uploads |

### PDF fields on assistant messages

When chat PDF intent is detected, the assistant message includes:

```json
{
  "has_pdf": true,
  "pdf_content": "## Title\n\n…markdown…",
  "pdf_filename": "the_recipe.pdf"
}
```

Interactive docs: `http://localhost:8000/docs`

---

## Development Notes

### Why auth lives in the widget

Embedding on third-party sites means you cannot assume a host-app login page. Gating chat behind `WidgetAuthPanel` keeps one integration point: drop in `<ChatbotWidget />` and users authenticate in-place.

### Why two mascot styles

- **3D sphere** on the launcher: large enough for animation and personality.
- **2D flat circle** in headers/bubbles: legible at 24–36px; avoids muddy gradients at small sizes.

### Why PDF intent is server-side

The LLM alone often refuses with *"I can't generate PDFs."* Detecting intent in `chat_service.py` bypasses that path: a dedicated document prompt produces markdown, and the **browser** builds the PDF with `jsPDF`. The assistant only confirms success.

### PDF phrases that work

Examples:

- `generate a pdf about chocolate chip cookies`
- `can you generate the pdf with the recipe`
- `create a pdf of our conversation`
- `export this as pdf`
- `download this as a pdf`

Contextual topics (*"the recipe"*, *"this conversation"*) pull from recent chat history.

### Local database

- Default: SQLite file in the backend working directory.
- PDF metadata columns (`has_pdf`, `pdf_content`, `pdf_filename`) are added automatically on startup if missing.
- For production, set `DATABASE_URL` to PostgreSQL.

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| **CORS errors** | Add your Vite origin to `CORS_ORIGINS` (both `localhost` and `127.0.0.1`) |
| **Gemini quota / 429** | Check [AI Studio billing](https://aistudio.google.com/apikey); try again later |
| **No AI responses** | Verify `GEMINI_API_KEY` in `.env.local`; restart backend |
| **PDF not downloading** | Use phrasing with "pdf" + a verb (generate/create/export); check browser download permissions |
| **Backend import errors** | Activate `backend/venv` and `pip install -r requirements.txt` |
| **Port 8000 in use** | `uvicorn … --port 8001` and set `VITE_API_URL` accordingly |

---

## Roadmap

Planned or not yet implemented (do not assume these exist today):

- [ ] Embeddable script tag / npm package for third-party sites
- [ ] PostgreSQL + Alembic migrations as default prod path
- [ ] Redis caching and rate limiting
- [ ] Multi-provider picker in UI
- [ ] Voice input
- [ ] Docker Compose one-command dev
- [ ] Safety / moderation pipeline
- [ ] Webhooks and analytics

---

## License

MIT — see [LICENSE](LICENSE) if present.

---

**Last updated:** May 2026  
**Status:** Active development — widget-first Remi assistant with chat, RAG, and PDF generation.
