"""Unit tests for FAISS embedding model versioning."""

from unittest.mock import patch

from app.database.db import UploadedFile
from app.services import vector_store_service


def test_get_current_embedding_model_version():
    assert vector_store_service.get_current_embedding_model_version() == "all-MiniLM-L6-v2-v1.0"


def test_is_index_stale_when_version_missing(db_session):
    row = UploadedFile(
        id="file-1",
        conversation_id=1,
        filename="a.txt",
        file_path="/tmp/a.txt",
        status="processed",
        chunks_blob=b"chunks",
        embedding_model_version=None,
    )
    db_session.add(row)
    db_session.commit()

    assert vector_store_service._is_index_stale(db_session, "file-1") is True


def test_is_index_stale_when_version_matches(db_session):
    row = UploadedFile(
        id="file-2",
        conversation_id=1,
        filename="b.txt",
        file_path="/tmp/b.txt",
        status="processed",
        embedding_model_version=vector_store_service.get_current_embedding_model_version(),
    )
    db_session.add(row)
    db_session.commit()

    assert vector_store_service._is_index_stale(db_session, "file-2") is False


def test_reindex_file_updates_version(db_session, monkeypatch, tmp_path):
    text_file = tmp_path / "doc.txt"
    text_file.write_text("Sample document text for indexing.", encoding="utf-8")

    row = UploadedFile(
        id="file-3",
        conversation_id=1,
        filename="doc.txt",
        file_path=str(text_file),
        status="processed",
        embedding_model_version="old-model-v0.1",
    )
    db_session.add(row)
    db_session.commit()

    monkeypatch.setattr(
        "app.services.vector_store_service.chunk_and_store",
        lambda file_id, text, db=None: None,
    )

    with patch.object(vector_store_service, "clear_memory_cache"):
        vector_store_service.reindex_file(db_session, "file-3")

    db_session.refresh(row)
    assert row.status == "processed"
