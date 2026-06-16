"""Unit tests for deep multi-strategy PDF extraction."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.services import file_parser_service


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


def test_pdf_five_pages_all_markers(tmp_path):
    pages = [f"Content page {i}" for i in range(1, 6)]
    path = _make_pdf(tmp_path, pages)
    text = file_parser_service.extract_text_with_pages(path, "doc.pdf")
    for i in range(1, 6):
        assert f"[PAGE {i}]" in text


def test_empty_page_skipped_rest_extracted(tmp_path):
    path = _make_pdf(tmp_path, ["Page one", "Page three"], "sparse.pdf")
    text = file_parser_service.extract_text_with_pages(path, "sparse.pdf")
    assert "[PAGE 1]" in text
    assert "Page one" in text


def test_pdfplumber_failure_falls_back_to_pymupdf(tmp_path):
    path = _make_pdf(tmp_path, ["Fallback text"])
    with patch("pdfplumber.open", side_effect=RuntimeError("pdfplumber down")):
        text = file_parser_service._extract_pdf_deep(path, "doc.pdf")
    assert "[PAGE 1]" in text
    assert "Fallback text" in text


def test_pymupdf_failure_falls_back_to_pypdf2(tmp_path, monkeypatch):
    path = _make_pdf(tmp_path, ["PyPDF2 text"])
    monkeypatch.setattr(
        file_parser_service,
        "_missing_pages",
        lambda all_pages, total: [1],
    )

    class BrokenDoc:
        def __getitem__(self, idx):
            raise RuntimeError("pymupdf broken")

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    with patch("pdfplumber.open", side_effect=RuntimeError("no plumber")):
        with patch("fitz.open", return_value=BrokenDoc()):
            text = file_parser_service._extract_pdf_deep(path, "doc.pdf")
    assert "[PAGE 1]" in text


def test_all_extractors_fail_triggers_gemini_ocr_page(tmp_path, monkeypatch):
    path = _make_pdf(tmp_path, ["OCR text"])
    monkeypatch.setattr(file_parser_service, "_get_pdf_page_count", lambda p: 1)
    monkeypatch.setattr(
        file_parser_service,
        "_missing_pages",
        lambda all_pages, total: [1],
    )
    with patch("pdfplumber.open", side_effect=RuntimeError("no plumber")):
        with patch("fitz.open", side_effect=RuntimeError("no fitz")):
            with patch(
                "app.services.file_parser_service._gemini_ocr_page",
                return_value="OCR extracted content",
            ) as mock_ocr:
                text = file_parser_service._extract_pdf_deep(path, "doc.pdf")
    mock_ocr.assert_called_once_with(path, 1)
    assert "OCR extracted content" in text


def test_format_tables_pipe_delimited():
    tables = [[["Part", "Price"], ["A1", "10"]]]
    formatted = file_parser_service._format_tables(tables)
    assert "Part | Price" in formatted
    assert "A1 | 10" in formatted


def test_non_pdf_returns_page_one_marker(tmp_path):
    path = tmp_path / "notes.txt"
    path.write_text("Hello world", encoding="utf-8")
    text = file_parser_service.extract_text_with_pages(str(path), "notes.txt")
    assert text.startswith("[PAGE 1]")
    assert "Hello world" in text


def test_ocr_capped_at_max_pages(tmp_path, monkeypatch):
    path = _make_pdf(tmp_path, [f"Page {i}" for i in range(1, 16)], "big.pdf")
    monkeypatch.setattr(file_parser_service, "_get_pdf_page_count", lambda p: 15)

    with patch("pdfplumber.open", side_effect=RuntimeError("no plumber")):
        with patch(
            "app.services.file_parser_service._extract_pymupdf_pages_parallel",
            return_value={},
        ):
            with patch("PyPDF2.PdfReader", side_effect=RuntimeError("no pypdf2")):
                with patch(
                    "app.services.file_parser_service._gemini_ocr_page",
                    return_value="OCR page",
                ) as mock_ocr:
                    file_parser_service._extract_pdf_deep(path, "big.pdf")

    assert mock_ocr.call_count == file_parser_service.MAX_OCR_PAGES


def test_page_truncation_at_max_chars(tmp_path, monkeypatch):
    long_text = "x" * 5000
    path = _make_pdf(tmp_path, [long_text], "dense.pdf")
    monkeypatch.setattr(file_parser_service, "MAX_CHARS_PER_PAGE", 3000)

    text = file_parser_service.extract_text_with_pages(path, "dense.pdf")
    assert "[PAGE 1]" in text
    page_body = text.split("[PAGE 1]\n", 1)[1]
    assert len(page_body.strip()) <= 3000


def test_corrupted_pdfplumber_page_skipped(tmp_path):
    path = _make_pdf(tmp_path, ["Good page"])

    class FakePage:
        def extract_text(self):
            raise RuntimeError("corrupt")

        def extract_tables(self):
            return []

    class FakePdf:
        pages = [FakePage()]

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    with patch("pdfplumber.open", return_value=FakePdf()):
        with patch("fitz.open", side_effect=RuntimeError("no fitz")):
            with patch(
                "PyPDF2.PdfReader",
                side_effect=RuntimeError("no pypdf2"),
            ):
                with patch(
                    "app.services.file_parser_service._gemini_ocr_page",
                    return_value="Recovered via OCR",
                ):
                    text = file_parser_service._extract_pdf_deep(path, "doc.pdf")
    assert "Recovered via OCR" in text
