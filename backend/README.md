# Remi Backend

FastAPI API for the Remi chatbot widget.

## Quick start

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Environment variables are read from `.env.local` at the **repo root** (see root [README](../README.md)).

## Stack

| Layer | Technology |
|-------|------------|
| API | FastAPI + Uvicorn |
| ORM | SQLAlchemy 2 |
| Auth | JWT (python-jose) + bcrypt |
| LLM | Gemini (`google-genai`) + OpenAI fallback |
| RAG | Gemini `gemini-embedding-001` + **pgvector** in PostgreSQL |
| PDF | PyMuPDF + Gemini OCR |

## Key services

| Service | Role |
|---------|------|
| `chat_service.py` | Streaming chat, document-first RAG routing, PDF intent |
| `vector_store_service.py` | Embed chunks, pgvector search, page retrieval |
| `rag_quality_service.py` | RAG context quality tiers (DIRECT / PARTIAL / DEFLECTED / EMPTY) |
| `file_parser_service.py` | PDF/DOCX/XLSX extraction (PyMuPDF all pages + OCR) |
| `files.py` | Upload pipeline: `pending` → `extracting` → `embedding` → `processed` |

## Production notes

- Use **PostgreSQL with pgvector** (`DATABASE_URL` on Railway)
- Set `GEMINI_API_KEY`, `SECRET_KEY` (32+ chars), `ENVIRONMENT=production`
- Set `CORS_ALLOW_ANY_ORIGIN=true` when serving script-tag embeds on third-party domains (see [10_embedding_guide.md](../docs/10_embedding_guide.md))
- Alembic runs on startup — revision chain must include `007_status_detail` → `008_pdf_page_counts`
- Health: `GET /health`

## Tests

```bash
python -m pytest tests/ -v
```

See [tests/README.md](tests/README.md) — **203 backend tests** (+ **9 frontend** Vitest embed tests = **212 total**), pgvector mocked on SQLite.

## Docs

- [ARCHITECTURE.md](../docs/ARCHITECTURE.md) — code-level reference
- [07_deployment_guide.md](../docs/07_deployment_guide.md) — Railway + Vercel
- [10_embedding_guide.md](../docs/10_embedding_guide.md) — script-tag embed (`remi-widget` on npm)
