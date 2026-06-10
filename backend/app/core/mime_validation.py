"""MIME type validation for uploaded files."""

from __future__ import annotations

import os
from typing import Optional

from fastapi import HTTPException, status

# Declared MIME → allowed filename extensions (lowercase, with dot).
ALLOWED_UPLOAD_MIME_TYPES: dict[str, set[str]] = {
    "application/pdf": {".pdf"},
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {".docx"},
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {".xlsx"},
    "application/vnd.ms-excel": {".xls"},
    "text/plain": {".txt", ".md", ".csv", ".log", ".json"},
    "text/markdown": {".md"},
    "text/csv": {".csv"},
}

# Extension-only fallback when browsers send application/octet-stream.
_EXTENSION_FALLBACK_MIME: dict[str, str] = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
    ".log": "text/plain",
    ".json": "text/plain",
}

_MAGIC_VALIDATED_MIMES: frozenset[str] = frozenset(
    {
        "application/pdf",
        "text/plain",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/markdown",
    }
)

_MAGIC_SAMPLE_SIZE = 512


def _normalize_mime(content_type: Optional[str]) -> str:
    if not content_type:
        return ""
    return content_type.split(";")[0].strip().lower()


def _extension_for(filename: str) -> str:
    return os.path.splitext(filename or "")[1].lower()


def _detect_mime_with_python_magic(header: bytes) -> Optional[str]:
    try:
        import magic

        detected = magic.from_buffer(header, mime=True)
        return _normalize_mime(detected) if detected else None
    except Exception:
        return None


def _looks_like_text(header: bytes) -> bool:
    if not header:
        return True
    try:
        header.decode("utf-8")
        return True
    except UnicodeDecodeError:
        printable = sum(1 for b in header if 32 <= b <= 126 or b in (9, 10, 13))
        return printable / len(header) >= 0.85


def _detect_mime_from_magic_bytes(header: bytes) -> Optional[str]:
    if header.startswith(b"%PDF"):
        return "application/pdf"
    if header.startswith(b"PK\x03\x04"):
        lower = header.lower()
        if b"word/" in lower or b"[content_types].xml" in lower:
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        if b"xl/" in lower or b"worksheets/" in lower:
            return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        return None
    if _looks_like_text(header):
        return "text/plain"
    return None


def detect_content_mime(header: bytes) -> Optional[str]:
    """Detect MIME type from the first bytes of a file."""
    sample = header[:_MAGIC_SAMPLE_SIZE]
    if not sample:
        return None
    detected = _detect_mime_with_python_magic(sample)
    if detected:
        return detected
    return _detect_mime_from_magic_bytes(sample)


def _magic_matches_declared_mime(
    declared_mime: str,
    detected_mime: Optional[str],
    file_header: bytes,
    ext: str,
) -> bool:
    if declared_mime == detected_mime:
        return True
    if declared_mime == "text/markdown" and detected_mime == "text/plain":
        return True
    if declared_mime == "text/plain" and detected_mime == "text/markdown":
        return True

    header = file_header[:_MAGIC_SAMPLE_SIZE]
    if header.startswith(b"PK\x03\x04"):
        if (
            declared_mime
            == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            and ext == ".docx"
        ):
            return True
        if (
            declared_mime
            == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            and ext == ".xlsx"
        ):
            return True

    if not detected_mime:
        return False

    if declared_mime in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ) and detected_mime in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/zip",
    ):
        return True
    return False


def validate_upload_mime(
    content_type: Optional[str],
    filename: str,
    file_header: Optional[bytes] = None,
) -> str:
    """
    Validate upload Content-Type against filename extension and optional magic bytes.
    Returns the resolved canonical MIME type.
    """
    ext = _extension_for(filename)
    if not ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename must include a supported extension.",
        )

    mime = _normalize_mime(content_type)
    if mime in ("", "application/octet-stream"):
        mime = _EXTENSION_FALLBACK_MIME.get(ext, mime)

    if mime not in ALLOWED_UPLOAD_MIME_TYPES:
        allowed = ", ".join(sorted(ALLOWED_UPLOAD_MIME_TYPES))
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{mime or 'unknown'}'. Allowed MIME types: {allowed}",
        )

    allowed_exts = ALLOWED_UPLOAD_MIME_TYPES[mime]
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"File extension '{ext}' does not match Content-Type '{mime}'. "
                f"Expected one of: {', '.join(sorted(allowed_exts))}"
            ),
        )

    if mime in _MAGIC_VALIDATED_MIMES and file_header is not None:
        sample = file_header[:_MAGIC_SAMPLE_SIZE]
        detected = detect_content_mime(sample)
        if not _magic_matches_declared_mime(mime, detected, sample, ext):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="File type mismatch — content does not match extension",
            )

    return mime
