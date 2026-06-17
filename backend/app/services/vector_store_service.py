"""
Vector store service — Gemini embeddings + pgvector.
Replaces FAISS + sentence-transformers stack.
Zero in-memory model loading — all search in PostgreSQL.
"""

from __future__ import annotations

import json
import logging
import re
from typing import List, Optional

from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session

from app.config import settings

logger = logging.getLogger(__name__)

EMBEDDING_VERSION = "gemini-embedding-001-v768"
EMBEDDING_DIMENSIONS = 768
EMBED_BATCH_SIZE = 100
MAX_CHUNKS_PER_FILE = 2000
PAGE_QUERY_TOP_K = 15
PAGE_MARKER_PATTERN = re.compile(r"\[PAGE (\d+)\]", re.IGNORECASE)


def _embed_config(*, query: bool = False):
    from google.genai import types

    return types.EmbedContentConfig(
        task_type="RETRIEVAL_QUERY" if query else "RETRIEVAL_DOCUMENT",
        output_dimensionality=EMBEDDING_DIMENSIONS,
    )


def get_current_embedding_model_version() -> str:
    return EMBEDDING_VERSION


def gemini_embeddings_available() -> bool:
    return settings.gemini_configured()


def clear_memory_cache(file_id: Optional[str] = None) -> None:
    """No-op — kept for backward compatibility with older tests/callers."""


def _genai_client():
    from google import genai

    return genai.Client(api_key=settings.GEMINI_API_KEY.strip())


def _embedding_model_id() -> str:
    return settings.EMBEDDING_MODEL.removeprefix("models/")


def _embedding_models_to_try() -> List[str]:
    primary = _embedding_model_id()
    models = [primary]
    for fallback in ("gemini-embedding-001",):
        if fallback not in models:
            models.append(fallback)
    return models


def _format_pgvector(values: List[float]) -> str:
    return "[" + ",".join(str(v) for v in values) + "]"


def _ensure_genai_configured() -> bool:
    return settings.gemini_configured()


def _extract_embedding_values(response) -> List[float]:
    embeddings = getattr(response, "embeddings", None) or []
    if not embeddings:
        return []
    values = getattr(embeddings[0], "values", None)
    return list(values) if values else []


def _extract_batch_embeddings(response) -> List[List[float]]:
    embeddings = getattr(response, "embeddings", None) or []
    out: List[List[float]] = []
    for item in embeddings:
        values = getattr(item, "values", None)
        out.append(list(values) if values else [])
    return out


def _get_embeddings_batch(
    chunks: List[str], batch_size: int = EMBED_BATCH_SIZE
) -> tuple[List[List[float]], Optional[str]]:
    """
    Embed many chunks via Gemini batch API (fewer round-trips than one-by-one).
    Returns (one vector per input chunk; failed slots are empty lists, last error text).
    """
    if not chunks:
        return [], None
    if not _ensure_genai_configured():
        return [[] for _ in chunks], "GEMINI_API_KEY is not configured"

    results: List[List[float]] = []
    client = _genai_client()
    config = _embed_config()
    last_error: Exception | None = None

    for start in range(0, len(chunks), batch_size):
        batch = chunks[start : start + batch_size]
        batch_vectors: List[List[float]] = []
        for model_id in _embedding_models_to_try():
            try:
                response = client.models.embed_content(
                    model=model_id,
                    contents=batch,
                    config=config,
                )
                batch_vectors = _extract_batch_embeddings(response)
                if batch_vectors and any(batch_vectors):
                    break
            except Exception as exc:
                last_error = exc
                logger.error("Gemini batch embedding failed (%s): %s", model_id, exc)

        if len(batch_vectors) != len(batch):
            batch_vectors.extend([[] for _ in range(len(batch) - len(batch_vectors))])
        if not any(batch_vectors) and last_error is not None:
            logger.error("All embedding models failed for batch starting at %s", start)
        results.extend(batch_vectors[: len(batch)])

    error_text = str(last_error) if last_error else None
    return results, error_text


