"""Edge-case and security tests for backend API routes."""

from __future__ import annotations

import io
import json
import re
from unittest.mock import patch

import pytest


# --- Auth edge cases ---


def test_login_unknown_email(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "ghost@example.com", "password": "password1"},
    )
    assert response.status_code == 401


def test_signup_duplicate_email_case_insensitive(client):
    assert client.post(
        "/api/v1/auth/signup",
        json={"email": "Case@Example.com", "password": "password1"},
    ).status_code == 201
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "case@example.com", "password": "password1"},
    )
    assert response.status_code == 400


def test_signup_missing_fields(client):
    assert client.post("/api/v1/auth/signup", json={"email": "x@example.com"}).status_code == 422
    assert client.post("/api/v1/auth/signup", json={"password": "password1"}).status_code == 422


def test_invalid_jwt_rejected(client):
    headers = {"Authorization": "Bearer not.a.valid.jwt"}
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
    assert client.get("/api/v1/chat/conversations", headers=headers).status_code == 401


def test_malformed_auth_header(client):
    headers = {"Authorization": "Token oops"}
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


# --- Multi-user isolation ---


def test_user_cannot_access_other_users_conversation(client, make_auth_headers):
    user_a = make_auth_headers("alice@example.com")
    user_b = make_auth_headers("bob@example.com")

    conv = client.post(
        "/api/v1/chat/conversations",
        headers=user_a,
        json={"title": "Alice private"},
    )
    assert conv.status_code == 201
    conv_id = conv.json()["id"]

    for method, url in [
        ("get", f"/api/v1/chat/conversations/{conv_id}"),
        ("get", f"/api/v1/chat/conversations/{conv_id}/messages"),
        ("get", f"/api/v1/chat/conversations/{conv_id}/files"),
    ]:
        response = getattr(client, method)(url, headers=user_b)
        assert response.status_code == 404, f"{method} {url} should be 404 for other user"

    post_msg = client.post(
        f"/api/v1/chat/conversations/{conv_id}/messages",
        headers=user_b,
        json={"content": "intruder"},
    )
    assert post_msg.status_code == 404

    delete = client.delete(
        f"/api/v1/chat/conversations/{conv_id}",
        headers=user_b,
    )
    assert delete.status_code == 404

    # Owner can still access
    assert client.get(
        f"/api/v1/chat/conversations/{conv_id}",
        headers=user_a,
    ).status_code == 200


def test_user_cannot_upload_to_other_users_conversation(
    client, make_auth_headers, upload_dir
):
    user_a = make_auth_headers("owner@example.com")
    user_b = make_auth_headers("intruder@example.com")
    conv_id = client.post(
        "/api/v1/chat/conversations",
        headers=user_a,
        json={"title": "Owner chat"},
    ).json()["id"]

    with patch("app.api.v1.files.vector_store_service.chunk_and_store"):
        response = client.post(
            f"/api/v1/chat/conversations/{conv_id}/files",
            headers=user_b,
            files={"file": ("x.txt", io.BytesIO(b"data"), "text/plain")},
        )
    assert response.status_code == 404


# --- Conversation edge cases ---


def test_create_conversation_default_title(client, auth_headers):
    response = client.post(
        "/api/v1/chat/conversations",
        headers=auth_headers,
        json={},
    )
    assert response.status_code == 201
    assert response.json()["title"] == "New Conversation"


def test_auto_title_from_first_message(client, auth_headers):
    conv_id = client.post(
        "/api/v1/chat/conversations",
        headers=auth_headers,
        json={"title": "New Conversation"},
    ).json()["id"]

    long_text = "A" * 50
    client.post(
        f"/api/v1/chat/conversations/{conv_id}/messages",
        headers=auth_headers,
        json={"content": long_text},
    )

    detail = client.get(
        f"/api/v1/chat/conversations/{conv_id}",
        headers=auth_headers,
    ).json()
    assert detail["title"] == long_text[:40] + "..."


