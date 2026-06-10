"""Unit tests for MIME magic-byte validation."""

import pytest
from fastapi import HTTPException

from app.core.mime_validation import detect_content_mime, validate_upload_mime


def test_detect_content_mime_pdf():
    assert detect_content_mime(b"%PDF-1.4\n%fake") == "application/pdf"


def test_detect_content_mime_plain_text():
    assert detect_content_mime(b"Hello, plain text file.") == "text/plain"


def test_validate_upload_mime_rejects_magic_mismatch():
    header = b"plain text not a pdf"
    with pytest.raises(HTTPException) as exc:
        validate_upload_mime(
            "application/pdf",
            "notes.pdf",
            file_header=header,
        )
    assert exc.value.status_code == 415
    assert "content does not match extension" in exc.value.detail


def test_validate_upload_mime_accepts_matching_pdf():
    mime = validate_upload_mime(
        "application/pdf",
        "report.pdf",
        file_header=b"%PDF-1.4 fake pdf content",
    )
    assert mime == "application/pdf"
