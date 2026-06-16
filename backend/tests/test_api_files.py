"""Tests for /api/v1/chat/conversations/{id}/files routes."""

import io
from unittest.mock import patch


def test_upload_and_list_file(client, auth_headers, conversation_id, upload_dir):
    with patch("app.api.v1.files.vector_store_service.chunk_and_store") as mock_index:
        mock_index.return_value = True

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


def test_delete_uploaded_file(client, auth_headers, conversation_id, upload_dir):
    with patch("app.api.v1.files.vector_store_service.chunk_and_store"):
        upload = client.post(
            f"/api/v1/chat/conversations/{conversation_id}/files",
            headers=auth_headers,
            files={"file": ("notes.txt", io.BytesIO(b"delete me"), "text/plain")},
        )
    assert upload.status_code == 201
    file_id = upload.json()["id"]

    delete = client.delete(
        f"/api/v1/chat/conversations/{conversation_id}/files/{file_id}",
        headers=auth_headers,
    )
    assert delete.status_code == 204

    listed = client.get(
        f"/api/v1/chat/conversations/{conversation_id}/files",
        headers=auth_headers,
    )
    assert listed.json() == []

    remaining = list(upload_dir.glob("*"))
    assert remaining == []


def test_delete_file_invokes_embedding_cleanup(
    client, auth_headers, conversation_id, upload_dir, monkeypatch
):
    from app.services import vector_store_service

    deleted_ids: list[str] = []

    def _track_delete(file_id: str, db=None):
        deleted_ids.append(file_id)

    monkeypatch.setattr(vector_store_service, "delete_file_data", _track_delete)

    with patch("app.api.v1.files.vector_store_service.chunk_and_store", return_value=True):
        upload = client.post(
            f"/api/v1/chat/conversations/{conversation_id}/files",
            headers=auth_headers,
            files={"file": ("notes.txt", io.BytesIO(b"cache me"), "text/plain")},
        )
    file_id = upload.json()["id"]

    delete = client.delete(
        f"/api/v1/chat/conversations/{conversation_id}/files/{file_id}",
        headers=auth_headers,
    )
    assert delete.status_code == 204
    assert deleted_ids == [file_id]


def test_delete_file_not_found(client, auth_headers, conversation_id):
    response = client.delete(
        f"/api/v1/chat/conversations/{conversation_id}/files/nonexistent-id",
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_delete_file_requires_auth(client, conversation_id):
    response = client.delete(
        f"/api/v1/chat/conversations/{conversation_id}/files/some-id",
    )
    assert response.status_code == 401


def test_delete_file_isolated_between_users(client, make_auth_headers, upload_dir):
    owner_headers = make_auth_headers("owner@example.com")
    intruder_headers = make_auth_headers("intruder@example.com")

    conv_id = client.post(
        "/api/v1/chat/conversations",
        headers=owner_headers,
        json={"title": "Owner conv"},
    ).json()["id"]

    with patch("app.api.v1.files.vector_store_service.chunk_and_store"):
        upload = client.post(
            f"/api/v1/chat/conversations/{conv_id}/files",
            headers=owner_headers,
            files={"file": ("secret.txt", io.BytesIO(b"secret"), "text/plain")},
        )
    file_id = upload.json()["id"]

    response = client.delete(
        f"/api/v1/chat/conversations/{conv_id}/files/{file_id}",
        headers=intruder_headers,
    )
    assert response.status_code == 403
