"""Tests for security headers, MIME validation, and Gemini quota."""

import io

from app.config import settings


def test_security_headers_on_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "camera=()" in response.headers.get("Permissions-Policy", "")
    assert response.headers.get("X-XSS-Protection") == "0"


def test_upload_rejects_unsupported_mime(client, auth_headers, conversation_id, upload_dir):
    response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/files",
        headers=auth_headers,
        files={
            "file": (
                "evil.exe",
                io.BytesIO(b"MZ fake binary"),
                "application/x-msdownload",
            )
        },
    )
    assert response.status_code == 415


def test_upload_rejects_mismatched_extension(client, auth_headers, conversation_id, upload_dir):
    response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/files",
        headers=auth_headers,
        files={
            "file": (
                "notes.pdf",
                io.BytesIO(b"%PDF-1.4 fake"),
                "text/plain",
            )
        },
    )
    assert response.status_code == 415


def test_gemini_daily_quota_returns_429(client, auth_headers, conversation_id, monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-gemini-key")
    monkeypatch.setattr(settings, "GEMINI_DAILY_QUOTA_PER_USER", 1)
    monkeypatch.setattr(
        "app.services.chat_service._call_gemini",
        lambda *args, **kwargs: ("ok", None, None),
    )
    monkeypatch.setattr(
        "app.services.chat_service._stream_gemini",
        lambda *args, **kwargs: iter(["ok"]),
    )

    first = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={"content": "Hello quota test"},
    )
    assert first.status_code == 200, first.text

    second = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={"content": "Second message should be blocked"},
    )
    assert second.status_code == 429
    body = second.json()
    assert "retry_after_seconds" in body["detail"]
    assert "reset_at" in body["detail"]
    assert int(second.headers.get("Retry-After", "0")) > 0


def test_upload_rejects_magic_byte_mismatch(client, auth_headers, conversation_id, upload_dir):
    response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/files",
        headers=auth_headers,
        files={
            "file": (
                "report.pdf",
                io.BytesIO(b"this is not a real pdf file"),
                "application/pdf",
            )
        },
    )
    assert response.status_code == 415
    assert response.json()["detail"] == "File type mismatch — content does not match extension"
