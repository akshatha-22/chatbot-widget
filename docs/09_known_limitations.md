# Known Limitations

What constrains **Remi** today — deployment quotas, infrastructure gaps, and deliberate product scope — plus **future work**. Aligned with the current codebase in `backend/` and `client/`.

---

## Documentation map

| Doc | Contents |
|-----|----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Full-stack code reference (RAG, auth, SSE, schema) |
| [01_system_overview.md](./01_system_overview.md) | Executive summary and workflows |
| [02_architecture_diagrams.md](./02_architecture_diagrams.md) | Mermaid diagrams |
| [03_features_capabilities.md](./03_features_capabilities.md) | Shipped vs not shipped |
| [04_ml_ai_concepts.md](./04_ml_ai_concepts.md) | RAG/LLM concepts in this repo |
| [05_project_structure(with_optional_enhancements).md](./05_project_structure(with_optional_enhancements).md) | Directory layout |
| [06_Epics_User_stories_and_Use_cases.md](./06_Epics_User_stories_and_Use_cases.md) | Epics and use cases |
| [07_deployment_guide.md](./07_deployment_guide.md) | Local dev, Vercel + Railway |
| [08_frontend_guide.md](./08_frontend_guide.md) | React, TypeScript, widget components |
| [10_embedding_guide.md](./10_embedding_guide.md) | Script-tag embed on any website |

---

## Quota limitation vs architecture limitation

This is the most important distinction when describing Remi to employers, in a portfolio, or in technical writeups.

```
Architecture limitation = the system is fundamentally incapable of doing this,
                          no matter how many resources you add

Quota limitation        = the system works correctly, but a specific deployment
                          tier (API key / billing plan) has a usage ceiling
```

**Remi’s RAG failure mode on free tier is a quota limitation, not an architecture limitation.**

| | Quota limitation | Architecture limitation |
|---|------------------|-------------------------|
| **Meaning** | Pipeline works; API tier hits a ceiling | Design cannot achieve the goal even with unlimited resources |
| **Remi RAG** | Free-tier Google keys cap embedding/OCR volume | **No** — pgvector search, page-aware chunking, and tiered retrieval work once `embeddings` rows exist |
| **Fix** | Billing upgrade, daily reset, smaller PDFs | Would require redesign (not needed today) |

### What the codebase actually does (when it works)

- **Extraction:** PyMuPDF per-page text + Gemini vision OCR for scanned pages (`file_parser_service.py`)
- **Indexing:** Gemini `gemini-embedding-001` → PostgreSQL **pgvector** (`vector_store_service.py`)
- **Retrieval:** Page lookup → exact string → cosine similarity (`search()`)
- **Chat routing:** Document-first; page queries read live `embeddings` rows, not `pdf_page_count` alone (`chat_service.py`)

Production failures observed on large uploads were **`429 RESOURCE_EXHAUSTED`** from Google — detected in `gemini_errors.is_quota_exhausted()`, not wrong model names or broken retrieval logic.

### Analogy

Same category as *“AWS free tier ran out of compute hours”* — true, real, worth documenting, **not a design flaw**.

---

## Where this limits Remi today (free-tier deployment)

These are honest constraints on the **current deployment**, not evidence that Remi’s engineering is wrong.

| Constraint | What happens | Code / config |
|------------|--------------|---------------|
| **Large scanned PDFs** | A 400+ page image-heavy document can consume much or all of a free-tier day’s OCR + embedding allowance in **one upload** | `_gemini_ocr_pages_parallel`, `EMBED_BATCH_SIZE = 100` |
| **No resume queue** | If quota runs out mid-job, processing stops. User must re-upload after reset or enable billing. No background queue persists partial progress for resume. | Fail-fast in `_get_embeddings_batch`; no queue service |
| **Partial indexing possible** | If 429 hits **after** some embedding batches succeed, the file may be marked `processed` with **partial** rows in `embeddings` — not always `failed` | `chunk_and_store` commits non-empty `insert_rows`; page honesty reports accurate % |
| **Shared API key** | OCR, embedding, and chat all use `GEMINI_API_KEY`. Models are separated (below), but the **key’s tier limits** still apply per model. | `config.py` |

