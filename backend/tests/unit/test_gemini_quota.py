"""Tests for Gemini quota detection and embedding fail-fast."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.services import vector_store_service
from app.services.gemini_errors import is_quota_exhausted, quota_exhausted_message

pytestmark = pytest.mark.real_vector_store


def test_is_quota_exhausted_detects_429():
    assert is_quota_exhausted(Exception("429 RESOURCE_EXHAUSTED"))
    assert not is_quota_exhausted(Exception("500 internal"))


def test_quota_exhausted_message_is_actionable():
    msg = quota_exhausted_message("429 RESOURCE_EXHAUSTED", context="embedding")
    assert "quota exceeded" in msg.lower()
    assert "429" in msg


def test_embedding_batch_aborts_on_quota(monkeypatch):
    calls = {"n": 0}

    class FakeModels:
        def embed_content(self, model, contents, config):
            calls["n"] += 1
            raise RuntimeError("429 RESOURCE_EXHAUSTED quota")

    monkeypatch.setattr(vector_store_service, "_ensure_genai_configured", lambda: True)
    monkeypatch.setattr(
        vector_store_service,
        "_genai_client",
        lambda: type("C", (), {"models": FakeModels()})(),
    )
    monkeypatch.setattr(
        vector_store_service,
        "_embedding_models_to_try",
        lambda: ["gemini-embedding-001"],
    )

    chunks = [f"chunk {i}" for i in range(250)]
    vectors, error = vector_store_service._get_embeddings_batch(chunks)
    assert calls["n"] == 1
    assert len(vectors) == 100
    assert error is not None
    assert is_quota_exhausted(error)


def test_chunk_and_store_raises_friendly_quota_message(db_session, monkeypatch):
    monkeypatch.setattr(db_session, "execute", MagicMock())
    monkeypatch.setattr(db_session, "commit", lambda: None)
    monkeypatch.setattr(db_session, "rollback", lambda: None)
    monkeypatch.setattr(
        db_session,
        "get_bind",
        lambda clause=None: type("B", (), {"dialect": type("D", (), {"name": "sqlite"})()})(),
    )
    monkeypatch.setattr(vector_store_service, "_persist_raw_text", lambda *a, **k: None)
    monkeypatch.setattr(vector_store_service, "_is_postgres", lambda db: False)
    monkeypatch.setattr(
        vector_store_service,
        "_resolve_index_chunks",
        lambda *a, **k: [
            {"text": "[Page 1] sample", "page": 1, "chunk_index": 0},
        ],
    )
    monkeypatch.setattr(
        vector_store_service,
        "_get_embeddings_batch",
        lambda chunks, batch_size=100: ([[]], "429 RESOURCE_EXHAUSTED"),
    )

    with pytest.raises(ValueError, match="quota exceeded"):
        vector_store_service.chunk_and_store("f1", "[PAGE 1]\ntext", db=db_session)
