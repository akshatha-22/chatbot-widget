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
| **`unittest.mock.patch`** | Mocks pgvector embedding writes on file upload (SQLite has no pgvector) |

No live **Gemini** or **OpenAI** calls during tests — `conftest.py` clears API keys so chat uses the built-in local fallback.

## Layout

```
tests/
├── conftest.py              # DB override, TestClient, auth + conversation fixtures
├── test_api_health.py       # GET /, GET /health
├── test_api_auth.py         # POST signup/login, GET /auth/me
├── test_api_chat.py         # Conversations, messages, SSE stream
├── test_api_edge_cases.py   # Auth isolation, PDF, generate, RAG, file failures
├── test_api_files.py        # Upload + list + reindex (vector store mocked)
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
│   ├── test_rag_routing.py         # Document-first routing, page queries
│   ├── test_page_extraction.py     # Page chunks, extraction counts
│   ├── test_deep_extraction.py     # OCR all candidate pages
│   ├── test_rag_quality_service.py # RAG quality tiers
│   ├── test_two_tier_retrieval.py  # Tiered prompt routing
│   ├── test_row_chunking.py         # Row-aware chunking
│   ├── test_prompt_routing.py       # Prompt routing helpers
│   ├── test_gemini_quota.py         # Fail-fast on 429, OCR worker stop
│   ├── test_grounding_links.py      # Web search grounding links
│   ├── test_page_coverage_honesty.py # Honest page coverage from embeddings
│   ├── test_embedding_status.py     # Processing status transitions
│   ├── test_exact_match_search.py   # Keyword / exact-match fallback
│   ├── test_embedding_config.py     # Embedding model config
│   ├── test_document_override_prompt.py  # Document override in prompts
│   ├── test_batch_embedding.py      # Batch embed behavior
│   ├── test_file_delete.py         # Delete atomicity, 403 non-owner
│   └── test_network.py             # Cloudflare IP validation
└── README.md                # This file
```

## Run tests

From the `backend/` directory:

```bash
# Activate venv first (Windows)
venv\Scripts\activate

# CI / quick test install (no torch — matches GitHub Actions)
pip install -r requirements-ci.txt

# Full local dev (Gemini embed + pgvector — requires PostgreSQL for real RAG)
pip install -r requirements.txt

python -m pytest tests/ -v
```

Run a single module:

```bash
python -m pytest tests/unit/test_rag_routing.py -v
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
- Signup, login, me, rate limiting, validation errors

### Chat (`/api/v1/chat`)
- Conversation CRUD, messages, SSE stream, generate

### Files (`/api/v1/chat/conversations/{id}/files`)
- Upload, list, delete, reindex (indexing mocked in most tests)

### RAG & routing (`unit/test_rag_routing.py`, `test_two_tier_retrieval.py`, `test_prompt_routing.py`)
- Document-first routing before web search
- Page query direct retrieval
- Pending file blocking
- Web fallback when question unrelated to documents

### Quota & embeddings (`test_gemini_quota.py`, `test_page_coverage_honesty.py`, `test_batch_embedding.py`)
- Fail-fast on embedding 429
- Honest page coverage from live `embeddings` rows
- Batch embedding behavior

### Security & infrastructure
- Security headers, MIME validation, body limits, sanitization
- Per-user cache, Gemini quota, audit logs, embedding health

## Not covered (yet)

- Expired JWT (time-based)
- Real pgvector / Gemini embed API calls (mocked in API tests)
- Real multi-page PDF OCR end-to-end against live Gemini
- Multi-replica in-memory rate limit / cache behavior
- Frontend stream abort on widget close or file delete UI (embed mount covered in `client/tests/unit/embed.test.ts`)

## Last verified

**203 tests** passing (`python -m pytest tests/ -v`) on Python 3.12 with dependencies from `requirements.txt`.  
**9 additional tests** in `client/tests/unit/embed.test.ts` (Vitest) — **212 total** across the monorepo.
