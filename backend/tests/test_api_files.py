"""Tests for /api/v1/chat/conversations/{id}/files routes."""

import io
from unittest.mock import patch


def test_upload_and_list_file(client, auth_headers, conversation_id, upload_dir):
    with patch("app.api.v1.files.vector_store_service.chunk_and_store") as mock_index:
        mock_index.return_value = None

        response = client.post(
            f"/api/v1/chat/conversations/{conversation_id}/files",
            headers=auth_headers,
            files={"file": ("notes.txt", io.BytesIO(b"Hello from uploaded file."), "text/plain")},
        )

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["filename"] == "notes.txt"
    assert data["status"] == "processed"
    assert data["conversation_id"] == conversation_id
    mock_index.assert_called_once()

    listed = client.get(
        f"/api/v1/chat/conversations/{conversation_id}/files",
        headers=auth_headers,
    )
    assert listed.status_code == 200
    files = listed.json()
    assert len(files) == 1
    assert files[0]["id"] == data["id"]
    assert files[0]["status"] == "processed"


def test_upload_requires_auth(client, conversation_id):
    response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/files",
        files={"file": ("x.txt", io.BytesIO(b"data"), "text/plain")},
    )
    assert response.status_code == 401


def test_upload_unknown_conversation(client, auth_headers, upload_dir):
    with patch("app.api.v1.files.vector_store_service.chunk_and_store"):
        response = client.post(
            "/api/v1/chat/conversations/99999/files",
            headers=auth_headers,
            files={"file": ("x.txt", io.BytesIO(b"data"), "text/plain")},
        )
    assert response.status_code == 404
