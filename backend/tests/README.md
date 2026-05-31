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
├── conftest.py          # DB override, TestClient, auth + conversation fixtures
├── test_api_health.py   # GET /, GET /health
├── test_api_auth.py     # POST signup/login, GET /auth/me
├── test_api_chat.py     # Conversations, messages, SSE stream
├── test_api_edge_cases.py  # Auth isolation, PDF, generate, RAG, file failures
├── test_api_files.py    # Upload + list files (vector store mocked)
└── README.md            # This file
```

Legacy empty placeholders (`test_chat.py`, `integration/*`, etc.) are unused; the `test_api_*.py` files are the active suite.

## Run tests

From the `backend/` directory:

```bash
# Activate venv first (Windows)
venv\Scripts\activate

pip install -r requirements.txt
python -m pytest tests/ -v
```

Run a single module:

```bash
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

## Coverage by endpoint

### Health
- `GET /` — welcome payload
- `GET /health` — `{"status": "healthy"}`

### Auth (`/api/v1/auth`)
- `POST /signup` — success, duplicate email (400), invalid email (422), short password (422)
- `POST /login` — success, wrong password (401)
- `GET /me` — 401 without token, profile with token

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

### Edge cases (`test_api_edge_cases.py`)

**Auth:** unknown email login, case-insensitive duplicate signup, missing fields, invalid/malformed JWT

**Isolation:** user B cannot get/post/delete/upload on user A's conversation (404)

**Conversations:** default title, auto-title from first message, empty rename keeps title, double delete, invalid id type (422), newest-first ordering, cascade delete of messages

**Messages:** oldest-first ordering, empty content (allowed today), 404 on missing conversation

**PDF & generate:** PDF intent sets `has_pdf` / `pdf_content`; generate with empty chat; invalid type/format normalized; generate requires auth

**SSE:** `done` event JSON shape; PDF stream `done` includes `has_pdf`; stream 404

**Files:** empty file list, upload without file (422), parse failure (422), index failure (422), DOCX path (parser mocked), RAG search invoked after upload (search mocked)

### Files (`/api/v1/chat/conversations/{id}/files`)
- `POST …/files` — upload `.txt`, status `processed` (indexing mocked)
- `GET …/files` — list uploaded file
- 401 without auth, 404 for unknown conversation

## Not covered (yet)

- Expired JWT (time-based)
- Real PDF/DOCX/XLSX binary parsing (only mocked parser paths)
- Real FAISS / sentence-transformers load and search
- Rate limiting / production middleware
- Concurrent requests / race conditions
- File size limits (not enforced in API today)

## Last verified

55 tests passing (`python -m pytest tests/ -v`) on Python 3.12 with dependencies from `requirements.txt`.
