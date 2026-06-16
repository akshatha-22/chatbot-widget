"""
Vector store service — Gemini embeddings + pgvector.
Replaces FAISS + sentence-transformers stack.
Zero in-memory model loading — all search in PostgreSQL.
"""

from __future__ import annotations

import json
import logging
from typing import List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings

logger = logging.getLogger(__name__)

EMBEDDING_VERSION = "gemini-text-embedding-004-v1"
EMBEDDING_DIMENSIONS = 768


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


def _ensure_genai_configured() -> bool:
    return settings.gemini_configured()


def _extract_embedding_values(response) -> List[float]:
    embeddings = getattr(response, "embeddings", None) or []
    if not embeddings:
        return []
    values = getattr(embeddings[0], "values", None)
    return list(values) if values else []


def _get_embedding(text_input: str) -> List[float]:
    """
    Get embedding vector from Gemini API.
    Returns list of 768 floats.
    Never raises — returns empty list on failure.
    """
    try:
        if not _ensure_genai_configured():
            return []
        from google.genai import types

        response = _genai_client().models.embed_content(
            model=_embedding_model_id(),
            contents=text_input,
            config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
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
        from google.genai import types

        response = _genai_client().models.embed_content(
            model=_embedding_model_id(),
            contents=query,
            config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY"),
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
    chunk_size: int = 500,
    chunk_overlap: int = 50,
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

    chunk_and_store(file_id, extracted_text, db=db)
    row.status = "processed"
    db.commit()


def chunk_and_store(
    file_id: str,
    text: str,
    db: Optional[Session] = None,
    chunk_size: int = 500,
    chunk_overlap: int = 50,
) -> bool:
    """
    Chunk text, embed each chunk via Gemini, store in pgvector embeddings table.
    Returns True on success, False on failure.
    """
    if db is None:
        logger.error("chunk_and_store requires a database session")
        return False

    try:
        chunks = split_text(text, chunk_size, chunk_overlap)
        if not chunks:
            logger.warning("No chunks for file %s", file_id)
            return False

        db.execute(
            text("DELETE FROM embeddings WHERE file_id = :fid"),
            {"fid": file_id},
        )

        stored = 0
        for index, chunk in enumerate(chunks):
            embedding = _get_embedding(chunk)
            if not embedding:
                logger.warning(
                    "Empty embedding for chunk %s of file %s — skipping",
                    index,
                    file_id,
                )
                continue

            if _is_postgres(db):
                db.execute(
                    text(
                        """
                        INSERT INTO embeddings
                        (file_id, chunk_text, embedding, chunk_index)
                        VALUES (:file_id, :chunk_text,
                                :embedding::vector, :chunk_index)
                        """
                    ),
                    {
                        "file_id": file_id,
                        "chunk_text": chunk,
                        "embedding": json.dumps(embedding),
                        "chunk_index": index,
                    },
                )
            else:
                db.execute(
                    text(
                        """
                        INSERT INTO embeddings
                        (file_id, chunk_text, embedding, chunk_index)
                        VALUES (:file_id, :chunk_text, :embedding, :chunk_index)
                        """
                    ),
                    {
                        "file_id": file_id,
                        "chunk_text": chunk,
                        "embedding": json.dumps(embedding),
                        "chunk_index": index,
                    },
                )
            stored += 1

        db.execute(
            text(
                """
                UPDATE uploaded_files
                SET embedding_model_version = :version
                WHERE id = :file_id
                """
            ),
            {"version": EMBEDDING_VERSION, "file_id": file_id},
        )
        db.commit()
        logger.info("Stored %s chunks for file %s", stored, file_id)
        return stored > 0

    except Exception as exc:
        logger.error("chunk_and_store failed for %s: %s", file_id, exc)
        db.rollback()
        return False


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
        if db is not None:
            for file_id in file_ids:
                if _is_index_stale(db, file_id):
                    try:
                        reindex_file(db, file_id)
                    except Exception as exc:
                        logger.warning("Reindex failed for %s: %s", file_id, exc)

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
                       1 - (embedding <=> :query_vec::vector) AS similarity
                FROM embeddings
                WHERE file_id = ANY(:file_ids)
                ORDER BY similarity DESC
                LIMIT :top_k
                """
            ),
            {
                "query_vec": json.dumps(query_embedding),
                "file_ids": file_ids,
                "top_k": top_k,
            },
        )

        return [row.chunk_text for row in results]

    except Exception as exc:
        logger.error("pgvector search failed: %s", exc)
        return _keyword_fallback(db, file_ids, query, top_k)


def _exact_string_search(
    db: Session,
    file_ids: List[str],
    query: str,
) -> List[str]:
    """Exact string match before semantic search."""
    try:
        normalized = query.lower().replace("-", "").replace(" ", "").strip()
        if not normalized:
            return []

        results = db.execute(
            text(
                """
                SELECT chunk_text FROM embeddings
                WHERE file_id = ANY(:file_ids)
                AND LOWER(REPLACE(REPLACE(chunk_text, '-', ''), ' ', ''))
                    LIKE :pattern
                LIMIT 3
                """
            ),
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
                WHERE file_id = ANY(:file_ids)
                AND LOWER(chunk_text) LIKE :pattern
                LIMIT :top_k
                """
            ),
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