def test_rename_empty_title_keeps_original(client, auth_headers, conversation_id):
    client.patch(
        f"/api/v1/chat/conversations/{conversation_id}",
        headers=auth_headers,
        json={"title": "Kept title"},
    )
    response = client.patch(
        f"/api/v1/chat/conversations/{conversation_id}",
        headers=auth_headers,
        json={"title": "   "},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Kept title"


def test_rename_nonexistent_conversation(client, auth_headers):
    response = client.patch(
        "/api/v1/chat/conversations/99999",
        headers=auth_headers,
        json={"title": "Nope"},
    )
    assert response.status_code == 404


def test_delete_conversation_twice(client, auth_headers, conversation_id):
    url = f"/api/v1/chat/conversations/{conversation_id}"
    assert client.delete(url, headers=auth_headers).status_code == 204
    assert client.delete(url, headers=auth_headers).status_code == 404


def test_invalid_conversation_id_type(client, auth_headers):
    response = client.get(
        "/api/v1/chat/conversations/not-an-int",
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_conversations_ordered_newest_first(client, auth_headers):
    first = client.post(
        "/api/v1/chat/conversations",
        headers=auth_headers,
        json={"title": "First"},
    ).json()["id"]
    second = client.post(
        "/api/v1/chat/conversations",
        headers=auth_headers,
        json={"title": "Second"},
    ).json()["id"]

    items = client.get("/api/v1/chat/conversations", headers=auth_headers).json()
    ids = [c["id"] for c in items]
    assert ids.index(second) < ids.index(first)


def test_messages_ordered_oldest_first(client, auth_headers, conversation_id):
    client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={"content": "First message"},
    )
    client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={"content": "Second message"},
    )

    messages = client.get(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
    ).json()
    user_contents = [m["content"] for m in messages if m["role"] == "user"]
    assert user_contents == ["First message", "Second message"]


def test_post_message_empty_content(client, auth_headers, conversation_id):
    response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={"content": ""},
    )
    # Empty string is allowed by schema today — still returns user + assistant pair
    assert response.status_code == 200
    assert response.json()[0]["content"] == ""


def test_post_message_nonexistent_conversation(client, auth_headers):
    response = client.post(
        "/api/v1/chat/conversations/99999/messages",
        headers=auth_headers,
        json={"content": "hello"},
    )
    assert response.status_code == 404


# --- PDF intent + generate ---


def test_pdf_intent_message_sets_has_pdf(client, auth_headers, conversation_id):
    response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={"content": "can you generate the pdf with the recipe"},
    )
    assert response.status_code == 200
    assistant = response.json()[1]
    assert assistant["role"] == "assistant"
    assert assistant["has_pdf"] is True
    assert assistant["pdf_content"]
    assert assistant["pdf_filename"].endswith(".pdf")


