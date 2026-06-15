import csv
import os
from typing import List, Optional


def is_row_chunked_format(filename: str) -> bool:
    """True for spreadsheet formats indexed one row per FAISS chunk."""
    ext = os.path.splitext(filename.lower())[1]
    return ext in (".xlsx", ".xls", ".csv")


def _format_row_chunk(headers: List[str], values: tuple) -> Optional[str]:
    """Format one spreadsheet row as a labeled chunk string."""
    parts: List[str] = []
    for idx, value in enumerate(values):
        if value is None or str(value).strip() == "":
            cell = "N/A"
        else:
            cell = str(value).strip()
        label = headers[idx] if idx < len(headers) and headers[idx] else f"Column {idx + 1}"
        parts.append(f"{label}: {cell}")
    if not parts:
        return None
    if all(
        (value is None or str(value).strip() == "")
        for value in values
    ):
        return None
    return " | ".join(parts)


def parse_row_chunks(file_path: str, filename: str) -> Optional[List[str]]:
    """
    Parse XLSX/XLS/CSV row-by-row. Each non-empty row becomes exactly one chunk.
    Returns None for non-tabular formats (caller uses character-based chunking).
    """
    if not is_row_chunked_format(filename):
        return None

    ext = os.path.splitext(filename.lower())[1]

    try:
        if ext == ".csv":
            chunks: List[str] = []
            with open(file_path, "r", encoding="utf-8", errors="ignore", newline="") as handle:
                reader = csv.reader(handle)
                rows = list(reader)
            if not rows:
                return []

            headers = [h.strip() or f"Column {i + 1}" for i, h in enumerate(rows[0])]
            data_rows = rows[1:] if len(rows) > 1 else rows
            if not any(any(cell.strip() for cell in row) for row in data_rows):
                return []

            for row in data_rows:
                padded = tuple(row) + tuple("" for _ in range(max(0, len(headers) - len(row))))
                chunk = _format_row_chunk(headers, padded[: len(headers)])
                if chunk:
                    chunks.append(chunk)
            return chunks

        if ext in (".xlsx", ".xls"):
            import openpyxl

            wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
            chunks = []
            for sheet in wb.worksheets:
                rows = list(sheet.iter_rows(values_only=True))
                if not rows:
                    continue
                first = rows[0]
                has_header = all(isinstance(cell, str) for cell in first if cell is not None)
                if has_header and len(rows) > 1:
                    headers = [
                        str(cell).strip() if cell is not None else f"Column {i + 1}"
                        for i, cell in enumerate(first)
                    ]
                    data_rows = rows[1:]
                else:
                    width = max(len(first), 1)
                    headers = [f"Column {i + 1}" for i in range(width)]
                    data_rows = rows

                for row in data_rows:
                    padded = tuple(row) + tuple(None for _ in range(max(0, len(headers) - len(row))))
                    chunk = _format_row_chunk(headers, padded[: len(headers)])
                    if chunk:
                        chunks.append(chunk)
            return chunks
    except Exception as exc:
        raise ValueError(f"Error parsing structured file '{filename}': {exc}") from exc

    return None


def extract_text(file_path: str, filename: str) -> str:
    """
    Extracts plain text content from a file based on its extension.
    Supports PDF (.pdf), DOCX (.docx), XLSX (.xlsx), and plain text (.txt, .md, .csv, etc.).
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found at path: {file_path}")

    row_chunks = parse_row_chunks(file_path, filename)
    if row_chunks:
        return "\n".join(row_chunks)

    ext = os.path.splitext(filename.lower())[1]

    try:
        if ext == ".pdf":
            import PyPDF2

            text = ""
            with open(file_path, "rb") as handle:
                reader = PyPDF2.PdfReader(handle)
                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
            return text

        if ext == ".docx":
            import docx

            doc = docx.Document(file_path)
            paragraphs = [para.text for para in doc.paragraphs]
            return "\n".join(paragraphs)

        with open(file_path, "r", encoding="utf-8", errors="ignore") as handle:
            return handle.read()

    except Exception as exc:
        raise ValueError(f"Error parsing file '{filename}': {exc}") from exc
