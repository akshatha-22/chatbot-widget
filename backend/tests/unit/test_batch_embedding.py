"""Unit tests for batch embedding and bulk DB insert."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.services import vector_store_service

pytestmark = pytest.mark.real_vector_store


def test_batch_embedding_splits_250_into_three_batches(monkeypatch):
    calls: list[int] = []

    class FakeResponse:
        def __init__(self, n):
            self.embeddings = [
                type("E", (), {"values": [0.1] * 768})() for _ in range(n)
            ]

    class FakeModels:
        def embed_content(self, model, contents, config):
            calls.append(len(contents))
            return FakeResponse(len(contents))

    monkeypatch.setattr(
        vector_store_service, "_ensure_genai_configured", lambda: True
    )
    monkeypatch.setattr(vector_store_service, "_genai_client", lambda: type(
        "C", (), {"models": FakeModels()}
    )())
    monkeypatch.setattr(
        vector_store_service,
        "_embedding_models_to_try",
        lambda: ["gemini-embedding-001"],
    )

    chunks = [f"chunk {i}" for i in range(250)]
    vectors, _error = vector_store_service._get_embeddings_batch(chunks)
    assert len(vectors) == 250
    assert calls == [100, 100, 50]


def test_bulk_insert_batches_rows(db_session, monkeypatch):
    """chunk_and_store passes a list of rows to db.execute (executemany)."""
    captured: dict = {}

    def fake_execute(stmt, params=None):
        if params and isinstance(params, list):
            captured["bulk_rows"] = params
        return MagicMock()

    monkeypatch.setattr(db_session, "execute", fake_execute)
    monkeypatch.setattr(db_session, "commit", lambda: None)
    monkeypatch.setattr(db_session, "rollback", lambda: None)
    monkeypatch.setattr(db_session, "get_bind", lambda: type("B", (), {"dialect": type("D", (), {"name": "sqlite"})()})())
    monkeypatch.setattr(vector_store_service, "_persist_raw_text", lambda *a, **k: None)
    monkeypatch.setattr(
        vector_store_service,
        "_get_embeddings_batch",
        lambda chunks, batch_size=100: ([[0.1] * 768 for _ in chunks], None),
    )
    monkeypatch.setattr(vector_store_service, "_is_postgres", lambda db: False)
    monkeypatch.setattr(vector_store_service, "_resolve_index_chunks", lambda *a, **k: [
        {"text": "[Page 1] sample", "page": 1, "chunk_index": 0},
        {"text": "[Page 1] more", "page": 1, "chunk_index": 1},
    ])

    vector_store_service.chunk_and_store("f1", "[PAGE 1]\ntext", db=db_session)
    assert len(captured.get("bulk_rows", [])) == 2
