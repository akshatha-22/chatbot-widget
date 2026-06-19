# ML & AI Concepts (Mapped to This Codebase)

Educational overview of AI techniques used in Remi, with **explicit mapping** to files in this repo. Generic theory sections are labeled as general background, not product features.

**Implementation detail:** [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 1. Retrieval-Augmented Generation (RAG)

### How this project implements RAG

1. **Ingest:** Upload file → MIME validate → extract text (PyMuPDF + Gemini OCR for PDFs) → chunk (one chunk per page for page-marked PDFs) → Gemini embed → store in PostgreSQL **`embeddings`** table with pgvector.
2. **Route:** `_prepare_assistant_context()` in `chat_service.py` — **documents before web search**. Pending files block chat with a wait message. Page queries bypass semantic search.
3. **Retrieve:** Page number detected → `get_page_content()` by `embeddings.page`. Otherwise pgvector cosine search (`top_k=5`), or keyword fallback if embedding fails.
4. **Classify:** `rag_quality_service.classify_rag_context()` → DIRECT / PARTIAL / DEFLECTED / EMPTY — tunes how strongly the model trusts document context vs web.
5. **Generate:** Prepend chunks to the Gemini prompt under `DOCUMENT CONTEXT`. Identical questions from the **same user** with the same RAG digest may hit the **per-user TTL response cache** (`cache_hit: true`).

### Document-first routing (key behavior)

| Condition | Action |
|-----------|--------|
| Files still processing | Return pending-document message (no web search) |
| Page query + page found | Direct page content → document prompt, no web |
| Page query + page missing | Helpful message with indexed vs total page counts |
| RAG context found | Document prompt; Google Search off |
| RAG empty + question unrelated to filenames | Web search with disclaimer |
| RAG empty + question about documents | Document miss message (no web) |
| No documents + conversational | Normal chat, no search |
| No documents + factual question | Web search |

### What we do **not** do

- Cross-encoder reranking (Cohere, etc.)
- Show citation links or chunk IDs in the UI
- HyDE or multi-query retrieval

---

## 2. Embeddings

| Topic | This repo |
|-------|-----------|
| Model | **`gemini-embedding-001`** via Google GenAI API |
| Dimension | **768** |
| Version string | `gemini-embedding-001-v768` on `uploaded_files.embedding_model_version` |
| Storage | PostgreSQL `embeddings` table — `chunk_text`, pgvector `embedding`, `page`, `chunk_index` |
| Search metric | Cosine similarity (`<=>` operator in pgvector) |
| Dev/tests | SQLite has no pgvector — tests mock embedding writes; use PostgreSQL locally for full RAG |
| Stale detection | Auto-reindex when `embedding_model_version` mismatches current version |

**General background:** Cloud embedding APIs trade local CPU cost for consistent quality and simpler ops. pgvector keeps vectors queryable with standard SQL alongside relational metadata (page numbers, file IDs).

---

## 3. Large language models

| Role | Provider in code |
|------|------------------|
| Primary | Google Gemini (`google-genai`, optional Google Search grounding) |
| Legacy fallback | `google-generativeai` |
| Secondary | OpenAI Chat Completions if `OPENAI_API_KEY` set |
| Last resort | Rule-based `_fallback_assistant_content` |
| OCR (PDF) | Gemini vision OCR for image-only PDF pages (`file_parser_service.py`) |

Default model name: `gemini-2.5-flash` (`config.py`), with code fallbacks to other Gemini model IDs.

**When RAG context exists:** Google Search is turned **off** so answers stay grounded in uploaded documents.

**Not used:** Anthropic, LangChain, local LLMs.

---

## 4. Document processing & chunking

| Step | File |
|------|------|
| PDF (text) | PyMuPDF — all pages read in parallel (8 workers) |
| PDF (image/OCR) | Gemini OCR for pages with insufficient text — **no page cap** |
| PDF (small) | pdfplumber supplement for PDFs ≤ 50 pages when PyMuPDF text is weak |
| DOCX | python-docx paragraphs |
| XLSX/CSV | One chunk per spreadsheet row (`parse_row_chunks`) |
| Other | UTF-8 read with errors ignored |

### Page-aware chunking

PDFs with `[PAGE N]` markers get **one embedding chunk per page** (`parse_page_chunks`). This enables direct page retrieval for queries like "what's on page 115". `MAX_CHUNKS_PER_FILE = 2000`; page-aware PDFs are never truncated below one chunk per page.

```317:320:backend/app/services/vector_store_service.py
def detect_page_query(message: str) -> int | None:
    """Public alias for page-number detection in user messages."""
    return _extract_page_number(message)
```

Empty extraction → upload fails with `status=failed` and `processing_error`.

---

## 5. Semantic search

| Aspect | Implementation |
|--------|----------------|
| Index | PostgreSQL pgvector on `embeddings.embedding` |
| Metric | Cosine similarity |
| Merge | Results from multiple files merged and sorted globally |
| Dedup | Identical chunk text skipped |
| Fallback | Keyword overlap search when Gemini embed or pgvector fails |

**General background:** Cosine similarity on normalized vectors is standard for semantic text search. Page metadata (`embeddings.page`) complements vector search for queries that mention explicit page numbers.

---

## 6. RAG quality tiers

`rag_quality_service.py` classifies retrieved context:

| Tier | Meaning | Prompt behavior |
|------|---------|-----------------|
| DIRECT | Query terms well covered in context | Strong document grounding |
| PARTIAL | Some overlap | Document + cautious supplement |
| DEFLECTED | Context contains "contact us" style deflection | May suggest web search |
| EMPTY | Too little context | Document miss or web fallback path |

---

## 7. Conversational context

| Mechanism | Behavior |
|-----------|----------|
| History in prompt | Last ~6 prior messages (excluding current user turn) as `Role: content` lines |
| System instructions | Markdown formatting; RAG or Search hints based on routing |
| DB history | All messages stored; no summarization of old turns |

Long conversations can exceed model context — there is **no** automatic summarization middleware.

---

## 8. Streaming (SSE)

The widget does not wait for the full completion before showing text:

- Backend yields `data: {chunk}\n\n` events.
- Frontend appends to a placeholder assistant message.
- Final `data: {"event":"done",...}\n\n` includes DB id and PDF flags.

See [ARCHITECTURE.md §5](./ARCHITECTURE.md#5-sse-streaming-architecture).

---

## 9. PDF generation flow

1. Regex detects PDF intent (`detect_pdf_request`).
2. One-shot Gemini call for structured markdown (`_build_pdf_topic_prompt`).
3. Message saved with `pdf_content`; browser runs **jsPDF** client-side.

This is **not** server-side PDF rendering.

---

## 10. Evaluation & quality (general + gaps)

**General metrics** (not automated in CI):

- Faithfulness to retrieved chunks
- Answer relevance
- Latency p95 for stream time-to-first-token
- Page retrieval accuracy on large flipbooks

**Product gaps:** no golden datasets, no LLM-as-judge pipeline, no embedding drift monitoring.

---

## 11. Hallucinations & errors

| Mitigation | Present? |
|------------|----------|
| RAG grounding instruction | Yes, tiered by `RAGQuality` |
| Document-first routing | Yes — web only when appropriate |
| Page-specific retrieval | Yes — direct lookup, not semantic guess |
| Source attribution | No |
| Confidence threshold on retrieval | Partial — quality tiers, not scores in UI |
| User-facing "fallback mode" message | Yes, when no API keys |

Corrupted PDFs raise errors → file `failed`, not silent empty RAG.

---

## 12. Scalability notes (ML-specific)

| Bottleneck | Cause |
|------------|--------|
| PDF OCR | Gemini API calls per image page — large flipbooks take minutes |
| Embedding API | Network-bound Gemini embed per chunk |
| pgvector search | Per-query embed + SQL similarity — fine at widget scale |
| Gemini quota | 100 calls/user/day UTC; 429 + `reset_at` + UI countdown |
| Repeated questions | Per-user TTL response cache skips duplicate Gemini calls |
| Stale embeddings | `embedding_model_version`; auto-reindex on mismatch |
| SQLite | No pgvector — production needs PostgreSQL |

For production, use PostgreSQL with pgvector enabled. Consider a dedicated embed queue if upload volume grows.

---

## 13. Ethical considerations (general)

When deploying Remi:

- Inform users that messages and uploads are sent to **Gemini** (and optionally OpenAI).
- Uploaded documents stay on your server disk unless you migrate storage.
- No built-in PII redaction or toxicity filter — add upstream if required.

---

## Quick reference

| Concept | File |
|---------|------|
| RAG routing | `chat_service.py` → `_prepare_assistant_context` |
| RAG context | `chat_service.py` → `build_rag_context` |
| RAG quality | `rag_quality_service.py` → `classify_rag_context` |
| Page retrieval | `vector_store_service.py` → `detect_page_query`, `get_page_content` |
| Chunk + embed | `vector_store_service.py` |
| Parse upload | `file_parser_service.py` |
| Stream + fallback | `chat_service.py` → `iter_assistant_chunks` |
| Response cache | `response_cache.py` |
| Gemini quota | `quota_service.py` |
| Client stream | `client/src/api/chat.ts` |

**Not yet built:** Conversation Detail tabs.
