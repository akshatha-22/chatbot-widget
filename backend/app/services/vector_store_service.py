import logging
import os
import pickle
import re
import tempfile
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_MODEL_VERSION = f"{EMBEDDING_MODEL_NAME}-v1.0"

# Define storage directory for vector store indices (legacy disk fallback)
VECTOR_STORE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "vector_store")
)

_model = None
_index_memory_cache: dict[str, Tuple[Optional[object], List[str]]] = {}


def ml_stack_available() -> bool:
    """True when FAISS + sentence-transformers can be imported."""
    try:
        import faiss  # noqa: F401
        import numpy  # noqa: F401
        from sentence_transformers import SentenceTransformer  # noqa: F401

        return True
    except ImportError:
        return False


def get_current_embedding_model_version() -> str:
    return EMBEDDING_MODEL_VERSION


def get_embedding_model():
    """Lazily load the SentenceTransformer model (avoids import at startup / in CI)."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return _model


def _is_index_stale(db: Session, file_id: str) -> bool:
    from app.database.db import UploadedFile

    row = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if not row:
        return False
    if not row.embedding_model_version:
        return bool(row.chunks_blob or row.faiss_index_blob)
    return row.embedding_model_version != get_current_embedding_model_version()


def reindex_file(db: Session, file_id: str) -> None:
    """Re-embed a file when the stored FAISS index version is stale."""
    from app.database.db import UploadedFile
    from app.services import file_parser_service

    row = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if not row or not row.file_path:
        return

    logger.warning("FAISS index version mismatch for file %s — reindexing", file_id)
    clear_memory_cache(file_id)
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


def _normalize_exact_key(value: str) -> str:
    """Lowercase and strip hyphens, spaces, underscores for part-number matching."""
    return re.sub(r"[\s\-_]+", "", (value or "").lower())


def _exact_string_search(raw_text: str, query: str) -> Optional[str]:
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
        db.commit()


def split_text(text: str, chunk_size: int = 500, chunk_overlap: int = 50) -> List[str]:
    """Splits document text into clean, smaller chunks using paragraphs/sentences."""
    if not text:
        return []

    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = ""

    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue

        if len(current_chunk) + len(paragraph) <= chunk_size:
            if current_chunk:
                current_chunk += "\n\n" + paragraph
            else:
                current_chunk = paragraph
        else:
            if current_chunk:
                chunks.append(current_chunk)

            if len(paragraph) > chunk_size:
                sentences = paragraph.split(". ")
                sub_chunk = ""
                for sentence in sentences:
                    sentence = sentence.strip()
                    if not sentence:
                        continue
                    if len(sub_chunk) + len(sentence) <= chunk_size:
                        if sub_chunk:
                            sub_chunk += ". " + sentence
                        else:
                            sub_chunk = sentence
                    else:
                        if sub_chunk:
                            chunks.append(sub_chunk)
                        sub_chunk = sentence
                if sub_chunk:
                    current_chunk = sub_chunk
            else:
                current_chunk = paragraph

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


def _serialize_faiss_index(index) -> bytes:
    import faiss

    fd, path = tempfile.mkstemp(suffix=".index")
    os.close(fd)
    try:
        faiss.write_index(index, path)
        with open(path, "rb") as f:
            return f.read()
    finally:
        os.unlink(path)


def _deserialize_faiss_index(data: bytes):
    import faiss

    fd, path = tempfile.mkstemp(suffix=".index")
    os.close(fd)
    try:
        with open(path, "wb") as f:
            f.write(data)
        return faiss.read_index(path)
    finally:
        os.unlink(path)


def _persist_chunks_to_disk(file_id: str, chunks: List[str]) -> None:
    os.makedirs(VECTOR_STORE_DIR, exist_ok=True)
    chunks_path = os.path.join(VECTOR_STORE_DIR, f"{file_id}.chunks")
    with open(chunks_path, "wb") as f:
        pickle.dump(chunks, f)


def _persist_to_disk(file_id: str, index, chunks: List[str]) -> None:
    import faiss

    os.makedirs(VECTOR_STORE_DIR, exist_ok=True)
    index_path = os.path.join(VECTOR_STORE_DIR, f"{file_id}.index")
    chunks_path = os.path.join(VECTOR_STORE_DIR, f"{file_id}.chunks")
    faiss.write_index(index, index_path)
    with open(chunks_path, "wb") as f:
        pickle.dump(chunks, f)


def _load_from_disk(file_id: str) -> Tuple[Optional[object], Optional[List[str]]]:
    chunks_path = os.path.join(VECTOR_STORE_DIR, f"{file_id}.chunks")
    index_path = os.path.join(VECTOR_STORE_DIR, f"{file_id}.index")

    if not os.path.exists(chunks_path):
        return None, None

    with open(chunks_path, "rb") as f:
        chunks = pickle.load(f)

    index = None
    if os.path.exists(index_path):
        import faiss

        index = faiss.read_index(index_path)

    return index, chunks


def _load_from_db(db: Session, file_id: str) -> Tuple[Optional[object], Optional[List[str]]]:
    from app.database.db import UploadedFile

    row = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if not row or not row.chunks_blob:
        return None, None

    chunks = pickle.loads(row.chunks_blob)
    index = None
    if row.faiss_index_blob:
        index = _deserialize_faiss_index(row.faiss_index_blob)
    return index, chunks


def _load_vectors(
    file_id: str, db: Optional[Session] = None
) -> Tuple[Optional[object], Optional[List[str]]]:
    """Load FAISS index + chunks: memory cache → DB blob → disk."""
    if file_id in _index_memory_cache:
        return _index_memory_cache[file_id]

    index, chunks = None, None

    if db is not None:
        index, chunks = _load_from_db(db, file_id)

    if chunks is None:
        index, chunks = _load_from_disk(file_id)

    if chunks is not None:
        _index_memory_cache[file_id] = (index, chunks)

    return index, chunks


def _store_chunks_only(
    file_id: str, chunks: List[str], db: Optional[Session] = None
) -> None:
    """Persist text chunks without vector embeddings (dev fallback)."""
    from app.database.db import UploadedFile

    chunks_blob = pickle.dumps(chunks)

    if db is not None:
        row = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
        if row:
            row.chunks_blob = chunks_blob
            row.faiss_index_blob = None
            row.embedding_model_version = get_current_embedding_model_version()
            db.commit()

    _persist_chunks_to_disk(file_id, chunks)
    _index_memory_cache[file_id] = (None, chunks)


def _simple_chunk_search(chunks: List[str], query: str, top_k: int) -> List[str]:
    """Keyword overlap search when FAISS / embeddings are unavailable."""
    query_lower = query.lower().strip()
    if not query_lower:
        return chunks[:top_k]

    terms = [t for t in re.split(r"\W+", query_lower) if len(t) > 2]
    scored: list[tuple[str, float]] = []

    for chunk in chunks:
        chunk_lower = chunk.lower()
        score = 0.0
        if query_lower in chunk_lower:
            score += 10.0
        for term in terms:
            if term in chunk_lower:
                score += 1.0
        if score > 0:
            scored.append((chunk, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return [chunk for chunk, _ in scored[:top_k]]


def _chunk_and_store_with_faiss(
    file_id: str, chunks: List[str], db: Optional[Session] = None
) -> None:
    import faiss
    import numpy as np

    from app.database.db import UploadedFile

    model = get_embedding_model()
    embeddings = model.encode(chunks)
    dimension = embeddings.shape[1]

    index = faiss.IndexFlatL2(dimension)
    index.add(np.array(embeddings).astype("float32"))

    index_blob = _serialize_faiss_index(index)
    chunks_blob = pickle.dumps(chunks)

    if db is not None:
        row = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
        if row:
            row.faiss_index_blob = index_blob
            row.chunks_blob = chunks_blob
            row.embedding_model_version = get_current_embedding_model_version()
            db.commit()

    _persist_to_disk(file_id, index, chunks)
    _index_memory_cache[file_id] = (index, chunks)


def chunk_and_store(
    file_id: str,
    text: str,
    db: Optional[Session] = None,
    *,
    chunks: Optional[List[str]] = None,
    raw_text: Optional[str] = None,
):
    """Split text (or use pre-built row chunks), embed when possible, and persist."""
    resolved_chunks = chunks if chunks is not None else split_text(text)
    if not resolved_chunks:
        raise ValueError("No indexable text chunks after splitting document")

    _persist_raw_text(file_id, raw_text or text, db)

    if not ml_stack_available():
        print(
            "[EMBED] FAISS/sentence-transformers not installed — "
            "storing text chunks with keyword search fallback"
        )
        _store_chunks_only(file_id, resolved_chunks, db)
        return

    try:
        _chunk_and_store_with_faiss(file_id, resolved_chunks, db)
    except ImportError as exc:
        print(f"[EMBED] Embedding import failed ({exc}) — using text-only fallback")
        _store_chunks_only(file_id, resolved_chunks, db)
    except Exception as exc:
        print(f"[EMBED] FAISS indexing failed ({exc}) — using text-only fallback")
        _store_chunks_only(file_id, resolved_chunks, db)


def search(
    file_ids: List[str],
    query: str,
    top_k: int = 5,
    db: Optional[Session] = None,
) -> List[str]:
    """Search matching chunks across multiple file IDs."""
    if not file_ids:
        return []

    if db is not None:
        from app.database.db import UploadedFile

        for file_id in file_ids:
            row = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
            if row and row.raw_text_blob:
                exact_hit = _exact_string_search(row.raw_text_blob, query)
                if exact_hit:
                    return [exact_hit]

    all_matches: list[tuple[str, float]] = []

    for file_id in file_ids:
        if db is not None and _is_index_stale(db, file_id):
            try:
                reindex_file(db, file_id)
            except Exception as exc:
                logger.warning("Reindex failed for %s: %s", file_id, exc)

        index, chunks = _load_vectors(file_id, db)
        if not chunks:
            print(f"[FAISS] Chunks not found for {file_id}")
            continue

        if index is None:
            for rank, chunk in enumerate(_simple_chunk_search(chunks, query, top_k)):
                all_matches.append((chunk, float(rank)))
            continue

        try:
            import numpy as np

            model = get_embedding_model()
            query_vector = model.encode([query])
            query_np = np.array(query_vector).astype("float32")
            distances, indices = index.search(query_np, min(top_k, len(chunks)))

            for dist, idx in zip(distances[0], indices[0]):
                if idx != -1 and idx < len(chunks):
                    all_matches.append((chunks[idx], float(dist)))
        except Exception as e:
            print(f"[FAISS] Search error for {file_id}: {e} — using keyword fallback")
            for rank, chunk in enumerate(_simple_chunk_search(chunks, query, top_k)):
                all_matches.append((chunk, float(rank)))

    # FAISS uses lower distance = better; keyword fallback uses lower rank = better
    all_matches.sort(key=lambda x: x[1])

    seen = set()
    unique_chunks = []
    for chunk, _ in all_matches:
        if chunk not in seen:
            seen.add(chunk)
            unique_chunks.append(chunk)
            if len(unique_chunks) >= top_k:
                break

    return unique_chunks


def clear_memory_cache(file_id: Optional[str] = None) -> None:
    """Drop cached indexes (used in tests)."""
    if file_id is None:
        _index_memory_cache.clear()
    else:
        _index_memory_cache.pop(file_id, None)


def delete_file_data(file_id: str) -> None:
    """Remove in-memory and on-disk vector artifacts for a deleted upload."""
    clear_memory_cache(file_id)
    for suffix in (".index", ".chunks"):
        path = os.path.join(VECTOR_STORE_DIR, f"{file_id}{suffix}")
        if os.path.isfile(path):
            try:
                os.unlink(path)
            except OSError as exc:
                logger.warning("Could not delete vector artifact %s: %s", path, exc)