### Three separate Gemini models (mitigation shipped)

| Use | Model (default) | Config |
|-----|-----------------|--------|
| Chat | `gemini-2.5-flash` | `GEMINI_MODEL` |
| OCR (scanned PDFs) | `gemini-2.0-flash-lite` | `GEMINI_OCR_MODEL` |
| Embeddings | `gemini-embedding-001` | `EMBEDDING_MODEL` |

OCR no longer competes with chat for the **same model quota** (the production issue that could block chat after a bad upload). Embedding and OCR still draw from the **same API key** with **per-model** free-tier ceilings.

### Remi application quota (separate from Google tier)

Enforced in `quota_service.py` — **chat only**, not upload embedding/OCR:

| Setting | Default | Purpose |
|---------|---------|---------|
| `GEMINI_DAILY_QUOTA_PER_USER` | `100` | Max Gemini **chat** calls per user per UTC day; UI shows `reset_at` on 429 |

---

## Other known limitations

Beyond Google API quota — documented in [ARCHITECTURE.md](./ARCHITECTURE.md) §16 and [03_features_capabilities.md](./03_features_capabilities.md).

### Infrastructure & deployment

| Limitation | Notes |
|------------|-------|
| **Postgres + pgvector required for real RAG** | SQLite dev/tests mock embeddings; search falls back to keyword overlap. |
| **In-memory cache & rate limits per replica** | `response_cache.py`, `auth_rate_limit_service.py` — breaks with multiple Railway instances without Redis. |
| **Uploads on local disk** | `backend/data/uploads/` — not S3; disk may be ephemeral without persistent volume. |
| **Background thread embedding** | `threading.Thread` in `files.py` — jobs lost on process restart mid-job. |
| **52 MB HTTP body vs 100 MB file cap** | `main.py` caps upload route at 52 MB; `files.py` allows 100 MB — files 52–100 MB fail at middleware. |
| **No distributed job queue** | No Celery/Redis — long OCR/embed runs in API process. |

### RAG & indexing

| Limitation | Notes |
|------------|-------|
| **`MAX_CHUNKS_PER_FILE = 2000`** | Very large files may be capped during indexing. |
| **`MAX_CHARS_PER_PAGE = 3000`** | Per-page text truncated after OCR/extraction. |
| **Top 5 chunks** | General queries inject only five chunks into the prompt. |
| **`chunk_overlap` unused** | Parameter exists in splitter but not applied. |
| **No citation UI** | Page numbers in DB; not shown as citations in widget. |
| **Keyword fallback** | Weaker search when Gemini embed or pgvector fails. |

### Chat & UX

| Limitation | Notes |
|------------|-------|
| **SSE not aborted on widget close** | `close()` in `index.tsx` does not call `abortActiveStream()`. |
| **Message edit duplicates user rows** | `sendMessage` POST adds new user message server-side. |
| **2000-character input cap** | `ChatInterface.tsx`. |
| **Response cache staleness** | Page queries bypass cache; other repeated questions may return cached answers until TTL/restart. |
| **Reindex API, no UI** | `POST .../files/{id}/reindex` exists; no frontend button. |
| **Client-only folders** | Starred / archived / trash in `localStorage` — not synced across devices. |
| **Client-side search only** | Dashboard filters; no backend full-text search API. |

### Auth, security & product scope

| Limitation | Notes |
|------------|-------|
| **JWT in `localStorage`** | 8-day expiry; no refresh tokens. |
| **No OAuth / email verify / password reset** | Signup/login only. |
| **No content moderation pipeline** | Prompt sanitization only. |
| **Embed CORS** | Third-party domains need `CORS_ALLOW_ANY_ORIGIN=true` or their origin in `CORS_ORIGINS`. |
| **No WebSockets** | `VITE_WS_URL` in `.env.example` unused; chat is SSE only. |
| **UI stubs** | Mic, regenerate, model/temperature pickers not implemented. |
| **No observability stack** | No Prometheus, Sentry, or structured log shipping wired. |