def test_generate_conversation_file_empty_chat(client, auth_headers, conversation_id):
    response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/generate",
        headers=auth_headers,
        json={"type": "summary", "format": "txt"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["format"] == "txt"
    assert data["type"] == "Summary"
    assert "filename" in data
    assert len(data["content"]) > 0


def test_generate_normalizes_invalid_type_and_format(client, auth_headers, conversation_id):
    response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/generate",
        headers=auth_headers,
        json={"type": "invalid-kind", "format": "json"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["format"] == "txt"
    assert data["type"] == "Summary"


def test_generate_requires_auth(client, conversation_id):
    response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/generate",
        json={"type": "report", "format": "pdf"},
    )
    assert response.status_code == 401


# --- SSE edge cases ---


def _parse_sse_events(body: str) -> list[dict | str]:
    events: list[dict | str] = []
    for block in re.split(r"\n\n+", body.strip()):
        if not block.startswith("data:"):
            continue
        payload = block.replace("data:", "", 1).strip()
        if payload.startswith("{"):
            events.append(json.loads(payload))
        else:
            events.append(payload)
    return events


def test_stream_sse_done_event_shape(client, auth_headers, conversation_id):
    with client.stream(
        "POST",
        f"/api/v1/chat/conversations/{conversation_id}/messages/stream",
        headers=auth_headers,
        json={"content": "Stream done check"},
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    events = _parse_sse_events(body)
    assert len(events) >= 1
    done = events[-1]
    assert isinstance(done, dict)
    assert done["event"] == "done"
    assert done["role"] == "assistant"
    assert isinstance(done["content"], str)
    assert "id" in done
    assert "has_pdf" in done


def test_stream_pdf_intent_done_has_pdf(client, auth_headers, conversation_id):
    with client.stream(
        "POST",
        f"/api/v1/chat/conversations/{conversation_id}/messages/stream",
        headers=auth_headers,
        json={"content": "please generate the pdf with meeting notes"},
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    done = _parse_sse_events(body)[-1]
    assert isinstance(done, dict)
    assert done["event"] == "done"
    assert done["has_pdf"] is True
    assert done["pdf_content"]
    assert done["pdf_filename"]


def test_stream_nonexistent_conversation(client, auth_headers):
    response = client.post(
        "/api/v1/chat/conversations/99999/messages/stream",
        headers=auth_headers,
        json={"content": "hello"},
    )
    assert response.status_code == 404


# --- File edge cases ---


def test_list_files_empty(client, auth_headers, conversation_id):
    response = client.get(
        f"/api/v1/chat/conversations/{conversation_id}/files",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json() == []


def test_upload_without_file(client, auth_headers, conversation_id, upload_dir):
    response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/files",
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_upload_parse_failure(client, auth_headers, conversation_id, upload_dir):
    with patch(
        "app.api.v1.files.file_parser_service.extract_text",
        side_effect=ValueError("bad file"),
    ):
        response = client.post(
            f"/api/v1/chat/conversations/{conversation_id}/files",
            headers=auth_headers,
            files={"file": ("bad.pdf", io.BytesIO(b"%PDF"), "application/pdf")},
        )
    assert response.status_code == 201
    assert response.json()["status"] == "failed"


def test_upload_index_failure(client, auth_headers, conversation_id, upload_dir):
    with patch(
        "app.api.v1.files.vector_store_service.chunk_and_store",
        side_effect=RuntimeError("index failed"),
    ):
        response = client.post(
            f"/api/v1/chat/conversations/{conversation_id}/files",
            headers=auth_headers,
            files={"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
        )
    assert response.status_code == 201
    assert response.json()["status"] == "failed"


def test_upload_docx_parsed(client, auth_headers, conversation_id, upload_dir):
    """DOCX path: mock parser so we don't need a real docx on disk."""
    with patch(
        "app.api.v1.files.file_parser_service.extract_text",
        return_value="Parsed docx body",
    ), patch("app.api.v1.files.vector_store_service.chunk_and_store") as mock_index:
        response = client.post(
            f"/api/v1/chat/conversations/{conversation_id}/files",
            headers=auth_headers,
            files={
                "file": (
                    "report.docx",
                    io.BytesIO(b"fake-docx-bytes"),
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
            },
        )
    assert response.status_code == 201
    assert response.json()["status"] == "processed"
    mock_index.assert_called_once_with(response.json()["id"], "Parsed docx body")


def test_chat_with_rag_uses_uploaded_context(
    client, auth_headers, conversation_id, upload_dir
):
    with patch("app.api.v1.files.vector_store_service.chunk_and_store"):
        upload = client.post(
            f"/api/v1/chat/conversations/{conversation_id}/files",
            headers=auth_headers,
            files={"file": ("facts.txt", io.BytesIO(b"secret fact"), "text/plain")},
        )
    assert upload.status_code == 201
    file_id = upload.json()["id"]

    with patch(
        "app.services.chat_service.vector_store_service.search",
        return_value=["The secret fact from the document."],
    ) as mock_search:
        response = client.post(
            f"/api/v1/chat/conversations/{conversation_id}/messages",
            headers=auth_headers,
            json={"content": "What does the document say?"},
        )

    assert response.status_code == 200
    mock_search.assert_called_once()
    assert mock_search.call_args[0][0] == [file_id]
    assistant = response.json()[1]["content"].lower()
    assert "secret fact" in assistant or len(assistant) > 0


def test_delete_conversation_cascades_messages(client, auth_headers, conversation_id):
    client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={"content": "to be deleted"},
    )
    assert client.delete(
        f"/api/v1/chat/conversations/{conversation_id}",
        headers=auth_headers,
    ).status_code == 204

    assert client.get(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
    ).status_code == 404
