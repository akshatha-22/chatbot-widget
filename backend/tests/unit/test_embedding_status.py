"""Tests for embedding pipeline status finalization."""

from __future__ import annotations

from unittest.mock import patch

from app.api.v1.files import process_file_embedding
from app.database.db import UploadedFile


def test_process_file_embedding_sets_processed_after_chunk_and_store(
    db_session, tmp_path, monkeypatch
):
    """Status must reach processed even when chunk_and_store uses its own session."""
    path = tmp_path / "notes.txt"
    path.write_text("Hello world for embedding status test.", encoding="utf-8")

    row = UploadedFile(
        id="status-test-file",
        conversation_id=1,
        filename="notes.txt",
        file_path=str(path),
        status="pending",
    )
    db_session.add(row)
    db_session.commit()

    monkeypatch.setattr(
        "app.api.v1.files.vector_store_service.gemini_embeddings_available",
        lambda: True,
    )

    with patch(
        "app.api.v1.files.vector_store_service.chunk_and_store",
        return_value=True,
    ) as mock_store:
        process_file_embedding(row.id, str(path), row.filename)

    mock_store.assert_called_once()
    db_session.expire_all()
    updated = (
        db_session.query(UploadedFile)
        .filter(UploadedFile.id == row.id)
        .first()
    )
    assert updated is not None
    assert updated.status == "processed"
    assert updated.processing_error is None


def test_process_file_embedding_sets_failed_on_error(db_session, tmp_path):
    path = tmp_path / "missing-source.txt"
    row = UploadedFile(
        id="status-fail-file",
        conversation_id=1,
        filename="missing-source.txt",
        file_path=str(path),
        status="pending",
    )
    db_session.add(row)
    db_session.commit()

    process_file_embedding(row.id, str(path), row.filename)

    db_session.expire_all()
    updated = (
        db_session.query(UploadedFile)
        .filter(UploadedFile.id == row.id)
        .first()
    )
    assert updated is not None
    assert updated.status == "failed"
    assert updated.processing_error
