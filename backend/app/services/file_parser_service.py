import csv
import logging
import os
import re
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

PAGE_MARKER_RE = re.compile(r"\[PAGE\s+\d+\]", re.IGNORECASE)

MAX_PDF_OCR_BYTES = 100 * 1024 * 1024
PDF_FILE_API_THRESHOLD_BYTES = 4 * 1024 * 1024


def is_row_chunked_format(filename: str) -> bool:
    """True for spreadsheet formats indexed one row per chunk."""
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


def _ensure_pdf_page_markers(text: str) -> str:
    """Wrap OCR or legacy extractor output with [PAGE N] when markers are missing."""
    cleaned = (text or "").strip()
    if not cleaned:
        return cleaned
    if PAGE_MARKER_RE.search(cleaned):
        return cleaned
    return f"[PAGE 1]\n{cleaned}"


def _get_pdf_page_count(file_path: str) -> int:
    try:
        import pdfplumber

        with pdfplumber.open(file_path) as pdf:
            return len(pdf.pages)
    except Exception:
        try:
            import fitz

            with fitz.open(file_path) as doc:
                return len(doc)
        except Exception:
            try:
                import PyPDF2

                with open(file_path, "rb") as handle:
                    return len(PyPDF2.PdfReader(handle).pages)
            except Exception:
                return 0


def _format_tables(tables: list) -> str:
    """Convert pdfplumber table arrays to readable pipe-delimited text."""
    output: List[str] = []
    for table in tables:
        for row in table:
            cleaned = [str(cell).strip() if cell else "" for cell in row]
            if any(cleaned):
                output.append(" | ".join(cleaned))
    return "\n".join(output)


def _missing_pages(all_pages: Dict[int, str], total_pages: int) -> List[int]:
    return [
        page_num
        for page_num in range(1, total_pages + 1)
        if page_num not in all_pages or not (all_pages.get(page_num) or "").strip()
    ]


def _gemini_ocr_page(file_path: str, page_num: int) -> str:
    """Use Gemini vision to OCR a single scanned page (last resort)."""
    from app.config import settings

    if not settings.gemini_configured():
        return ""

    try:
        import fitz
        from google import genai
        from google.genai import types

        with fitz.open(file_path) as doc:
            page = doc[page_num - 1]
            pix = page.get_pixmap(dpi=150)
            img_bytes = pix.tobytes("png")

        client = genai.Client(api_key=settings.GEMINI_API_KEY.strip())
        model = settings.GEMINI_MODEL.removeprefix("models/")
        response = client.models.generate_content(
            model=model,
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_bytes(data=img_bytes, mime_type="image/png"),
                        types.Part.from_text(
                            text=(
                                "Extract all text from this page exactly as it appears. "
                                "Return only the text, no commentary."
                            )
                        ),
                    ],
                )
            ],
        )
        return (getattr(response, "text", None) or "").strip()
    except Exception as exc:
        logger.warning("Gemini OCR page %s failed: %s", page_num, exc)
        return ""


def _extract_pdf_deep(file_path: str, filename: str) -> str:
    """
    Deep extraction — reads every page with up to four strategies per missing page.
    """
    total_pages = _get_pdf_page_count(file_path)
    if total_pages == 0:
        raise ValueError(f"Could not determine page count for '{filename}'")

    all_pages: Dict[int, str] = {}

    # Strategy 1 — pdfplumber (text + tables)
    try:
        import pdfplumber

        with pdfplumber.open(file_path) as pdf:
            for i, page in enumerate(pdf.pages, start=1):
                try:
                    page_text = page.extract_text() or ""
                    table_text = _format_tables(page.extract_tables() or [])
                    combined = f"{page_text}\n{table_text}".strip()
                    if combined:
                        all_pages[i] = combined
                except Exception as exc:
                    logger.warning("pdfplumber page %s failed: %s", i, exc)
    except Exception as exc:
        logger.warning("pdfplumber failed for %s: %s", filename, exc)

    # Strategy 2 — PyMuPDF for pages pdfplumber missed
    for page_num in _missing_pages(all_pages, total_pages):
        try:
            import fitz

            with fitz.open(file_path) as doc:
                text = doc[page_num - 1].get_text("text").strip()
                if text:
                    all_pages[page_num] = text
        except Exception as exc:
            logger.warning("PyMuPDF page %s failed: %s", page_num, exc)

    # Strategy 3 — PyPDF2 for remaining pages
    still_missing = _missing_pages(all_pages, total_pages)
    if still_missing:
        try:
            import PyPDF2

            with open(file_path, "rb") as handle:
                reader = PyPDF2.PdfReader(handle)
                for page_num in still_missing:
                    try:
                        text = (reader.pages[page_num - 1].extract_text() or "").strip()
                        if text:
                            all_pages[page_num] = text
                    except Exception as exc:
                        logger.warning("PyPDF2 page %s failed: %s", page_num, exc)
        except Exception as exc:
            logger.warning("PyPDF2 failed for %s: %s", filename, exc)

    # Strategy 4 — Gemini OCR per remaining page
    for page_num in _missing_pages(all_pages, total_pages):
        text = _gemini_ocr_page(file_path, page_num)
        if text:
            all_pages[page_num] = text

    output: List[str] = []
    for page_num in sorted(all_pages.keys()):
        content = all_pages[page_num].strip()
        if content:
            output.append(f"[PAGE {page_num}]\n{content}")

    unreadable = _missing_pages(all_pages, total_pages)
    if unreadable:
        logger.warning(
            "Unreadable pages after all strategies in %s: %s",
            filename,
            unreadable,
        )

    if not output:
        raise ValueError(
            f"No readable text found in '{filename}'. "
            "This PDF may be blank or image-only."
        )

    logger.info(
        "Deep PDF extraction for %s: %s/%s pages with text",
        filename,
        len(output),
        total_pages,
    )
    return "\n\n".join(output)


def _extract_non_pdf(file_path: str, filename: str) -> str:
    ext = Path(file_path).suffix.lower() or os.path.splitext(filename.lower())[1]

    if ext == ".docx":
        import docx

        doc = docx.Document(file_path)
        paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
        return f"[PAGE 1]\n" + "\n".join(paragraphs)

    with open(file_path, "r", encoding="utf-8", errors="ignore") as handle:
        body = handle.read()
    return f"[PAGE 1]\n{body}"


def extract_text_with_pages(file_path: str, filename: str) -> str:
    """
    Extract text preserving page numbers.
    PDFs use deep multi-strategy per-page extraction; other formats use [PAGE 1].
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found at path: {file_path}")

    row_chunks = parse_row_chunks(file_path, filename)
    if row_chunks:
        return f"[PAGE 1]\n" + "\n".join(row_chunks)

    ext = Path(file_path).suffix.lower() or os.path.splitext(filename.lower())[1]

    try:
        if ext == ".pdf":
            return _extract_pdf_deep(file_path, filename)
        return _extract_non_pdf(file_path, filename)
    except Exception as exc:
        raise ValueError(f"Error parsing file '{filename}': {exc}") from exc


def extract_text(file_path: str, filename: str) -> str:
    """Extract plain text with page markers for RAG indexing."""
    return extract_text_with_pages(file_path, filename)
