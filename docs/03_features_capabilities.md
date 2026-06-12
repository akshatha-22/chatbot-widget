# Features & Capabilities

What **Remi** actually ships in this repository versus aspirational ideas that appear in older docs or scaffold folders (`docker/`, optional scripts).

**Code reference:** [ARCHITECTURE.md](./ARCHITECTURE.md) · **User flows:** [01_system_overview.md](./01_system_overview.md)

---

## 1. Core chat (shipped)

| Feature | Implementation |
|---------|----------------|
| Floating launcher | `RemiLauncher.tsx` + `RemiSphere.tsx` — dark sphere, soft blue radial halo (`RemiFace.tsx`); replaced amber/yellow theme |
| Compact chat panel | `CompactWidget.tsx` (~350px, bottom-right) |
| Expanded workspace | `ExpandedWidget.tsx` (full screen on mobile) |
| Streaming replies | SSE via `POST .../messages/stream` + `streamSend.ts` |
| Markdown rendering | `AssistantMarkdown.tsx` + `react-markdown` |
| Typing indicator | Animated dots while streaming |
| Message edit | `MessageEditModal.tsx` — resends via non-stream `POST .../messages`, updates local state |
| Undo/redo in edit modal | Local history stack in modal only |
| Character limit | 2000 chars in `ChatInterface` / edit modal |
| Auto-title | First user message truncates to 40 chars if title is default (`chat_service.py`) |
| Stop double-send | `isSendingRef` guard in `streamSend.ts` |

**Not shipped:** regenerate button, temperature sliders, user-picked model, voice input (Mic buttons are disabled stubs).

---

## 2. File upload & document Q&A (shipped)

