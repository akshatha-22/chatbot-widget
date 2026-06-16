"""Unit tests for page-aware extraction, chunking, and search."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.services import file_parser_service
from app.services.vector_store_service import (
    PAGE_QUERY_TOP_K,
    _extract_page_number,
    _search_by_page,
    split_text_with_pages,
)


def _make_pdf(tmp_path, pages: list[str], filename: str = "doc.pdf") -> str:
    import fitz

    path = tmp_path / filename
    doc = fitz.open()
    for text in pages:
        page = doc.new_page()
        page.insert_text((72, 72), text)
    doc.save(path)
    doc.close()
    return str(path)


def test_pdf_extracts_three_page_markers(tmp_path):
    path = _make_pdf(tmp_path, ["Alpha content", "Beta content", "Gamma content"])
    text = file_parser_service.extract_text_with_pages(path, "doc.pdf")
    assert "[PAGE 1]" in text
    assert "[PAGE 2]" in text
    assert "[PAGE 3]" in text
    assert "Beta content" in text


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("what is on page 2", 2),
        ("page100", 100),
        ("p.11", 11),
        ("pg 5", 5),
        ("on page number 7", 7),
        ("tell me about bearings", None),
    ],
)
def test_extract_page_number(query, expected):
    assert _extract_page_number(query) == expected


def test_split_text_with_pages_preserves_page_prefix():
    source = "[PAGE 2]\n" + ("word " * 200)
    chunks = split_text_with_pages(source, chunk_size=100, chunk_overlap=10)
    assert chunks
    assert all(chunk["page"] == 2 for chunk in chunks)
    assert all(chunk["text"].startswith("[Page 2]") for chunk in chunks)
    assert chunks[0]["chunk_index"] == 0
    assert chunks[1]["chunk_index"] == 1


def test_search_by_page_orders_by_chunk_index(db_session):
    from sqlalchemy import text

    db_session.execute(
        text(
            """
            INSERT INTO uploaded_files
            (id, conversation_id, filename, file_path, status)
            VALUES ('f1', 1, 'doc.pdf', '/tmp/doc.pdf', 'processed')
            """
        )
    )
    db_session.execute(
        text(
            """
            INSERT INTO embeddings
            (file_id, chunk_text, embedding, chunk_index, page)
            VALUES
            ('f1', '[Page 11] second chunk', '[]', 1, 11),
            ('f1', '[Page 11] first chunk', '[]', 0, 11),
            ('f1', '[Page 10] other page', '[]', 0, 10)
            """
        )
    )
    db_session.commit()

    hits = _search_by_page(db_session, ["f1"], 11, top_k=5)
    assert hits == ["[Page 11] first chunk", "[Page 11] second chunk"]


def test_corrupted_pdf_page_is_skipped(tmp_path):
    path = _make_pdf(tmp_path, ["Good page one"])

    with patch(
        "app.services.file_parser_service._gemini_ocr_page",
        return_value="",
    ):
        with patch("pdfplumber.open", side_effect=RuntimeError("plumber failed")):
            text = file_parser_service._extract_pdf_deep(path, "doc.pdf")
    assert "[PAGE 1]" in text
    assert "Good page" in text


def test_page_query_uses_higher_top_k(monkeypatch, db_session):
    from app.services import vector_store_service

    captured: dict = {}

    def fake_search_by_page(db, file_ids, page_num, top_k):
        captured["top_k"] = top_k
        return ["[Page 100] content"]

    monkeypatch.setattr(vector_store_service, "_search_by_page", fake_search_by_page)
    monkeypatch.setattr(vector_store_service, "_is_index_stale", lambda db, fid: False)

    results = vector_store_service.search(
        ["f1"],
        "what is on page 100",
        top_k=5,
        db=db_session,
    )
    assert results == ["[Page 100] content"]
    assert captured["top_k"] == PAGE_QUERY_TOP_K


def test_semantic_query_keeps_default_top_k(monkeypatch, db_session):
    from app.services import vector_store_service

    monkeypatch.setattr(vector_store_service, "_is_index_stale", lambda db, fid: False)
    monkeypatch.setattr(
        vector_store_service,
        "_exact_string_search",
        lambda db, file_ids, query: [],
    )
    monkeypatch.setattr(vector_store_service, "_is_postgres", lambda db: False)

    captured: dict = {}

    def fake_keyword_fallback(db, file_ids, query, top_k):
        captured["top_k"] = top_k
        return []

    monkeypatch.setattr(vector_store_service, "_keyword_fallback", fake_keyword_fallback)

    vector_store_service.search(
        ["f1"],
        "bearing specifications",
        top_k=5,
        db=db_session,
    )
    assert captured["top_k"] == 5


def test_embed_batch_size_is_100():
    from app.services.vector_store_service import EMBED_BATCH_SIZE

    assert EMBED_BATCH_SIZE == 100
