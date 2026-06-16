"""Unit tests for exact string pre-search."""

from unittest.mock import patch

from app.services import vector_store_service


def test_bp4821_matches_bp4821_after_normalization():
    raw = "Part: BP-4821 | Spec: Widget | Price: 10"
    assert vector_store_service._exact_string_search_raw_text(raw, "bp4821") == raw


def test_bp_space_4821_matches_bp_dash_4821():
    raw = "Part: BP-4821 | Spec: Widget"
    assert vector_store_service._exact_string_search_raw_text(raw, "BP 4821") == raw


def test_exact_match_bypasses_semantic_search(monkeypatch):
    monkeypatch.setattr(
        "app.services.vector_store_service._get_query_embedding",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            AssertionError("semantic search should not run")
        ),
    )

    class FakeRow:
        raw_text_blob = "SKU: BP-4821 | Name: Bearing"
        embedding_model_version = vector_store_service.get_current_embedding_model_version()

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


def test_missing_raw_text_blob_falls_through_to_keyword_search(monkeypatch):
    monkeypatch.setattr(
        "app.services.vector_store_service._keyword_fallback",
        lambda *args, **kwargs: ["fallback chunk"],
    )
    monkeypatch.setattr(
        "app.services.vector_store_service._exact_string_search",
        lambda *args, **kwargs: [],
    )

    class FakeRow:
        raw_text_blob = None
        embedding_model_version = vector_store_service.get_current_embedding_model_version()

    class FakeQuery:
        def filter(self, *args, **kwargs):
            return self

        def first(self):
            return FakeRow()

    class FakeDb:
        def query(self, *args, **kwargs):
            return FakeQuery()

        def get_bind(self):
            return type("Bind", (), {"dialect": type("Dialect", (), {"name": "sqlite"})()})()

    hits = vector_store_service.search(["file-1"], "anything", db=FakeDb())
    assert hits == ["fallback chunk"]
