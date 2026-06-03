# Architecture & Implementation Reference

Technical deep-dive for the **chatbot-widget** monorepo (`client/` + `backend/`). This document is grounded in the running code with file paths and line references. For diagrams and product overview, see also [01_system_overview.md](./01_system_overview.md) and [02_architecture_diagrams.md](./02_architecture_diagrams.md).

**Last aligned with codebase:** main branch (post mobile-responsiveness + folder filters).

---

## Table of contents

1. [Message request lifecycle](#1-message-request-lifecycle)
2. [RAG pipeline](#2-rag-pipeline-end-to-end)
3. [Gemini fallback chain](#3-gemini-unavailable--fallback-chain)
4. [FAISS on disk](#4-faiss-vector-index-on-disk)
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
| 9 | Context | `_prepare_assistant_context` — auto-title, history, RAG, prompt (431–479) |
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
| 7 | `file_parser_service.extract_text` | `file_parser_service.py` 3–52 |
| 8 | `vector_store_service.chunk_and_store` | `vector_store_service.py` 73–96 |
| 9 | `split_text` (chunk_size=500; overlap param unused) | 23–70 |
| 10 | `SentenceTransformer("all-MiniLM-L6-v2")` + FAISS `IndexFlatL2` | 13–20, 86–87 |
| 11 | Write `{file_id}.index` + `{file_id}.chunks` | 91–96 |
| 12 | `status="processed"` + commit | `files.py` 37–40 |

### Chat → retrieval

| Order | Function | File |
|-------|----------|------|
| 1 | `build_rag_context` | `chat_service.py` 717–749 |
| 2 | Query `UploadedFile` where `status == "processed"` | 723–726 |
| 3 | `vector_store_service.search(file_ids, query, top_k=5)` | 738 |
| 4 | Join chunks with `\n\n` | 743 |
| 5 | Inject into `gemini_prompt` as `DOCUMENT CONTEXT` | 455–465 |

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

## 4. FAISS vector index on disk

**Directory:** `backend/data/vector_store/` (`vector_store_service.py` 6–8)

**Per upload (`file_id` = UUID string):**

| File | Contents |
|------|----------|
| `{file_id}.index` | FAISS `IndexFlatL2` written via `faiss.write_index` |
| `{file_id}.chunks` | Pickle of text chunk list |

**Upload binary:** `backend/data/uploads/{file_id}{ext}` (`files.py` 96–99)

**Search metric:** L2 distance on `all-MiniLM-L6-v2` embeddings; results merged across files, sorted by distance, deduplicated (`vector_store_service.py` 99–151).

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

Defined in `backend/app/database/db.py`. Tables created via `Base.metadata.create_all` in `main.py` (11).

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
| status | String(50) | pending → processed / failed |
| created_at | DateTime | |

---

## 8. Background file embedding

```
BackgroundTasks → _run_embedding_background → daemon Thread → process_file_embedding
```

- Uses a **separate** `SessionLocal()` session (`files.py` 25–57)  
- **Server restart:** daemon thread is killed; no job queue; row may stay `pending`; partial FAISS files possible  
- **Tests:** `INLINE_FILE_PROCESSING=1` runs embedding synchronously (`files.py` 122–125; `conftest.py` 63–66)

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

- Default **SQLite** — write contention  
- **Per-file embedding** in threads + CPU-bound `SentenceTransformer`  
- **FAISS** index loaded per search per file — no shared in-memory service  
- Long-lived **SSE** connections per active chat  
- **No rate limiting** in application code  
- Single-process Uvicorn unless horizontally scaled with shared DB + vector store

---

## 11. Security & configuration (critical)

### JWT `SECRET_KEY` (Q11)

```70:73:backend/app/config.py
    SECRET_KEY: str = "super-secret-key-change-in-production-12345"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
```

If `SECRET_KEY` is missing from the environment, the app **still starts** using this default. **Override in production.**

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

### File upload validation (Q13, Q17)

- **Size:** 100MB — `files.py` 16, 90–94; middleware 413 in `main.py` 40–48  
- **Type:** No extension allowlist on upload; parser supports pdf, docx, xlsx/xls, else UTF-8 text (`file_parser_service.py`). `.exe` / `.py` may upload but typically fail parsing → `status="failed"`.

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

### File polling (Q34)

`index.tsx` 143–172:

- Interval: **3000 ms**  
- Stops: no `pending` files, fetch error, **5 minute** timeout, effect cleanup  
- If server never sets `processed`, UI can show `pending` indefinitely after timeout stops polling

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

### Test modules (55 tests total)

| File | Tests | Focus |
|------|-------|-------|
| `backend/tests/test_api_health.py` | 2 | `/`, `/health` |
| `backend/tests/test_api_auth.py` | 8 | signup, login, me |
| `backend/tests/test_api_chat.py` | 11 | conversations, messages, stream |
| `backend/tests/test_api_files.py` | 3 | upload, list |
| `backend/tests/test_api_edge_cases.py` | 31 | edge cases, mocks |

### `conftest.py` autouse mocks

- Empty `GEMINI_API_KEY` / `OPENAI_API_KEY` (69–73)  
- No-op `chunk_and_store` by default (76–82)  
- `INLINE_FILE_PROCESSING=1` (63–66)  
- Shared in-memory SQLite + patched `SessionLocal` for background tasks (56–60)

### Gaps (Q47–49)

- No dedicated unit tests for real FAISS / `sentence-transformers` load  
- No corrupted-PDF fixture tests  
- No frontend tests for stream abort on widget close  
- RAG tested via mocked `vector_store_service.search` in edge cases

### Remove `GEMINI_API_KEY` (Q50)

App starts; chat uses OpenAI if configured, else `_fallback_assistant_content` — no crash.

---

## 16. Known gaps & follow-ups

| Issue | Severity | Notes |
|-------|----------|-------|
| Widget `close()` does not abort SSE | Medium | Fix: call `abortActiveStream()` in `close()` |
| `chunk_overlap` unused in `split_text` | Low | Parameter exists but not applied |
| Default `SECRET_KEY` in repo | High (prod) | Must set env on Railway/production |
| Embedding jobs lost on restart | Medium | Consider queue (Redis/Celery) for production |
| Message edit creates duplicate user rows | Low | `sendMessage` POST adds new user message server-side |
| Archived/Trash client-only | Info | Not synced across devices |

---

## Quick file index

| Area | Primary paths |
|------|----------------|
| API entry | `backend/app/main.py`, `backend/app/api/v1/` |
| Chat / LLM | `backend/app/services/chat_service.py` |
| RAG | `backend/app/services/vector_store_service.py`, `file_parser_service.py` |
| Auth | `backend/app/services/auth_service.py`, `backend/app/core/security.py` |
| Models | `backend/app/database/db.py` |
| Widget shell | `client/src/components/ChatbotWidget/index.tsx` |
| Streaming client | `client/src/api/chat.ts`, `streamSend.ts` |
| Config | `backend/app/config.py`, repo-root `.env.local`, `client/vite.config.ts` |