---

## Shipped mitigations (in code today)

| Mitigation | Purpose | Location |
|------------|---------|----------|
| OCR on separate model | Reduce chat/OCR contention | `config.GEMINI_OCR_MODEL`, `file_parser_service._gemini_ocr_page` |
| Fail-fast on embedding 429 | Stop hammering API after first quota failure | `vector_store_service._get_embeddings_batch` |
| Stop OCR workers on 429 | `threading.Event` (`quota_hit`) | `file_parser_service._gemini_ocr_pages_parallel` |
| Actionable `processing_error` | User sees quota message on failed upload | `gemini_errors.quota_exhausted_message` → `files.process_file_embedding` |
| Honest page coverage | Never claim full coverage from `pdf_page_count` alone | `chat_service._get_indexed_page_set`, `_build_page_response_or_fallback` |
| Page-query cache bypass | Stale cached answers don’t hide failed indexing | `chat_service` page routing (see `test_page_coverage_honesty.py`) |
| Processing progress UI | `extracting` / `embedding` + `status_detail` | `files.py`, `FileListItem.tsx` |
| **Script-tag embed bundle** | `npm run build:lib` → `dist-lib/remi-widget.js` | `embed.tsx`, `embed/mount.ts`, [10_embedding_guide.md](./10_embedding_guide.md) |
| **npm + jsDelivr distribution** | **Shipped** — `remi-widget@1.0.0` on npm; jsDelivr / unpkg CDN live | `client/package.json`, [10_embedding_guide.md](./10_embedding_guide.md) |

### Portfolio / resume framing (accurate to what shipped)

> Identified and resolved a production quota-exhaustion failure mode where OCR on scanned documents could contend with core chat on the same Gemini model — isolated OCR onto `GEMINI_OCR_MODEL`, added fail-fast behavior on rate limits, surfaced quota errors in `processing_error`, and implemented honest page-coverage reporting from live `embeddings` rows so partial indexing failures are visible instead of silently hidden.

---

## Upgrade path (not architecture changes)

