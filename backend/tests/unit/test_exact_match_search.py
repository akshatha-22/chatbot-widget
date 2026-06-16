"""Unit tests for exact string pre-search."""

from unittest.mock import patch

from app.services import vector_store_service


def test_bp4821_matches_bp4821_after_normalization():
    raw = "Part: BP-4821 | Spec: Widget | Price: 10"
    assert vector_store_service._exact_string_search(raw, "bp4821") == raw


def test_bp_space_4821_matches_bp_dash_4821():
    raw = "Part: BP-4821 | Spec: Widget"
    assert vector_store_service._exact_string_search(raw, "BP 4821") == raw


def test_exact_match_bypasses_faiss(monkeypatch):
    monkeypatch.setattr(
        "app.services.vector_store_service._load_vectors",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("FAISS should not run")),
    )
    monkeypatch.setattr(
        "app.services.vector_store_service._simple_chunk_search",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("keyword search should not run")),
    )

    class FakeRow:
        raw_text_blob = "SKU: BP-4821 | Name: Bearing"

    class FakeQuery:
        def filter(self, *args, **kwargs):
            return self

        def first(self):
            return FakeRow()

    class FakeDb:
        def query(self, *args, **kwargs):
            return FakeQuery()

    hits = vector_store_service.search(["file-1"], "BP-4821", db=FakeDb())
    assert hits == ["SKU: BP-4821 | Name: Bearing"]


def test_missing_raw_text_blob_falls_through_to_faiss(monkeypatch):
    monkeypatch.setattr(
        "app.services.vector_store_service._load_vectors",
        lambda file_id, db=None: (None, ["fallback chunk"]),
    )
    monkeypatch.setattr(
        "app.services.vector_store_service._simple_chunk_search",
        lambda chunks, query, top_k: ["fallback chunk"],
    )

    class FakeRow:
        raw_text_blob = None
        embedding_model_version = vector_store_service.get_current_embedding_model_version()
        chunks_blob = b"chunks"
        faiss_index_blob = None

    class FakeQuery:
        def filter(self, *args, **kwargs):
            return self

        def first(self):
            return FakeRow()

    class FakeDb:
        def query(self, *args, **kwargs):
            return FakeQuery()

    hits = vector_store_service.search(["file-1"], "anything", db=FakeDb())
    assert hits == ["fallback chunk"]
