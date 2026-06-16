import csv
import logging
import os
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

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


def _extract_pdf_pdfplumber(file_path: str) -> str:
    """Extract PDF text page-by-page with [PAGE N] markers."""
    import pdfplumber

    pages: List[str] = []
    with pdfplumber.open(file_path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            try:
                page_text = page.extract_text() or ""
                if page_text.strip():
                    pages.append(f"[PAGE {i}]\n{page_text.strip()}")
            except Exception as exc:
                logger.warning("Skipping PDF page %s in %s: %s", i, file_path, exc)
    return "\n\n".join(pages)


def _extract_pdf_pypdf2(file_path: str) -> str:
    import PyPDF2

    pages: List[str] = []
    with open(file_path, "rb") as handle:
        reader = PyPDF2.PdfReader(handle)
        for i, page in enumerate(reader.pages, start=1):
            try:
                page_text = page.extract_text() or ""
                if page_text.strip():
                    pages.append(f"[PAGE {i}]\n{page_text.strip()}")
            except Exception as exc:
                logger.warning("Skipping PDF page %s in %s: %s", i, file_path, exc)
    return "\n\n".join(pages)


def _extract_pdf_pymupdf(file_path: str) -> str:
    import fitz

    pages: List[str] = []
    with fitz.open(file_path) as doc:
        for i, page in enumerate(doc, start=1):
            try:
                text = page.get_text("text")
                if text and text.strip():
                    pages.append(f"[PAGE {i}]\n{text.strip()}")
            except Exception as exc:
                logger.warning("Skipping PDF page %s in %s: %s", i, file_path, exc)
    return "\n\n".join(pages)


def _extract_pdf_gemini_ocr(file_path: str, filename: str) -> str:
    """OCR fallback for image-only PDFs (e.g. flipbook catalogues) via Gemini."""
    import time

    from app.config import settings

    if not settings.gemini_configured():
        return ""

    file_size = os.path.getsize(file_path)
    if file_size > MAX_PDF_OCR_BYTES:
        raise ValueError(
            f"{filename} exceeds the {MAX_PDF_OCR_BYTES // (1024 * 1024)}MB OCR limit."
        )

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.GEMINI_API_KEY.strip())
    model = settings.GEMINI_MODEL.removeprefix("models/")
    prompt = (
        "Extract all readable text from this PDF document. "
        "Prefix each page with [PAGE N] on its own line before that page's text "
        "(N is the page number starting at 1). "
        "Include product names, part numbers, descriptions, and tables. "
        "Return plain text only — no markdown code fences."
    )

    uploaded = None
    try:
        if file_size >= PDF_FILE_API_THRESHOLD_BYTES:
            uploaded = client.files.upload(file=file_path)
            for _ in range(90):
                uploaded = client.files.get(name=uploaded.name)
                state = getattr(uploaded, "state", None)
                state_name = getattr(state, "name", str(state))
                if state_name == "ACTIVE":
                    break
                if state_name == "FAILED":
                    raise ValueError("Gemini could not process this PDF for text extraction")
                time.sleep(2)
            else:
                raise ValueError("Timed out waiting for PDF text extraction")

            response = client.models.generate_content(
                model=model,
                contents=[uploaded, prompt],
            )
        else:
            with open(file_path, "rb") as handle:
                pdf_bytes = handle.read()
            response = client.models.generate_content(
                model=model,
                contents=[
                    types.Content(
                        role="user",
                        parts=[
                            types.Part.from_bytes(
                                data=pdf_bytes, mime_type="application/pdf"
                            ),
                            types.Part.from_text(text=prompt),
                        ],
                    )
                ],
            )
    finally:
        if uploaded is not None:
            try:
                client.files.delete(name=uploaded.name)
            except Exception:
                pass

    text = (getattr(response, "text", None) or "").strip()
    if text and not text.lstrip().startswith("[PAGE"):
        text = f"[PAGE 1]\n{text}"
    if text:
        logger.info("Gemini OCR extracted %s characters from %s", len(text), filename)
    return text


def _extract_pdf_text(file_path: str, filename: str) -> str:
    """Try pdfplumber, PyPDF2, PyMuPDF, then Gemini OCR for image-only PDFs."""
    extractors = (
        ("pdfplumber", _extract_pdf_pdfplumber),
        ("PyPDF2", _extract_pdf_pypdf2),
        ("PyMuPDF", _extract_pdf_pymupdf),
    )
    for name, extractor in extractors:
        try:
            text = extractor(file_path).strip()
            if text:
                logger.info("PDF text via %s: %s chars from %s", name, len(text), filename)
                return text
        except Exception as exc:
            logger.warning("%s extraction failed for %s: %s", name, filename, exc)

    try:
        text = _extract_pdf_gemini_ocr(file_path, filename).strip()
        if text:
            return text
    except Exception as exc:
        logger.error("Gemini OCR failed for %s: %s", filename, exc)
        raise ValueError(f"Could not read text from PDF '{filename}': {exc}") from exc

    raise ValueError(
        f"No readable text found in '{filename}'. "
        "This PDF may be blank or image-only; try exporting a text-based PDF."
    )


def extract_text_with_pages(file_path: str, filename: str) -> str:
    """
    Extract text preserving page numbers.
    Each page is prefixed with [PAGE X]. Non-PDF formats use [PAGE 1].
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found at path: {file_path}")

    row_chunks = parse_row_chunks(file_path, filename)
    if row_chunks:
        return f"[PAGE 1]\n" + "\n".join(row_chunks)

    ext = Path(file_path).suffix.lower() or os.path.splitext(filename.lower())[1]

    try:
        if ext == ".pdf":
            return _extract_pdf_text(file_path, filename)

        if ext == ".docx":
            import docx

            doc = docx.Document(file_path)
            paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
            body = "\n".join(paragraphs)
            return f"[PAGE 1]\n{body}"

        with open(file_path, "r", encoding="utf-8", errors="ignore") as handle:
            body = handle.read()
        return f"[PAGE 1]\n{body}"

    except Exception as exc:
        raise ValueError(f"Error parsing file '{filename}': {exc}") from exc


def extract_text(file_path: str, filename: str) -> str:
    """Extract plain text with page markers for RAG indexing."""
    return extract_text_with_pages(file_path, filename)