| Action | Effect |
|--------|--------|
| Enable [Google AI billing](https://aistudio.google.com/) | Removes practical ceiling for production OCR + embedding volume |
| Wait for free-tier daily reset | Typically midnight Pacific per Google docs |
| Use smaller or text-native PDFs for demos | Fewer OCR calls |
| Tune `GEMINI_DAILY_QUOTA_PER_USER` | Caps chat abuse only; does not cap upload API volume |

**None of these require redesigning RAG** — the same codebase scales with billing and Postgres + pgvector.

---

## What would make it a real architecture limitation

Only if **all** of these were true (they are **not** today):

- Paid billing enabled but the pipeline still cannot index large documents
- Bug is in Remi’s chunking/retrieval logic, not API quota
- No achievable fix path (billing, caps, queue, resume)

---

## Troubleshooting quick reference

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Upload `failed`, 0 embeddings | `429` during `[EMBED]` or OCR | Check Railway logs; enable billing or wait for reset; read `processing_error` |
| Chat works, upload fails | Embedding/OCR quota on key tier | Same as above |
| Page query shows wrong % | Stale deploy or cache | Deploy latest backend; restart Railway to clear in-memory `response_cache` |
| Chat 429 with countdown | App `GEMINI_DAILY_QUOTA_PER_USER` | Wait for UTC midnight or raise limit |

Diagnostic script: `backend/scripts/diagnose_embeddings.py`

---

## Future work

Grouped by theme. Items marked **High** are the most impactful for the quota/deployment story.

### A. Quota & upload pipeline

| Item | Priority | Description |
|------|----------|-------------|
| **Quota-aware upload resume** | **High** | Persist partial `embeddings` + checkpoint; resume from last successful batch after 429 instead of requiring full re-upload |
| **Upload job queue** | **High** | Celery/Redis or DB-backed queue so large files don’t block the API process; retry with backoff |
| **Per-upload page/OCR caps (configurable)** | Medium | `MAX_OCR_PAGES` / demo mode to protect free-tier keys |
| **Quota preflight estimate** | Medium | Before OCR/embed, estimate API calls from page count; warn or block if over tier |
| **Separate API keys per workload** | Low | `GEMINI_OCR_API_KEY` vs chat key for stronger isolation on shared deployments |
| **Billing status dashboard** | Low | Admin view of recent 429s, failed uploads, embedding health |

### B. Product & UI

| Item | Priority | Description |
|------|----------|-------------|
| **Conversation Detail tabs** | Medium | Messages / Files / Generated Files / Details — `getConversationDetail()` exists but is unused |
| **Abort SSE on widget close** | Medium | `close()` should call `abortActiveStream()` (`index.tsx`) |
| **Regenerate response** | Low | UI button to re-run last assistant turn |
| **Voice input** | Low | Mic buttons exist but are disabled stubs |
| **Cross-device starred/archive** | Low | Move from `localStorage` to server-synced folders |

### C. Infrastructure & scale

| Item | Priority | Description |
|------|----------|-------------|
| **Redis for rate limit + cache** | Medium | Required when Railway `numReplicas > 1`; today in-memory per replica |
| **Structured logging / monitoring** | Medium | Prometheus, Sentry (`SENTRY_DSN` in `.env.example` but unwired) |
| **Distributed auth rate limit** | Medium | Same Redis story as above |
| **Refresh tokens** | Low | JWT-only today; no refresh flow |
| **Admin RBAC** | Low | `embedding-health` is user-scoped; no role-based admin UI |

### D. RAG & quality

| Item | Priority | Description |
|------|----------|-------------|
| **Apply `chunk_overlap` in splitter** | Low | Parameter exists but unused in `split_text` |
| **Citation links to page numbers** | Medium | Surface `embeddings.page` in UI citations |
| **Corrupted-PDF test fixtures** | Low | ARCHITECTURE.md notes gap in test coverage |
| **Frontend tests** | Medium | Stream abort, file delete UI, rate-limit banner |

### E. Scaffold (files exist, not wired)

| Artifact | Location |
|----------|----------|
| Kubernetes manifests | `docker/kubernetes/` |
| `setup-redis.sh`, `setup-reasoning.sh`, `setup-safety.sh` | `scripts/` |
| Legacy `backend/app/api/chat.py` | Unused; use `api/v1/chat.py` |

---

## Suggested implementation order

If the goal is to harden the **free-tier → production** path:

1. **Enable Google AI billing** on Railway (immediate, no code)
2. **Quota-aware resume** — checkpoint `file_id` + last embedded `chunk_index` / page
3. **Upload queue** — decouple long OCR/embed jobs from request thread
4. **Redis** — when scaling beyond one Railway replica
5. **Bump `remi-widget` version** — when releasing embed bundle updates; republish from `client/` (see [10_embedding_guide.md](./10_embedding_guide.md))

---

## Key code paths

| Area | Path |
|------|------|
| Quota detection | `backend/app/services/gemini_errors.py` |
| Embedding + pgvector | `backend/app/services/vector_store_service.py` |
| OCR + PDF extraction | `backend/app/services/file_parser_service.py` |
| Page coverage honesty | `backend/app/services/chat_service.py` |
| Upload lifecycle | `backend/app/api/v1/files.py` → `process_file_embedding` |
| Chat daily quota | `backend/app/services/quota_service.py` |
| Config | `backend/app/config.py` |
| Tests | `backend/tests/unit/test_gemini_quota.py`, `test_page_coverage_honesty.py` |

---

## Related

- [../README.md](../README.md) — quick start, API reference, troubleshooting
- [07_deployment_guide.md](./07_deployment_guide.md) — `VITE_API_URL`, Railway env vars
- [04_ml_ai_concepts.md](./04_ml_ai_concepts.md) — how RAG maps to this repo
- [ARCHITECTURE.md](./ARCHITECTURE.md) §16 — known gaps table
