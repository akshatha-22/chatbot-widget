"""Unit tests for spreadsheet row chunking."""

import csv
import os

from app.services import file_parser_service


def test_xlsx_produces_one_chunk_per_row(tmp_path):
    import openpyxl

    path = tmp_path / "parts.xlsx"
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Part", "Spec", "Price"])
    ws.append(["BP-4821", "Bearing", 12.5])
    ws.append(["BP-4822", "Seal", 8.0])
    ws.append([None, None, None])
    wb.save(path)

    chunks = file_parser_service.parse_row_chunks(str(path), "parts.xlsx")
    assert chunks is not None
    assert len(chunks) == 2
    assert "Part: BP-4821" in chunks[0]
    assert "Spec: Bearing" in chunks[0]
    assert "Price: 12.5" in chunks[0]


def test_empty_rows_are_skipped(tmp_path):
    path = tmp_path / "rows.csv"
    with open(path, "w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["Part", "Spec"])
        writer.writerow(["", ""])
        writer.writerow(["BP-1", "Widget"])

    chunks = file_parser_service.parse_row_chunks(str(path), "rows.csv")
    assert chunks == ["Part: BP-1 | Spec: Widget"]


def test_none_values_replaced_with_na(tmp_path):
    path = tmp_path / "rows.csv"
    with open(path, "w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["Part", "Spec"])
        writer.writerow(["BP-9", ""])

    chunks = file_parser_service.parse_row_chunks(str(path), "rows.csv")
    assert chunks == ["Part: BP-9 | Spec: N/A"]


def test_pdf_still_uses_character_chunker(tmp_path):
    from app.services.vector_store_service import split_text

    pdf_path = tmp_path / "notes.txt"
    pdf_path.write_text("paragraph one\n\nparagraph two", encoding="utf-8")
    assert file_parser_service.parse_row_chunks(str(pdf_path), "notes.txt") is None
    chunks = split_text(pdf_path.read_text(encoding="utf-8"))
    assert len(chunks) >= 1
