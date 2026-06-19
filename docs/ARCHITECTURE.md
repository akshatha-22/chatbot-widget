# Architecture & Implementation Reference

Technical deep-dive for the **chatbot-widget** monorepo (`client/` + `backend/`). This document is grounded in the running code with file paths and line references. For diagrams and product overview, see also [01_system_overview.md](./01_system_overview.md) and [02_architecture_diagrams.md](./02_architecture_diagrams.md).

**Last aligned with codebase:** June 2026 (pgvector RAG migration, document-first routing, page-aware PDF extraction, processing progress UI, security hardening, Vercel + Railway production).

---

## Table of contents

1. [Message request lifecycle](#1-message-request-lifecycle)
2. [RAG pipeline](#2-rag-pipeline-end-to-end)
3. [Gemini fallback chain](#3-gemini-unavailable--fallback-chain)
4. [pgvector embedding storage](#4-pgvector-embedding-storage)
5. [SSE streaming](#5-sse-streaming-architecture)
6. [Widget state (compact / expanded)](#6-widget-state-compact--expanded)
7. [Database schema](#7-database-schema)
8. [Background file embedding](#8-background-file-embedding)
9. [Authentication & JWT](#9-authentication--jwt-lifecycle)
10. [Scale & bottlenecks](#10-100-concurrent-users--bottlenecks)
11. [Security & configuration (critical)](#11-security--configuration-critical)
12. [Services & prompts](#12-services-prompts-and-error-handling)
13. [Frontend implementation](#13-frontend-implementation)
14. [HTTP, CORS, networking](#14-http-cors-networking)
15. [Tests & coverage gaps](#15-tests--coverage-gaps)
16. [Known gaps & follow-ups](#16-known-gaps--follow-ups)

---

## 1. Message request lifecycle

End-to-end path when a user sends a message in the expanded or compact widget:

| Step | Component | File (lines) |
|------|-----------|----------------|
| 1 | User submits input | `ExpandedWidget.tsx` / `CompactWidget.tsx` → `handleSend` |
| 2 | Stream helper | `streamSend.ts` `streamSendMessage` (18–109) |
| 3 | Optimistic UI | Local user `Message` + placeholder assistant id (32–48) |
| 4 | HTTP | `POST /api/v1/chat/conversations/{id}/messages/stream` — `chat.ts` (105–124) |
| 5 | Auth | `Authorization: Bearer` from `localStorage` token |
| 6 | API route | `post_message_stream` — `backend/app/api/v1/chat.py` (114–139) |
| 7 | Persist user message | `create_message(..., role="user")` → `db.commit()` — `chat_service.py` (681–705) |
| 8 | Stream generator | `stream_and_save_assistant` (586–612) |
| 9 | Context | `_prepare_assistant_context` — auto-title, history, document-first RAG, tiered prompt |
| 10 | Token chunks | `iter_assistant_chunks` → `format_sse(piece)` (253–260, 599–603) |
| 11 | Persist assistant | Single `create_message(..., "assistant", full_text)` → commit (605–612, 703) |
| 12 | Done event | `format_sse_done` JSON payload (263–279) |
| 13 | Client parse | `parseSsePayload` — `onChunk` / `onDone` — `chat.ts` (68–102, 150–180) |

```586:612:backend/app/services/chat_service.py
def stream_and_save_assistant(
    db: Session, conversation_id: int, user_id: int, user_message: str
) -> Iterator[str]:
    pdf_topic = detect_pdf_request(user_message)
    if pdf_topic is not None:
        assistant_msg = _create_pdf_assistant_message(...)
        yield format_sse_done(assistant_msg)
        return

    parts: List[str] = []
    for piece in iter_assistant_chunks(db, conversation_id, user_id, user_message):
        parts.append(piece)
        event = format_sse(piece)
        if event:
            yield event

    assistant_content = "".join(parts).strip()
    ...
    assistant_msg = create_message(db, conversation_id, user_id, "assistant", assistant_content)
    yield format_sse_done(assistant_msg)
```

---

## 2. RAG pipeline (end-to-end)

### Upload → index

| Order | Function | File |
|-------|----------|------|
| 1 | `upload_file` | `backend/app/api/v1/files.py` 72–134 |
| 2 | `get_conversation` (ownership) | `chat_service.py` 638–648 |
| 3 | Save bytes to disk | `backend/data/uploads/{file_id}{ext}` |
| 4 | DB row `status="pending"` + commit | `files.py` 110–118 |
| 5 | `BackgroundTasks.add_task(_run_embedding_background)` | 127–131 |
| 6 | Daemon `threading.Thread` → `process_file_embedding` | 61–69, 22–58 |
| 7 | `file_parser_service.extract_text` | PyMuPDF all pages + Gemini OCR (`file_parser_service.py`) |
| 8 | `validate_upload_mime` | `core/mime_validation.py` |
| 9 | Status `extracting` / `embedding` with `status_detail` | `files.py` |
| 10 | `vector_store_service.chunk_and_store(..., db=db)` | Gemini embed → pgvector rows |
| 11 | One chunk per page for page-marked PDFs | `parse_page_chunks` in `vector_store_service.py` |
| 12 | `status="processed"` + `indexed_page_count` + commit | `files.py` |

### Chat → retrieval

| Order | Function | File |
|-------|----------|------|
| 1 | `_prepare_assistant_context` | `chat_service.py` — document-first routing |
| 2 | Pending files? | Return wait message (no web) |
| 3 | `detect_page_query` → `get_page_content` | `vector_store_service.py` |
| 4 | Else `build_rag_context` | `chat_service.py` |
| 5 | `classify_rag_context` → prompt tier | `rag_quality_service.py` |
| 6 | `vector_store_service.search(file_ids, query, top_k=5)` | pgvector cosine |
| 7 | Inject into prompt as `DOCUMENT CONTEXT` | `_build_prompt_and_search_flag` |

---

## 3. Gemini unavailable — fallback chain

### Streaming (`iter_assistant_chunks`, 561–583)

1. If `settings.gemini_configured()` → `_stream_gemini` (models loop, search on/off, legacy client) — 218–250  
2. If no streamed output → `_openai_assistant_content` — 528–558  
3. Else → `_fallback_assistant_content` (RAG excerpt, greetings, quota hints) — 482–525  

### Non-streaming (`generate_assistant_response`, 752–779)

Same order using `_call_gemini` instead of `_stream_gemini`.

### Per-call Gemini internals (`_call_gemini`, 146–171)

- Primary: `google-genai` with optional Google Search grounding  
- Fallback: `google.generativeai` legacy  
- Model list: `_gemini_models_to_try()` — settings model + `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.0-flash` (16–24)

When `GEMINI_API_KEY` is empty, `_gemini_configured()` is false (`config.py` 126–127) and Gemini paths are skipped entirely.

---

## 4. pgvector embedding storage

**Primary persistence (survives Railway redeploy):** PostgreSQL `embeddings` table with pgvector cosine search (`db.py`, `vector_store_service.py`).

**Upload binary:** `backend/data/uploads/{file_id}{ext}` (`files.py`)

**Embedding path:** Gemini `gemini-embedding-001` (768 dimensions) via Google GenAI API. Version tracked as `gemini-embedding-001-v768` on `uploaded_files.embedding_model_version`.

**Row schema:** Each chunk → one `embeddings` row: `chunk_text`, pgvector `embedding`, `page`, `chunk_index`, FK `file_id`.

**Search:** Query embedded with same model; pgvector `<=>` cosine similarity; top-k merged across files.

**Page retrieval:** `detect_page_query()` + `get_page_content()` reads `embeddings.page` directly — used for "what's on page N" queries.

**Dev fallback:** Keyword overlap search when Gemini embed or pgvector fails (`_simple_chunk_search`).

**SQLite local dev:** No pgvector — pytest mocks embedding writes; production requires PostgreSQL with pgvector extension.

**Legacy:** Older FAISS blob columns removed via Alembic migration `a1b2c3d4e5f6_drop_legacy_faiss_blob_columns`.

---

## 5. SSE streaming architecture

### Backend format

```253:279:backend/app/services/chat_service.py
def format_sse(text: str) -> str:
    """Format a single SSE event: data: <text>\\n\\n (multi-line safe)."""
    ...
    return f"data: {text}\n\n"

def format_sse_done(assistant_message: Message) -> str:
    payload = json.dumps({"event": "done", "id": ..., "content": ..., ...})
    return f"data: {payload}\n\n"
```

- Chunk events: plain text in `data:` lines  
- Terminal event: JSON with `"event": "done"`  
- **There is no `[DONE]` string terminator**

### HTTP response

`StreamingResponse(..., media_type="text/event-stream")` with `Cache-Control: no-cache`, `X-Accel-Buffering: no` (`chat.py` 131–138).

### Frontend consumption

`fetch` + `response.body.getReader()` + `TextDecoder` (`client/src/api/chat.ts` 146–180). Buffers until `\n\n`, parses `data:` lines, `parseSsePayload` distinguishes JSON `done` vs text chunk (68–102).

---

## 6. Widget state (compact / expanded)

**Owner:** `client/src/components/ChatbotWidget/index.tsx`

| State | Purpose |
|-------|---------|
| `messages`, `files`, `activeConversation` | Shared chat data |
| `conversations`, `starredIds`, `archivedIds`, `trashedIds` | Lists & client-side folders |
| `isOpen`, `isExpanded` | Launcher vs compact vs full workspace |
| `streamControllerRef` | Active stream `AbortController` |
| `isTyping` | Local to `CompactWidget` / `ExpandedWidget` (not in parent) |

`sharedProps` (283–301) passed to both shells. `onCollapse` / `onExpand` only toggle `isExpanded`; parent state is preserved.

---

## 7. Database schema

Defined in `backend/app/database/db.py`. Tables created via `Base.metadata.create_all` in `main.py`, with idempotent column/index patches in `database/migrations/startup.py`.

### `users`

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| email | String(255) unique | |
| hashed_password | String(255) | bcrypt |
| is_active | Boolean | default true |
| created_at | DateTime | |

**Relationships:** `conversations` → cascade `all, delete-orphan`

### `conversations`

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | Not UUID |
| title | String(255) nullable | |
| user_id | FK → users.id | **ON DELETE CASCADE** |
| created_at | DateTime | |

**Relationships:** `messages`, `files` → cascade delete-orphan

### `messages`

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| conversation_id | FK → conversations.id | **CASCADE** |
| role | String(50) | user / assistant |
| content | Text | |
| has_pdf, pdf_content, pdf_filename | Boolean / Text / String | PDF export |
| created_at | DateTime | |

### `uploaded_files`

| Column | Type | Notes |
|--------|------|-------|
| id | String(255) PK | UUID string |
| conversation_id | FK | **CASCADE** |
| filename, file_path | String | |
| status | String(50) | pending → extracting → embedding → processed / failed |
| status_detail | Text nullable | Progress ("Reading 256 pages…", "OCR page 12 of 256…") |
| pdf_page_count | Integer nullable | Total PDF pages detected at upload |
| indexed_page_count | Integer nullable | Pages successfully embedded |
| embedding_model_version | String nullable | e.g. `gemini-embedding-001-v768`; drives stale detection |
| raw_text_blob | Text nullable | Optional extracted text cache |
| processing_error | Text nullable | Failure reason when `status=failed` |
| created_at | DateTime | |

**Relationships:** `embeddings` → cascade delete-orphan

### `embeddings`

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| file_id | FK → uploaded_files.id | **CASCADE** |
| chunk_text | Text | Chunk content, often prefixed `[Page N]` |
| embedding | Text | pgvector-formatted float vector |
| chunk_index | Integer | Order within file |
| page | Integer | Page number for PDF chunks (default 1) |
| created_at | DateTime | |

### `audit_logs`

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| user_id | FK → users.id nullable | **SET NULL** on user delete |
| action | String(100) | e.g. `login`, `file_upload`, `file_delete` |
| ip_address | String(45) nullable | From `get_real_ip()` |
| metadata_json | Text nullable | JSON blob |
| created_at | DateTime | |

### `gemini_daily_usage`

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| user_id | FK → users.id | **CASCADE** |
| usage_date | String(10) | `YYYY-MM-DD` UTC |
| call_count | Integer | Incremented per Gemini call |
| created_at | DateTime | |

Unique on `(user_id, usage_date)`.

---

## 8. Background file embedding

```
BackgroundTasks → _run_embedding_background → daemon Thread → process_file_embedding
```

- Uses a **separate** `SessionLocal()` session (`files.py`)
- Status updates: `pending` → `extracting` → `embedding` → `processed` / `failed`
- **Server restart:** daemon thread is killed; row may stay mid-processing — re-upload or call `POST .../files/{id}/reindex` (API exists; frontend re-index UI removed)
- **Indexed data in PostgreSQL `embeddings` survives redeploy**
- **Tests:** `INLINE_FILE_PROCESSING=1` runs embedding synchronously (`files.py`; `conftest.py`)

---

## 9. Authentication & JWT lifecycle

| Step | Location |
|------|----------|
| Signup / login UI | `WidgetAuthPanel.tsx` → `api/auth.ts` |
| Token issuance | `auth.py` 29–33 — `create_access_token({"sub": email, "id": user.id})` |
| Storage | `localStorage.setItem('token', ...)` |
| API calls | Axios interceptor + `fetch` Bearer header |
| Validation | `get_current_user` → `verify_token` → `get_user_by_id` (`auth_service.py` 49–71) |
| Expired / invalid token | `verify_token` returns `None` → **401** Unauthorized |

Password hashing: **bcrypt** directly in `backend/app/core/security.py` (not passlib).

---

## 10. ~100 concurrent users — bottlenecks

- Default **SQLite** — write contention; no pgvector (tests mock embeddings)
- **Per-file embedding** in threads + network-bound Gemini embed + OCR API calls
- **pgvector search** per query — embed query then SQL similarity
- Long-lived **SSE** connections per active chat  
- **Per-user Gemini quota** (100/day UTC) limits LLM cost abuse  
- **Auth rate limiting** (in-memory per IP on login/signup) and **response cache** are per-process — not shared across Railway replicas  
- Single-process Uvicorn unless horizontally scaled with shared DB (vector blobs in DB)

---

## 11. Security & configuration (critical)

### JWT `SECRET_KEY` (required)

`config.py` has **no insecure default**. `SECRET_KEY` must be set via environment (minimum 32 characters). The app **refuses to start** without it, except when `ENVIRONMENT=test` (pytest sets a test key in `conftest.py`).

Also set `ENVIRONMENT=production` on Railway to enable `Strict-Transport-Security`.

### Security headers middleware

`SecurityHeadersMiddleware` (`middleware/security_headers.py`) attaches on every response:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera, microphone, geolocation, payment disabled)
- `X-XSS-Protection: 0`
- `Strict-Transport-Security` (production only)

### Prompt sanitization

`core/sanitizer.py` strips common injection patterns from user messages before RAG/LLM. If the message is only injection content after sanitization, `chat_service` returns **400**. Sanitization logs **message length only** (`len %d -> %d`), never message content.

### Request body size limits

`main.py` middleware enforces per-route caps: **1 MB** on `/api/v1/chat/*` message routes; **52 MB** on file upload routes. Oversize requests return **413**.

### MIME validation on upload

`validate_upload_mime()` in `core/mime_validation.py` runs before save:

1. Extension + declared Content-Type allowlist  
2. First **512 bytes** magic-byte check via `python-magic` (with fallback heuristics)

Rejects mismatches with **415**. Supports PDF, DOCX, XLS/XLSX, TXT, MD, CSV, JSON, LOG.

### Auth rate limiting

`auth_rate_limit_service.py` — in-memory sliding window per client IP:

- Separate scopes: `login:` and `signup:`  
- Default: **5** failed attempts per **60** seconds (`AUTH_RATE_LIMIT_*`)  
- Returns **429** with `Retry-After` when exceeded  
- Successful login/signup clears the scope for that IP

### Audit logging

`audit_service.py` writes to `audit_logs` table (best-effort, background). Hooks in `auth.py`, `chat.py`, `files.py` for **login**, message send/stream, generate, upload, file delete, and conversation delete. Signup is rate-limited but not audit-logged. Failures do not block the request.

### Gemini daily quota (cost protection)

`quota_service.py` tracks `GeminiDailyUsage` per user per **UTC calendar day**. Default limit: **100** (`GEMINI_DAILY_QUOTA_PER_USER`). Checked in `chat_service.ensure_gemini_quota()` before Gemini calls. Cached responses skip quota consumption.

Returns **429** with JSON `detail.retry_after_seconds`, `detail.reset_at`, and `Retry-After` header.

### Response cache (no Redis)

`response_cache.py` uses `cachetools.TTLCache` (default TTL 3600s, max 500 entries). Cache key = `(user_id, normalized_question, rag_digest, use_search)` — prevents cross-user cache bleed. Assistant `MessageResponse` includes `cache_hit: true` when served from cache.

### Embedding versioning

`uploaded_files.embedding_model_version` tracks the model used to build each file's vectors. `vector_store_service.py` auto-reindexes stale rows before search. `GET /api/v1/admin/embedding-health` (JWT, user-scoped) reports per-file version and `stale` flag.

### File delete

`DELETE /api/v1/chat/conversations/{id}/files/{file_id}` in `files.py`:

1. `require_conversation_access()` — **403** if JWT user is not conversation owner (other routes still use **404**)  
2. DB row deleted and committed first  
3. `delete_file_data()` removes disk file and cascaded `embeddings` rows

Frontend: `FileListItem.tsx` — status badges (`extracting`/`embedding`), `status_detail` progress, trash icon, inline confirm, optimistic remove in `ExpandedWidget.tsx` / `MobileFilesPanel.tsx`. Re-index button removed from UI (backend `POST .../reindex` still available).

### Proxy-aware client IP + Cloudflare

`get_real_ip()` in `core/network.py` reads `CF-Connecting-IP`, `True-Client-IP`, `X-Real-IP`, `X-Forwarded-For`.

When `CLOUDFLARE_ONLY=true`, only trusts `CF-Connecting-IP` from IPs in Cloudflare published ranges. Ranges are fetched on startup and refreshed every **24h** in `main.py` lifespan.

### Conversation ownership (Q16)

All chat/file routes resolve conversations with **both** `conversation_id` and `user_id`:

```638:648:backend/app/services/chat_service.py
def get_conversation(db: Session, conversation_id: int, user_id: int) -> Conversation:
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id
    ).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
```

IDs are **integers**, not UUIDs. Guessing another user’s numeric id without their JWT returns **404**, not the other user’s data.

### `db.commit()` locations (Q27)

| File | Line | Context |
|------|------|---------|
| `auth_service.py` | 36 | User signup |
| `chat_service.py` | 443 | Auto-title |
| `chat_service.py` | 622 | Create conversation |
| `chat_service.py` | 668 | Rename conversation |
| `chat_service.py` | 677 | Delete conversation |
| `chat_service.py` | 703 | Create message (including end of stream) |
| `files.py` | 118 | Upload record |
| `files.py` | 40 | Embedding success |
| `files.py` | 52 | Embedding failed |

Assistant streaming does **not** commit per chunk — only one commit when the full assistant message is saved.

### CORS (Q15)

`main.py` 52–63: explicit `allow_origins` from `CORS_ORIGINS` (default localhost Vite ports) plus optional `allow_origin_regex` (default `https://.*\.vercel\.app`). **Arbitrary domains cannot call the API** unless listed or matched by regex.

### Unauthenticated endpoints (Q18)

| Method | Path |
|--------|------|
| GET | `/` |
| GET | `/health` |
| POST | `/api/v1/auth/signup` |
| POST | `/api/v1/auth/login` |
| GET | `/docs`, `/api/v1/openapi.json` |

All `/api/v1/chat/*` and `GET /api/v1/auth/me` require `get_current_user`.

### File upload validation

- **Size:** 100MB per file — `files.py`; **52 MB** request body cap on upload route (`main.py` middleware → 413)  
- **MIME:** Extension + Content-Type + magic bytes in `mime_validation.py` (415 on unsupported types)  
- **Delete:** `DELETE .../files/{id}` — see [File delete](#file-delete) above  
- **Frontend:** `FileUploadModal.tsx` shows all files in picker (no `accept` filter); validates after selection via `constants/uploadFormats.ts`; `FileListItem.tsx` for delete UX

### SQL injection (Q14)

SQLAlchemy ORM filters with bound parameters — no raw SQL concatenation of user input in app services.

### Client-side folders

Archived / Trash use `client/src/utils/conversationFoldersStorage.ts` (localStorage), not server-side status fields.

---

## 12. Services, prompts, and error handling

### `build_rag_context` (Q19)

- No processed files → `""` (731–733)  
- With files → up to 5 chunks joined `\n\n` (738–743)  
- Exception → log + `""` (744–749)

### `detect_pdf_request` (Q20)

Requires word `pdf` (regex `\bpdf\b`). Multiple phrase patterns (`chat_service.py` 290–334). Misses requests without “pdf” (e.g. “export as Word”).

### Auto-title (Q23)

In `_prepare_assistant_context` (437–443): if title is default (`New Conversation`, `New Chat`, `Conversation`), set to first 40 chars of user message — **not** an LLM call.

### Generate endpoint (Q29)

`POST .../generate` → `generate_conversation_file` → `_build_document_prompt` for `summary` | `report` | `analysis` (`809–855`) → `generate_text` (Gemini then OpenAI). Returns JSON text content for client download.

### Full Gemini prompt shape (Q28)

With RAG (`455–477`):

- System: Remi + must use document context + `MARKDOWN_INSTRUCTION`  
- `DOCUMENT CONTEXT: """..."""`  
- History: `{Role}: {content}` lines  
- `User: {message}\nAssistant:`

Without RAG (`467–473`): general assistant + Google Search hint when no document context.

### Corrupted PDF (Q25)

`extract_text` raises `ValueError` on parse failure (`file_parser_service.py` 51–52) → embedding sets `failed`.

### Service try/catch summary (Q30)

| Area | Behavior |
|------|----------|
| `build_rag_context` | try → return `""` |
| `process_file_embedding` | try → `failed` status |
| Gemini / OpenAI | per-model try, fall through |
| `get_conversation` | HTTP 404, no catch |

---

## 13. Frontend implementation

### Shared state (Q31)

See [§6](#6-widget-state-compact--expanded). Entry: `App.tsx` → `FloatingWidget` → `index.tsx`.

### `streamMessage` / ReadableStream (Q32)

`client/src/api/chat.ts` 146–180 — `getReader()`, decode UTF-8, split SSE blocks on `\n\n`.

### AbortController on close (Q33) — **gap**

`abortActiveStream` runs on conversation switch, new chat, logout, unmount (`index.tsx` 46–51, 92, 188, 174–178).

**`close()` does not abort** (265–268) — stream may continue until completion if the widget is only hidden.

### File polling

`index.tsx`:

- Interval: **1500 ms** while any file is `pending`  
- Stops: no `pending` files, fetch error, **5 minute** timeout, effect cleanup  

### Nav tooltips & file count in chat

- `NavTooltip.tsx` + `WidgetTooltipProvider` — Radix tooltips on header/toolbar/tab buttons  
- Chat header pill shows uploaded file count; **0 files** opens upload modal; **1+** navigates to Files panel  
- `RateLimitBanner.tsx` — countdown on 429 from `client/src/api/rateLimit.ts`

### Upload & file list UX

- `FileUploadModal.tsx` — drag-and-drop, validation error banner; supported: PDF, DOCX, XLS/XLSX, TXT, MD, CSV, JSON, LOG  
- `FileListItem.tsx` — status badge, trash icon, inline delete confirm; calls `deleteFile()` in `api/files.ts`  
- `ExpandedWidget.tsx` / `MobileFilesPanel.tsx` — optimistic file removal + toast on success

### Message edit (Q38)

`MessageEditModal.tsx` calls non-stream `sendMessage` → `POST .../messages` (creates new user + assistant on server), then `onReplaceEditedMessage` updates local React state.

### PDF download (Q36)

`has_pdf` + `pdf_content` on assistant message → `generatePDFFromContent` (`utils/pdfGenerator.ts`, triggered from `streamSend.ts` 84–88).

### Character counter (Q37)

`ChatInterface.tsx`: `MAX_INPUT_LENGTH = 2000`, display `{input.length}/{MAX_INPUT_LENGTH}` (lines 25, 637–640).

### Animations (Q39)

- **CSS:** `client/src/styles/animations.css`, mapped in `tailwind.config.js` (`widgetIn`, `slideInUp`, `bubbleIn`, `dotWave`, …)  
- **Framer Motion:** `RemiSphere.tsx` only (launcher glow + expression morph)

### RemiSphere (Q40)

`setInterval` every **2500 ms** cycles expressions (`RemiSphere.tsx` 68–74); `AnimatePresence` + `motion.g` for face transitions. In-widget header uses `RemiAvatar2D`, not `RemiSphere`.

### Dead / low-use code (Q35)

- `getConversationDetail` exported in `chat.ts` (~260) — not imported elsewhere  
- Some `animations.css` utilities unused (e.g. `remi-pulse`)  
- Voice `Mic` buttons disabled in UI (stubs)

---

## 14. HTTP, CORS, networking

| Topic | Detail |
|-------|--------|
| Status codes (Q41) | 201 signup; 401 auth; 400 duplicate email; 404 wrong conversation; 413 large upload; 422 validation; 500 disk write — see `backend/tests/test_api_*.py` |
| Multipart (Q42) | `FormData` + `Content-Type: multipart/form-data` — `client/src/api/files.ts` |
| SSE format (Q43) | `data: ...\n\n`; terminal JSON `event: done` — no `[DONE]` |
| Dev API URL (Q44) | Direct `VITE_API_URL` (default `http://localhost:8000`); **no Vite proxy** — `client/vite.config.ts` |
| Caching (Q45) | SSE: `Cache-Control: no-cache`; no general API HTTP caching |

---

## 15. Tests & coverage gaps

### Test modules (191 tests total)

| File | Focus |
|------|-------|
| `backend/tests/test_api_health.py` | `/`, `/health` |
| `backend/tests/test_api_auth.py` | signup, login, me |
| `backend/tests/test_api_chat.py` | conversations, messages, stream |
| `backend/tests/test_api_files.py` | upload, list, reindex |
| `backend/tests/test_api_edge_cases.py` | isolation, PDF, generate, RAG mocks |
| `backend/tests/test_security_features.py` | security headers, MIME, quota 429 |
| `backend/tests/test_network.py` | `get_real_ip` proxy headers |
| `backend/tests/unit/test_sanitizer.py` | prompt injection stripping |
| `backend/tests/unit/test_response_cache.py` | per-user cache keys, `cache_hit` |
| `backend/tests/unit/test_mime_validation.py` | magic-byte validation |
| `backend/tests/unit/test_request_body_limits.py` | 1 MB / 52 MB middleware |
| `backend/tests/unit/test_quota_service.py` | UTC reset, `reset_at` |
| `backend/tests/unit/test_audit_service.py` | audit log writes |
| `backend/tests/unit/test_auth_rate_limit.py` | login/signup 429 |
| `backend/tests/unit/test_vector_store_versioning.py` | embedding version + reindex |
| `backend/tests/unit/test_admin_embedding_health.py` | `/admin/embedding-health` |
| `backend/tests/unit/test_rag_routing.py` | document-first routing, page queries |
| `backend/tests/unit/test_page_extraction.py` | page chunks, extraction counts |
| `backend/tests/unit/test_deep_extraction.py` | OCR all candidate pages |
| `backend/tests/unit/test_rag_quality_service.py` | RAG quality tiers |
| `backend/tests/unit/test_two_tier_retrieval.py` | tiered prompt routing |
| `backend/tests/unit/test_file_delete.py` | delete atomicity, 403 non-owner |
| `backend/tests/unit/test_network.py` | Cloudflare IP validation |

### `conftest.py` autouse mocks

- Empty `GEMINI_API_KEY` / `OPENAI_API_KEY` (69–73)  
- No-op `chunk_and_store` by default (76–82)  
- `INLINE_FILE_PROCESSING=1` (63–66)  
- Shared in-memory SQLite + patched `SessionLocal` for background tasks (56–60)

### Gaps (Q47–49)

- No dedicated tests for real pgvector / Gemini embed API (mocked in API tests)  
- No corrupted-PDF fixture tests  
- No frontend tests for stream abort on widget close or file delete UI  
- In-memory auth rate limit / response cache not tested under multi-replica deployment

### Remove `GEMINI_API_KEY` (Q50)

App starts; chat uses OpenAI if configured, else `_fallback_assistant_content` — no crash.

---

## 16. Known gaps & follow-ups

| Issue | Severity | Notes |
|-------|----------|-------|
| Widget `close()` does not abort SSE | Medium | Fix: call `abortActiveStream()` in `close()` |
| `chunk_overlap` unused in `split_text` | Low | Parameter exists but not applied |
| Embedding jobs lost on restart | Low–Medium | `embeddings` rows survive; mid-processing rows may need re-upload/reindex |
| ML / pgvector missing locally | Info | SQLite tests mock embeddings; Postgres + pgvector required for full RAG |
| Message edit creates duplicate user rows | Low | `sendMessage` POST adds new user message server-side |
| Archived/Trash client-only | Info | Not synced across devices |
| In-memory rate limit + cache per replica | Medium | Use Redis when scaling Railway horizontally |
| Sentry / admin RBAC | Low | `SENTRY_DSN` unused; `embedding-health` is user-scoped only |
| Conversation Detail tabs | Medium | `getConversationDetail()` unused; no tabbed detail view |
| Embed: no Shadow DOM / iframe SDK | Low | Script-tag bundle ships; host-page CSS isolation via `.remi-widget-root` only |

---

## Quick file index

| Area | Primary paths |
|------|----------------|
| API entry | `backend/app/main.py`, `backend/app/api/v1/` |
| Chat / LLM | `backend/app/services/chat_service.py` |
| RAG | `vector_store_service.py`, `file_parser_service.py` |
| Quota / cache | `quota_service.py`, `response_cache.py` |
| Security | `core/sanitizer.py`, `core/mime_validation.py`, `core/network.py`, `middleware/security_headers.py` |
| Auth / audit | `auth_service.py`, `auth_rate_limit_service.py`, `audit_service.py`, `core/security.py` |
| Admin | `backend/app/api/v1/admin.py` |
| Migrations | `database/migrations/startup.py`, `versions/20250603_0001_*.py` |
| File delete UI | `client/src/components/ChatbotWidget/FileListItem.tsx`, `api/files.ts` |
| Models | `backend/app/database/db.py` |
| Widget shell | `client/src/components/ChatbotWidget/index.tsx` |
| Streaming client | `client/src/api/chat.ts`, `streamSend.ts` |
| Config | `backend/app/config.py`, repo-root `.env.local`, `client/vite.config.ts` |
