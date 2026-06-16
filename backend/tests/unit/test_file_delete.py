"""Unit tests for embedding cleanup on delete."""

from sqlalchemy import text

from app.database.db import Embedding
from app.services import vector_store_service


def test_delete_file_data_removes_embeddings(db_session):
    db_session.execute(
        text(
            """
            INSERT INTO embeddings (file_id, chunk_text, embedding, chunk_index)
            VALUES ('test-file-123', 'chunk one', '[]', 0)
            """
        )
    )
    db_session.commit()

    vector_store_service.delete_file_data("test-file-123", db=db_session)

    remaining = (
        db_session.query(Embedding)
        .filter(Embedding.file_id == "test-file-123")
        .count()
    )
    assert remaining == 0
