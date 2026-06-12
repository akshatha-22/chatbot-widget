# ML & AI Concepts (Mapped to This Codebase)

Educational overview of AI techniques used in Remi, with **explicit mapping** to files in this repo. Generic theory sections are labeled as general background, not product features.

**Implementation detail:** [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 1. Retrieval-Augmented Generation (RAG)

### How this project implements RAG

1. **Ingest:** Upload file → MIME validate → extract text → chunk → embed (or text-only fallback) → store in **DB blobs** + disk + in-memory cache.  
2. **Retrieve:** Embed query + FAISS L2 search, or **keyword fallback** when ML libs absent; up to **5** chunks.  
3. **Generate:** Prepend chunks to the Gemini prompt under `DOCUMENT CONTEXT`. Identical questions from the **same user** with the same RAG digest may hit the **per-user TTL response cache** (skip Gemini; `cache_hit: true` on response).

```717:749:backend/app/services/chat_service.py
def build_rag_context(db: Session, conversation_id: int, user_message: str) -> str:
    ...
    chunks = vector_store_service.search(file_ids, user_message, top_k=5)
    ...
    return "\n\n".join(chunks)
```

### What we do **not** do

- pgvector / SQL-native vector search (blobs are opaque bytes, not pgvector columns)  
- Rerank with Cohere or cross-encoders  
- Show citations or chunk IDs to the user  
- HyDE or multi-query retrieval  

---

## 2. Embeddings

| Topic | This repo |
|-------|-----------|
| Model | `all-MiniLM-L6-v2` via `sentence-transformers` |
| Dimension | 384 (MiniLM) |
| Storage | `uploaded_files.faiss_index_blob` + `chunks_blob` (primary); disk + memory cache |
| Versioning | `embedding_model_version` column; auto-reindex when model changes |
| Query encoding | Same model at search time (or keyword fallback) |

```13:20:backend/app/services/vector_store_service.py
def get_embedding_model():
    ...
    _model = SentenceTransformer("all-MiniLM-L6-v2")
```

**General background:** Larger models (OpenAI `text-embedding-3-large`, etc.) can improve quality but add cost and latency; this widget prioritizes local CPU inference.

---

## 3. Large language models

| Role | Provider in code |
|------|------------------|
| Primary | Google Gemini (`google-genai`, optional Google Search grounding) |
| Legacy fallback | `google-generativeai` |
| Secondary | OpenAI Chat Completions if `OPENAI_API_KEY` set |
| Last resort | Rule-based `_fallback_assistant_content` |

Default model name: `gemini-2.5-flash` (`config.py`), with code fallbacks to other Gemini model IDs.

**When RAG context exists:** Google Search is turned **off** so answers stay grounded in uploaded documents.

**Not used:** Anthropic, LangChain, local LLMs.

---

## 4. Document processing & chunking

| Step | File |
|------|------|
| PDF | PyPDF2 page text extraction |
| DOCX | python-docx paragraphs |
| XLSX | openpyxl sheets → CSV-like lines |
| Other | UTF-8 read with errors ignored |

```23:70:backend/app/services/vector_store_service.py
def split_text(text: str, chunk_size: int = 500, chunk_overlap: int = 50) -> List[str]:
```

- Splits on paragraphs, then sentences for long paragraphs.  
- **`chunk_overlap` is not applied** in the splitting loop (parameter is currently unused).  
- Empty extraction → upload fails with `status=failed`.

---

## 5. Semantic search

| Aspect | Implementation |
|--------|----------------|
| Index | `faiss.IndexFlatL2` per file (or keyword overlap fallback) |
| Metric | L2 distance when FAISS available; keyword score otherwise |
| Merge | Results from multiple files merged and sorted globally |
| Dedup | Identical chunk text skipped |
| In-memory cache | Each file index loaded once per worker (`_index_memory_cache`) |

```99:151:backend/app/services/vector_store_service.py
def search(file_ids: List[str], query: str, top_k: int = 5) -> List[str]:
```

**General background:** Cosine similarity on normalized vectors is often preferred for semantic text; L2 on unnormalized MiniLM embeddings is a pragmatic default here.

---

## 6. Conversational context

| Mechanism | Behavior |
|-----------|----------|
| History in prompt | Last ~6 prior messages (excluding current user turn) as `Role: content` lines |
| System instructions | Markdown formatting; RAG or Search hints |
| DB history | All messages stored; no summarization of old turns |

Long conversations can exceed model context — there is **no** automatic summarization middleware.

---

## 7. Streaming (SSE)

The widget does not wait for the full completion before showing text:

- Backend yields `data: {chunk}\n\n` events.  
- Frontend appends to a placeholder assistant message.  
- Final `data: {"event":"done",...}\n\n` includes DB id and PDF flags.

See [ARCHITECTURE.md §5](./ARCHITECTURE.md#5-sse-streaming-architecture).

---

## 8. PDF generation flow

1. Regex detects PDF intent (`detect_pdf_request`).  
2. One-shot Gemini call for structured markdown (`_build_pdf_topic_prompt`).  
3. Message saved with `pdf_content`; browser runs **jsPDF** client-side.

This is **not** server-side PDF rendering.

---

## 9. Generate endpoint (summary / report / analysis)

Separate from RAG chat: `_build_document_prompt` asks Gemini to synthesize the last 50 messages into a document template. Returns **text/markdown JSON** for download.

---

## 10. Evaluation & quality (general + gaps)

**General metrics** (not automated in CI):

- Faithfulness to retrieved chunks  
- Answer relevance  
- Latency p95 for stream time-to-first-token  

**Product gaps:** no golden datasets, no LLM-as-judge pipeline, no embedding drift monitoring.

---

## 11. Hallucinations & errors

| Mitigation | Present? |
|------------|----------|
| RAG grounding instruction | Yes, strong wording when context exists |
| “I cannot access files” suppressed when context injected | Yes |
| Source attribution | No |
| Confidence threshold on retrieval | No |
| User-facing “fallback mode” message | Yes, when no API keys |

Corrupted PDFs raise `ValueError` → file `failed`, not silent empty RAG.

---

## 12. Scalability notes (ML-specific)

| Bottleneck | Cause |
|------------|--------|
| Embedding thread | CPU-bound `SentenceTransformer` per upload |
| FAISS load | Mitigated by in-memory cache; DB blobs on redeploy |
| Gemini quota | 100 calls/user/day UTC; 429 + `reset_at` + UI countdown |
| Repeated questions | Per-user TTL response cache (`user_id` + question + RAG digest) skips duplicate Gemini calls |
| Stale FAISS indexes | `embedding_model_version` column; auto-reindex on model mismatch |
| SQLite | Not ideal for concurrent writers |

For production, use PostgreSQL, horizontal API replicas, and consider a shared vector service if document volume grows.

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
| RAG context | `chat_service.py` → `build_rag_context` |
| Chunk + index | `vector_store_service.py` |
| Parse upload | `file_parser_service.py` |
| Stream + fallback | `chat_service.py` → `iter_assistant_chunks` |
| Response cache | `response_cache.py` |
| Gemini quota | `quota_service.py` |
| Client stream | `client/src/api/chat.ts` |

**Not yet built:** Conversation Detail tabs; embeddable `build:lib` npm package.
