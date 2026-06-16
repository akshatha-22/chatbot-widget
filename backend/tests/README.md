# Backend API Tests

Automated tests for the Remi chatbot **FastAPI** backend (`backend/app/`).

## Stack

| Tool | Purpose |
|------|---------|
| **pytest 7.4** | Test runner |
| **pytest-asyncio** | Available for async tests (current suite is sync) |
| **httpx** (via FastAPI) | HTTP client for `TestClient` |
| **FastAPI `TestClient`** | In-process API calls without starting uvicorn |
| **SQLAlchemy in-memory SQLite** | Isolated DB per test (`sqlite://` + `StaticPool`) |
| **`unittest.mock.patch`** | Mocks FAISS indexing on file upload (no ML model load) |

No live **Gemini** or **OpenAI** calls during tests — `conftest.py` clears API keys so chat uses the built-in local fallback.

## Layout

```
tests/
├── conftest.py              # DB override, TestClient, auth + conversation fixtures
├── test_api_health.py       # GET /, GET /health
├── test_api_auth.py         # POST signup/login, GET /auth/me
├── test_api_chat.py         # Conversations, messages, SSE stream
├── test_api_edge_cases.py   # Auth isolation, PDF, generate, RAG, file failures
├── test_api_files.py        # Upload + list files (vector store mocked)
├── test_security_features.py # Security headers, MIME, quota 429
├── test_network.py          # get_real_ip proxy headers
├── unit/
│   ├── test_sanitizer.py           # Prompt injection stripping
│   ├── test_response_cache.py      # Per-user cache keys, cache_hit
│   ├── test_mime_validation.py     # Magic-byte MIME validation
│   ├── test_request_body_limits.py # 1 MB chat / 52 MB upload caps
│   ├── test_quota_service.py       # UTC reset, reset_at in 429
│   ├── test_audit_service.py       # Audit log writes
│   ├── test_auth_rate_limit.py     # Login/signup 429 per IP
│   ├── test_vector_store_versioning.py  # embedding_model_version + reindex
│   ├── test_admin_embedding_health.py  # GET /admin/embedding-health
│   ├── test_file_delete.py         # Delete atomicity, 403 non-owner
│   └── test_network.py             # Cloudflare IP validation
└── README.md                # This file
```

Legacy empty placeholders (`test_chat.py`, `integration/*`, etc.) are unused; `test_api_*.py` and `tests/unit/` are the active suite.

## Run tests

From the `backend/` directory:

```bash
# Activate venv first (Windows)
venv\Scripts\activate

# CI / quick test install (no torch — matches GitHub Actions)
pip install -r requirements-ci.txt

# Full local dev (RAG / FAISS / embeddings)
pip install -r requirements.txt

python -m pytest tests/ -v
```

Run a single module:

```bash
python -m pytest tests/unit/test_file_delete.py -v
python -m pytest tests/test_api_auth.py -v
```

## Fixtures (`conftest.py`)

| Fixture | Description |
|---------|-------------|
| `db_engine` | In-memory SQLite engine; creates/drops tables per test |
| `db_session` | SQLAlchemy session bound to test engine |
| `client` | `TestClient(app)` with `get_db` overridden to use test session |
| `disable_external_llm_keys` | Autouse — blanks `GEMINI_API_KEY` and `OPENAI_API_KEY` |
| `auth_headers` | Signs up `tester@example.com`, logs in, returns `Authorization: Bearer …` |
| `make_auth_headers` | Factory to sign up/log in arbitrary users (multi-user tests) |
| `upload_dir` | Temp upload directory (monkeypatches `UPLOAD_DIR`) |
| `conversation_id` | Creates one conversation for the authenticated user |

## Coverage by area

### Health
- `GET /` — welcome payload
- `GET /health` — `{"status": "healthy"}`

### Auth (`/api/v1/auth`)
- `POST /signup` — success, duplicate email (400), invalid email (422), short password (422)
- `POST /login` — success, wrong password (401)
- `GET /me` — 401 without token, profile with token
- Auth rate limiting — 429 after repeated failed login/signup (`unit/test_auth_rate_limit.py`)

### Chat (`/api/v1/chat`)
- `POST /conversations` — create
- `GET /conversations` — list
- `GET /conversations/{id}` — detail
- `PATCH /conversations/{id}` — rename
- `DELETE /conversations/{id}` — delete (204)
- `POST /conversations/{id}/messages` — user + assistant pair (local fallback)
- `GET /conversations/{id}/messages` — list messages
- `POST /conversations/{id}/messages/stream` — SSE content-type and `data:` events
- 401 without auth, 404 for unknown conversation

### Files (`/api/v1/chat/conversations/{id}/files`)
- `POST …/files` — upload `.txt`, status `processed` (indexing mocked)
- `GET …/files` — list uploaded file
- `DELETE …/files/{id}` — owner delete (204); non-owner **403** (`unit/test_file_delete.py`)
- 401 without auth, 404 for unknown conversation

### Security & infrastructure (`unit/` + `test_security_features.py`)
- Security headers middleware (production HSTS when `ENVIRONMENT=production`)
- MIME magic-byte validation (415)
- Request body size limits (413)
- Prompt sanitization (400 on injection-only messages)
- Per-user response cache keys + `cache_hit`
- Gemini quota UTC reset + `reset_at` in 429
- Audit log background writes
- Embedding `embedding_model_version` + `/admin/embedding-health`
- Cloudflare IP range validation (`CLOUDFLARE_ONLY`)
- `get_real_ip()` proxy header precedence

### Edge cases (`test_api_edge_cases.py`)

**Auth:** unknown email login, case-insensitive duplicate signup, missing fields, invalid/malformed JWT

**Isolation:** user B cannot get/post/delete/upload on user A's conversation (404)

**Conversations:** default title, auto-title from first message, empty rename keeps title, double delete, invalid id type (422), newest-first ordering, cascade delete of messages

**Messages:** oldest-first ordering, empty content (allowed today), 404 on missing conversation

**PDF & generate:** PDF intent sets `has_pdf` / `pdf_content`; generate with empty chat; invalid type/format normalized; generate requires auth

**SSE:** `done` event JSON shape; PDF stream `done` includes `has_pdf`; stream 404

**Files:** empty file list, upload without file (422), parse failure (422), index failure (422), DOCX path (parser mocked), RAG search invoked after upload (search mocked)

## Not covered (yet)

- Expired JWT (time-based)
- Real PDF/DOCX/XLSX binary parsing (only mocked parser paths)
- Real FAISS / `sentence-transformers` load and search
- Multi-replica in-memory rate limit / cache behavior
- Concurrent requests / race conditions
- Frontend file delete UI or stream abort on widget close

## Last verified

**105 tests** passing (`python -m pytest tests/ -v`) on Python 3.12 with dependencies from `requirements.txt`.