def _get_embedding(text_input: str) -> List[float]:
    """
    Get embedding vector from Gemini API.
    Returns list of 768 floats.
    Never raises — returns empty list on failure.
    """
    try:
        if not _ensure_genai_configured():
            return []
        response = _genai_client().models.embed_content(
            model=_embedding_model_id(),
            contents=text_input,
            config=_embed_config(),
        )
        return _extract_embedding_values(response)
    except Exception as exc:
        logger.error("Gemini embedding failed: %s", exc)
        return []


def _get_query_embedding(query: str) -> List[float]:
    """Get embedding for search query (retrieval_query task type)."""
    try:
        if not _ensure_genai_configured():
            return []
        response = _genai_client().models.embed_content(
            model=_embedding_model_id(),
            contents=query,
            config=_embed_config(query=True),
        )
        return _extract_embedding_values(response)
    except Exception as exc:
        logger.error("Gemini query embedding failed: %s", exc)
        return []


def _is_postgres(db: Session) -> bool:
    try:
        return db.get_bind().dialect.name == "postgresql"
    except Exception:
        return False


def split_text(
    text: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 100,
) -> List[str]:
    """Split text into overlapping chunks."""
    if not text or not text.strip():
        return []

    chunks: List[str] = []
    start = 0
    cleaned = text.strip()

    while start < len(cleaned):
        end = start + chunk_size
        chunk = cleaned[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += max(chunk_size - chunk_overlap, 1)

    return chunks


def split_text_with_pages(
    text: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 100,
) -> List[dict]:
    """
    Split page-aware text into chunks.
    Each chunk dict has text, page, and chunk_index.
    """
    chunks: List[dict] = []
    chunk_index = 0
    parts = PAGE_MARKER_PATTERN.split(text)

    i = 1
    while i < len(parts) - 1:
        page_num = int(parts[i])
        page_content = parts[i + 1].strip()
        i += 2

        if not page_content:
            continue

        start = 0
        while start < len(page_content):
            end = start + chunk_size
            chunk_text = page_content[start:end].strip()
            if chunk_text:
                chunks.append(
                    {
                        "text": f"[Page {page_num}] {chunk_text}",
                        "page": page_num,
                        "chunk_index": chunk_index,
                    }
                )
                chunk_index += 1
            start += max(chunk_size - chunk_overlap, 1)

    return chunks


def parse_page_chunks(source_text: str) -> List[dict]:
    """
    Build exactly one embedding chunk per [PAGE N] block.
    Guarantees every extracted page is indexed for page-specific queries.
    """
    chunks: List[dict] = []
    parts = PAGE_MARKER_PATTERN.split(source_text)
    chunk_index = 0
    i = 1
    while i < len(parts) - 1:
        page_num = int(parts[i])
        page_content = parts[i + 1].strip()
        i += 2
        if not page_content:
            continue
        chunks.append(
            {
                "text": f"[Page {page_num}] {page_content}",
                "page": page_num,
                "chunk_index": chunk_index,
            }
        )
        chunk_index += 1
    return chunks


def _collapse_to_one_chunk_per_page(chunks: List[dict]) -> List[dict]:
    """Merge multiple chunks from the same page into a single indexed chunk."""
    by_page: dict[int, dict] = {}
    for chunk in chunks:
        page = int(chunk.get("page") or 1)
        text = (chunk.get("text") or "").strip()
        if not text:
            continue
        if page not in by_page:
            by_page[page] = {
                "text": text,
                "page": page,
                "chunk_index": len(by_page),
            }
            continue
        existing = by_page[page]["text"]
        marker = f"[Page {page}]"
        body = text[len(marker):].strip() if text.startswith(marker) else text
        if body and body not in existing:
            by_page[page]["text"] = f"{existing}\n\n{body}".strip()

    return [
        by_page[page]
        for page in sorted(by_page)
    ]


def _extract_page_number(query: str) -> int | None:
    """Detect page number references in a user query."""
    patterns = [
        r"page\s+number\s+(\d+)",
        r"page\s*[\.\#]?\s*(\d+)",
        r"p\.\s*(\d+)",
        r"pg\s*\.?\s*(\d+)",
        r"(\d+)\s*(?:st|nd|rd|th)?\s*page",
        r"what(?:'s| is| are)?\s+(?:on|in)\s+page\s+(\d+)",
        r"show\s+me\s+page\s+(\d+)",
    ]
    lowered = query.lower()
    for pattern in patterns:
        match = re.search(pattern, lowered)
        if match:
            page_num = int(match.group(1))
            if 1 <= page_num <= 10000:
                return page_num
    return None


def detect_page_query(message: str) -> int | None:
    """Public alias for page-number detection in user messages."""
    return _extract_page_number(message)


def _resolve_index_chunks(
    source_text: str,
    chunks: Optional[List[str]],
    chunk_size: int,
    chunk_overlap: int,
) -> List[dict]:
    """Build index chunks. Page-marked PDFs get one chunk per page (never truncated)."""
    if chunks is not None:
        resolved = [
            {
                "text": f"[Page 1] {chunk}",
                "page": 1,
                "chunk_index": index,
            }
            for index, chunk in enumerate(chunks)
            if chunk.strip()
        ]
    elif PAGE_MARKER_PATTERN.search(source_text):
        resolved = parse_page_chunks(source_text)
        if resolved:
            logger.info(
                "Page-aware indexing: %s page chunk(s) (one per page)",
                len(resolved),
            )
            return resolved
        resolved = split_text_with_pages(source_text, chunk_size, chunk_overlap)
    else:
        resolved = [
            {
                "text": f"[Page 1] {chunk}",
                "page": 1,
                "chunk_index": index,
            }
            for index, chunk in enumerate(
                split_text(source_text, chunk_size, chunk_overlap)
            )
        ]

    if len(resolved) <= MAX_CHUNKS_PER_FILE:
        return resolved

    if PAGE_MARKER_PATTERN.search(source_text):
        collapsed = _collapse_to_one_chunk_per_page(resolved)
        if len(collapsed) < len(resolved):
            logger.info(
                "Collapsed page chunks from %s to %s (one chunk per page)",
                len(resolved),
                len(collapsed),
            )
            resolved = collapsed
        if resolved:
            return resolved

    if chunks is not None:
        logger.warning(
            "Capping row chunks from %s to %s for indexing",
            len(resolved),
            MAX_CHUNKS_PER_FILE,
        )
        return resolved[:MAX_CHUNKS_PER_FILE]

    size = chunk_size
    while len(resolved) > MAX_CHUNKS_PER_FILE and size < 8000:
        size = int(size * 1.5)
        if PAGE_MARKER_PATTERN.search(source_text):
            resolved = split_text_with_pages(source_text, size, chunk_overlap)
        else:
            resolved = [
                {
                    "text": f"[Page 1] {chunk}",
                    "page": 1,
                    "chunk_index": index,
                }
                for index, chunk in enumerate(
                    split_text(source_text, size, chunk_overlap)
                )
            ]
    if len(resolved) > MAX_CHUNKS_PER_FILE:
        resolved = resolved[:MAX_CHUNKS_PER_FILE]
    logger.info(
        "Reduced chunk count to %s for indexing (chunk_size=%s)",
        len(resolved),
        size,
    )
    return resolved


def _normalize_exact_key(value: str) -> str:
    """Lowercase and strip hyphens, spaces, underscores for part-number matching."""
    return re.sub(r"[\s\-_]+", "", (value or "").lower())


def _exact_string_search_raw_text(raw_text: str, query: str) -> Optional[str]:
    """
    Find a chunk/line in raw_text whose normalized form contains the normalized query.
    Returns the original segment text, or None.
    """
    if not raw_text or not query:
        return None

    normalized_query = _normalize_exact_key(query)
    if not normalized_query:
        return None

    for segment in raw_text.split("\n"):
        cleaned = segment.strip()
        if not cleaned:
            continue
        if normalized_query in _normalize_exact_key(cleaned):
            return cleaned

    if normalized_query in _normalize_exact_key(raw_text):
        for segment in raw_text.split("\n"):
            cleaned = segment.strip()
            if cleaned and normalized_query in _normalize_exact_key(cleaned):
                return cleaned
        return raw_text.strip()

    return None


def _persist_raw_text(
    file_id: str, raw_text: Optional[str], db: Optional[Session] = None
) -> None:
    if not raw_text or db is None:
        return
    from app.database.db import UploadedFile

    row = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if row:
        row.raw_text_blob = raw_text
        db.flush()


def _is_index_stale(db: Session, file_id: str) -> bool:
    from app.database.db import UploadedFile

    row = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if not row:
        return False
    if not row.embedding_model_version:
        return True
    return row.embedding_model_version != EMBEDDING_VERSION


def reindex_file(db: Session, file_id: str) -> None:
    """Re-embed a file when the stored embedding version is stale."""
    from app.database.db import UploadedFile
    from app.services import file_parser_service

    row = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if not row or not row.file_path:
        return

    logger.warning("Embedding version mismatch for file %s — reindexing", file_id)
    extracted_text = file_parser_service.extract_text(row.file_path, row.filename)
    if not extracted_text or not extracted_text.strip():
        raise ValueError(f"No text extracted from {row.filename}")

    row_chunks = file_parser_service.parse_row_chunks(row.file_path, row.filename)
    chunk_and_store(
        file_id,
        extracted_text,
        db=db,
        chunks=row_chunks,
        raw_text=extracted_text,
    )
    row.status = "processed"
    db.commit()


def chunk_and_store(
    file_id: str,
    source_text: str,
    db: Optional[Session] = None,
    chunk_size: int = 1000,
    chunk_overlap: int = 100,
    *,
    chunks: Optional[List[str]] = None,
    raw_text: Optional[str] = None,
) -> bool:
    """
    Chunk text (or use pre-built row chunks), embed via Gemini, store in pgvector.
    Returns True on success, False on failure.
    """
    if db is None:
        logger.error("chunk_and_store requires a database session")
        return False

    try:
        resolved_chunks = _resolve_index_chunks(
            source_text, chunks, chunk_size, chunk_overlap
        )
        if not resolved_chunks:
            raise ValueError("No text chunks to index from this file")

        _persist_raw_text(file_id, raw_text or source_text, db)

        db.execute(
            text("DELETE FROM embeddings WHERE file_id = :fid"),
            {"fid": file_id},
        )

        embeddings, embed_error = _get_embeddings_batch(
            [chunk["text"] for chunk in resolved_chunks]
        )
        pg_insert = text(
            """
            INSERT INTO embeddings
            (file_id, chunk_text, embedding, chunk_index, page)
            VALUES (:file_id, :chunk_text, CAST(:embedding AS vector), :chunk_index, :page)
            """
        )
        sqlite_insert = text(
            """
            INSERT INTO embeddings
            (file_id, chunk_text, embedding, chunk_index, page)
            VALUES (:file_id, :chunk_text, :embedding, :chunk_index, :page)
            """
        )

        insert_rows: list[dict] = []
        for chunk, embedding in zip(resolved_chunks, embeddings):
            if not embedding:
                logger.warning(
                    "Empty embedding for chunk %s of file %s — skipping",
                    chunk["chunk_index"],
                    file_id,
                )
                continue
            insert_rows.append(
                {
                    "file_id": file_id,
                    "chunk_text": chunk["text"],
                    "embedding": _format_pgvector(embedding),
                    "chunk_index": chunk["chunk_index"],
                    "page": chunk["page"],
                }
            )

        if insert_rows:
            if _is_postgres(db):
                db.execute(pg_insert, insert_rows)
            else:
                db.execute(sqlite_insert, insert_rows)
        stored = len(insert_rows)
        indexed_pages = len({row["page"] for row in insert_rows if row.get("page")})

        db.execute(
            text(
                """
                UPDATE uploaded_files
                SET embedding_model_version = :version,
                    indexed_page_count = :indexed_pages
                WHERE id = :file_id
                """
            ),
            {
                "version": EMBEDDING_VERSION,
                "file_id": file_id,
                "indexed_pages": indexed_pages,
            },
        )
        db.commit()
        logger.info("Stored %s chunks for file %s", stored, file_id)
        if stored == 0:
            api_detail = embed_error or "no exception recorded (empty API response)"
            raise ValueError(
                "Embedding API returned no vectors. "
                f"API detail: {api_detail}. "
                "On Railway, verify GEMINI_API_KEY is set and valid. "
                f"EMBEDDING_MODEL={settings.EMBEDDING_MODEL} "
                "(expected gemini-embedding-001 per Google docs)."
            )
        return True

    except ValueError:
        db.rollback()
        raise
    except Exception as exc:
        logger.error("chunk_and_store failed for %s: %s", file_id, exc)
        db.rollback()
        raise ValueError(f"Could not save embeddings to database: {exc}") from exc


def file_has_searchable_embeddings(db: Session, file_id: str) -> bool:
    """True when a file is processed with current-version pgvector rows."""
    from app.database.db import UploadedFile

    row = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if not row or row.status != "processed":
        return False
    if row.embedding_model_version != EMBEDDING_VERSION:
        return False
    count = db.execute(
        text("SELECT COUNT(*) FROM embeddings WHERE file_id = :fid"),
        {"fid": file_id},
    ).scalar()
    return bool(count and count > 0)


def search(
    file_ids: List[str],
    query: str,
    top_k: int = 5,
    db: Optional[Session] = None,
) -> List[str]:
    """
    Search embeddings using pgvector cosine similarity.
    Never raises — returns [] on failure.
    """
    if not file_ids or db is None:
        return []

    try:
        from app.database.db import UploadedFile

        for file_id in file_ids:
            if _is_index_stale(db, file_id):
                try:
                    reindex_file(db, file_id)
                except Exception as exc:
                    logger.warning("Reindex failed for %s: %s", file_id, exc)

        page_num = _extract_page_number(query)
        if page_num is not None:
            page_hits = _search_by_page(db, file_ids, page_num, top_k=PAGE_QUERY_TOP_K)
            if page_hits:
                return page_hits

        for file_id in file_ids:
            row = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
            if row and row.raw_text_blob:
                exact_hit = _exact_string_search_raw_text(row.raw_text_blob, query)
                if exact_hit:
                    return [exact_hit]

        exact = _exact_string_search(db, file_ids, query)
        if exact:
            return exact

        if not _is_postgres(db):
            return _keyword_fallback(db, file_ids, query, top_k)

        query_embedding = _get_query_embedding(query)
        if not query_embedding:
            return _keyword_fallback(db, file_ids, query, top_k)

        results = db.execute(
            text(
                """
                SELECT chunk_text,
                       1 - (embedding <=> CAST(:query_vec AS vector)) AS similarity
                FROM embeddings
                WHERE file_id IN :file_ids
                ORDER BY similarity DESC
                LIMIT :top_k
                """
            ).bindparams(bindparam("file_ids", expanding=True)),
            {
                "query_vec": _format_pgvector(query_embedding),
                "file_ids": file_ids,
                "top_k": top_k,
            },
        )

        return [row.chunk_text for row in results]

    except Exception as exc:
        logger.error("pgvector search failed: %s", exc)
        return _keyword_fallback(db, file_ids, query, top_k)


def _search_by_page(
    db: Session,
    file_ids: List[str],
    page_num: int,
    top_k: int,
) -> List[str]:
    """Return chunks from a specific page, ordered by chunk_index."""
    try:
        results = db.execute(
            text(
                """
                SELECT chunk_text FROM embeddings
                WHERE file_id IN :file_ids
                AND page = :page_num
                ORDER BY chunk_index ASC
                LIMIT :top_k
                """
            ).bindparams(bindparam("file_ids", expanding=True)),
            {
                "file_ids": file_ids,
                "page_num": page_num,
                "top_k": top_k,
            },
        )
        chunks = [row.chunk_text for row in results]
        logger.info(
            "Page %s search: found %s chunks from %s files",
            page_num,
            len(chunks),
            len(file_ids),
        )
        if not chunks:
            logger.warning(
                "Page %s has no chunks — file may need re-indexing with page-aware extraction",
                page_num,
            )
        return chunks
    except Exception as exc:
        logger.error("_search_by_page failed: %s", exc)
        return []


def get_page_content(
    db: Session,
    file_ids: List[str],
    page_num: int,
    top_k: int = PAGE_QUERY_TOP_K,
) -> str:
    """Return combined chunk text for a specific page, or empty string if missing."""
    chunks = _search_by_page(db, file_ids, page_num, top_k=top_k)
    if not chunks:
        return ""
    return "\n\n".join(chunks)


def get_max_page_number(db: Session, file_ids: List[str]) -> int:
    """Highest page number indexed for the given files."""
    if not file_ids:
        return 0
    try:
        result = db.execute(
            text(
                """
                SELECT MAX(page) FROM embeddings
                WHERE file_id IN :file_ids
                """
            ).bindparams(bindparam("file_ids", expanding=True)),
            {"file_ids": file_ids},
        ).scalar()
        return int(result or 0)
    except Exception as exc:
        logger.warning("get_max_page_number failed: %s", exc)
        return 0


def get_stored_pdf_page_count(db: Session, file_ids: List[str]) -> int:
    """Total pages in the source PDF(s) as recorded at upload/extract time."""
    if not file_ids:
        return 0
    try:
        from app.database.db import UploadedFile

        rows = (
            db.query(UploadedFile.pdf_page_count)
            .filter(UploadedFile.id.in_(file_ids))
            .all()
        )
        counts = [int(r[0]) for r in rows if r[0] is not None]
        return max(counts) if counts else 0
    except Exception as exc:
        logger.warning("get_stored_pdf_page_count failed: %s", exc)
        return 0


def _exact_string_search(
    db: Session,
    file_ids: List[str],
    query: str,
) -> List[str]:
    """Exact string match on stored chunks before semantic search."""
    try:
        normalized = query.lower().replace("-", "").replace(" ", "").strip()
        if not normalized:
            return []

        results = db.execute(
            text(
                """
                SELECT chunk_text FROM embeddings
                WHERE file_id IN :file_ids
                AND LOWER(REPLACE(REPLACE(chunk_text, '-', ''), ' ', ''))
                    LIKE :pattern
                LIMIT 3
                """
            ).bindparams(bindparam("file_ids", expanding=True)),
            {
                "file_ids": file_ids,
                "pattern": f"%{normalized}%",
            },
        )
        return [row.chunk_text for row in results]
    except Exception:
        return []


def _keyword_fallback(
    db: Session,
    file_ids: List[str],
    query: str,
    top_k: int,
) -> List[str]:
    """Keyword search fallback when Gemini embedding or pgvector fails."""
    try:
        terms = [term for term in query.split() if len(term) > 3]
        if not terms:
            return []

        pattern = "%".join(term.lower() for term in terms)
        results = db.execute(
            text(
                """
                SELECT chunk_text FROM embeddings
                WHERE file_id IN :file_ids
                AND LOWER(chunk_text) LIKE :pattern
                LIMIT :top_k
                """
            ).bindparams(bindparam("file_ids", expanding=True)),
            {
                "file_ids": file_ids,
                "pattern": f"%{pattern}%",
                "top_k": top_k,
            },
        )
        return [row.chunk_text for row in results]
    except Exception:
        return []


def delete_file_data(file_id: str, db: Optional[Session] = None) -> None:
    """Delete all embeddings for a file. Idempotent."""
    from app.database.db import SessionLocal

    session = db
    own_session = False
    if session is None:
        session = SessionLocal()
        own_session = True

    try:
        session.execute(
            text("DELETE FROM embeddings WHERE file_id = :fid"),
            {"fid": file_id},
        )
        session.commit()
    except Exception as exc:
        logger.warning("delete_file_data failed for %s: %s", file_id, exc)
        session.rollback()
    finally:
        if own_session:
            session.close()