| Feature | Implementation |
|---------|----------------|
| Upload formats | PDF, DOCX, XLS/XLSX, TXT, MD, CSV, JSON, LOG (`uploadFormats.ts` + `mime_validation.py`) |
| Max size | **100 MB** per file (`files.py`); **52 MB** request body cap on upload route (`main.py`) |
| Magic-byte MIME | First 512 bytes validated (`python-magic` + fallback) — 415 on mismatch |
| File delete | `DELETE .../files/{id}` — DB-first, then FAISS cache + disk; frontend `FileListItem` with optimistic UI |
| File picker | Shows **all files** — no `accept` filter; client validates after selection |
| Drag-and-drop UI | `FileUploadModal.tsx` with validation error banner |
| Chat file badge | Count in header; tap to upload (0 files) or view Files panel |
| Processing states | `pending` → `processed` / `failed` |
| Background embedding | Daemon thread after upload (`process_file_embedding`) |
| Chunking | ~**500 characters** per chunk (`split_text`) |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` when installed |
| Vector store | FAISS `IndexFlatL2` + **DB blobs** (`faiss_index_blob`, `chunks_blob`) + disk + in-memory cache |
| Dev fallback | Keyword search when FAISS/sentence-transformers not installed |
| Retrieval | Top **5** chunks; L2 or keyword (`vector_store_service.search`) |
| RAG in chat | Injected as `DOCUMENT CONTEXT`; disables Google Search when RAG present |
| Status polling | **1.5s** interval while `pending` (`index.tsx`) |

**Not shipped:** citation links to page numbers, confidence scores, S3 storage, distributed embed queue.

---

## 3. PDF & file generation (shipped)

| Feature | Implementation |
|---------|----------------|
| PDF from chat | `detect_pdf_request()` + `has_pdf` fields + client `jsPDF` |
| Generate panel | Summary / Report / Analysis → `POST .../generate` |
| Export formats (panel) | PDF, DOCX, TXT via client (`FileGenerationPanel`, `exportConversation.ts`) |
| Re-download PDF | Buttons in chat when `has_pdf` on message |

**Not shipped:** server-generated binary PDF bytes on `/generate` (returns markdown/text JSON), email export.

---

## 4. Conversations & dashboard (shipped)

| Feature | Implementation |
|---------|----------------|
| List / create / delete / rename | API + sidebar / mobile list |
| Starred | `localStorage` (`starredStorage.ts`) |
| Archived / Trash filters | `localStorage` (`conversationFoldersStorage.ts`) — **not synced to server** |
| Mobile Chats tab | Category chips: All, Starred, Archived, Trash |
| Full dashboard | `WidgetConversationDashboard.tsx` — table desktop, cards mobile |
| Search & filters | `SearchFilterPanel.tsx` — client-side filter state; date/status/file filters |
| View all link | Opens dashboard view inside expanded widget |

**Not shipped:** backend full-text search API, shared archive across devices, bulk delete API, conversation export from dashboard.

---

## 5. Authentication (shipped)

| Feature | Implementation |
|---------|----------------|
| Sign up | `POST /api/v1/auth/signup` |
| Sign in | `POST /api/v1/auth/login` → JWT |
| Auth rate limiting | 5 failed attempts/min per IP on login and signup (separate scopes; in-memory) |
| Session check | `GET /api/v1/auth/me` on widget open |
| Token storage | `localStorage` key `token` |
| Sign out | Clears token + widget state |
| Password hashing | bcrypt (`core/security.py`) |

**Not shipped:** OAuth, email verification, password reset, refresh tokens, RBAC, cross-tenant admin roles.

---

## 6. Mobile & UX (shipped)

| Feature | Implementation |
|---------|----------------|
| Breakpoint hook | `useIsMobile.ts` (< 768px) |
| Bottom tab bar | Chat / Chats / Files (tooltips + file-count badge on Files tab) |
| Nav tooltips | `NavTooltip.tsx` on header and toolbar buttons |
| Bottom sheets | Modals on mobile (`MessageEditModal`, `FileUploadModal`, `SearchFilterPanel`) |
| Full-screen expanded | `inset-0` on small viewports |
| Safe area | `pb-safe` on tab bar |
| Touch targets | ~44px min on primary controls |

---

## 7. Integration (shipped)

| Feature | Implementation |
|---------|----------------|
| Embed model | Import widget in host React app (`App.tsx` renders `FloatingWidget`) |
| API base URL | `VITE_API_URL` baked at build time (`vite.config.ts`) |
| CORS | Configurable origins + Vercel preview regex |

**Not shipped:** iframe SDK, Shadow DOM isolation, webhooks, public API keys for third parties, WebSocket API (`VITE_WS_URL` in `.env.example` is unused).

---

## 8. Performance & reliability (actual behavior)

| Topic | Behavior |
|-------|----------|
| Streaming | One HTTP connection per message; chunks buffered client-side |
| File poll | 1.5s interval, 5 min max (`index.tsx`) |
| Embedding | CPU-bound in background thread; no distributed queue |
| Response cache | Per-user TTLCache — `(user_id, question, rag_digest, use_search)`; `cache_hit` on assistant messages |
| FAISS versioning | `embedding_model_version` on uploads; auto-reindex on mismatch; `GET /admin/faiss-health` (user-scoped) |
| DB default | SQLite — fine for dev; Postgres recommended for production |
| Stream on widget close | **Does not abort** — known gap (see ARCHITECTURE.md) |

**Not shipped:** Redis, CDN for uploads, offline mode, analytics dashboards.

---

## 9. Security (shipped vs planned)

| Shipped | Not shipped |
|---------|-------------|
| JWT on protected routes (required `SECRET_KEY`, min 32 chars) | Redis-backed distributed rate limits |
| Five security headers on every response; HSTS when `ENVIRONMENT=production` | Content moderation / LLM guardrails service |
| Prompt-injection sanitization (`core/sanitizer.py`) | E2E encryption |
| MIME validation: extension + Content-Type + magic bytes (415) | GDPR data-export automation |
| Per-route body size limits (1 MB chat, 52 MB uploads) | Sentry (env placeholder only) |
| Auth rate limiting on `/login` and `/signup` (429 per IP) | Admin RBAC |
| Audit logging (`audit_logs` table, background, best-effort) | |
| Per-user Gemini daily quota (UTC midnight; 429 + `reset_at`) | |
| Per-user response cache keys (no cross-user cache bleed) | |
| Per-user conversation/file isolation; delete returns 403 for non-owner | |
| bcrypt passwords | |
| Cloudflare IP range validation (`CLOUDFLARE_ONLY`) + 24h refresh | |
| Proxy-aware `get_real_ip()` for audit + rate limits | |
| CORS allowlist + Vercel preview regex | |
| Production deployment hardening | `VITE_API_URL` on Vercel, `ENVIRONMENT=production` on Railway, CORS aligned — live |

---

## 10. Remaining work (not shipped)

| Item | Notes |
|------|-------|
| Conversation Detail tabs | Messages / Files / Generated Files / Details — `getConversationDetail()` in `chat.ts` unused |
| Embeddable npm package | `build:lib` Vite library mode for script-tag / drop-in embedding |

---

## 11. Scaffold / optional (not in runtime app)

These exist as **files or scripts** but are **not wired** into `backend/app/`:

| Artifact | Location |
|----------|----------|
| Kubernetes manifests | `docker/kubernetes/` |
| Empty root `docker-compose.yml` | Root |
| `setup-redis.sh`, `setup-reasoning.sh`, `setup-safety.sh` | `scripts/` |
| `requirements-optional.txt` | Stub |
| Legacy `backend/app/api/chat.py` | Unused duplicate; use `api/v1/chat.py` |

Treat these as future experiments, not current capabilities.

---

## Feature checklist for evaluators

Use this when demoing or writing tests:

- [ ] Sign up and sign in inside widget  
- [ ] Stream a chat reply  
- [ ] Upload PDF and ask a question about it (wait for `processed`)  
- [ ] Delete an uploaded file from Files panel (confirm → toast)  
- [ ] Expand widget; use mobile tabs under narrow viewport  
- [ ] Star a conversation; filter Starred  
- [ ] Archive via ⋮ menu; see Archived tab  
- [ ] Generate summary from Generate panel  
- [ ] Ask “export this as pdf” in chat  

---

## Related docs

- [04_ml_ai_concepts.md](./04_ml_ai_concepts.md) — how RAG/LLM concepts apply here  
- [07_deployment_guide.md](./07_deployment_guide.md) — production setup  
