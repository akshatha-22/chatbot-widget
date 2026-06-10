"""Tests for FAISS health admin endpoint."""


def test_faiss_health_requires_auth(client):
    response = client.get("/api/v1/admin/faiss-health")
    assert response.status_code == 401


def test_faiss_health_lists_files(client, auth_headers, conversation_id, upload_dir):
    import io
    from unittest.mock import patch

    with patch("app.api.v1.files.vector_store_service.chunk_and_store"):
        client.post(
            f"/api/v1/chat/conversations/{conversation_id}/files",
            headers=auth_headers,
            files={"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
        )

    response = client.get("/api/v1/admin/faiss-health", headers=auth_headers)
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) >= 1
    assert "embedding_model_version" in payload[0]
    assert "stale" in payload[0]


def test_faiss_health_scoped_to_current_user(client, make_auth_headers, upload_dir):
    import io
    from unittest.mock import patch

    user_a = make_auth_headers("user-a@example.com")
    user_b = make_auth_headers("user-b@example.com")

    conv_a = client.post(
        "/api/v1/chat/conversations",
        headers=user_a,
        json={"title": "A"},
    ).json()["id"]
    conv_b = client.post(
        "/api/v1/chat/conversations",
        headers=user_b,
        json={"title": "B"},
    ).json()["id"]

    with patch("app.api.v1.files.vector_store_service.chunk_and_store"):
        client.post(
            f"/api/v1/chat/conversations/{conv_a}/files",
            headers=user_a,
            files={"file": ("a.txt", io.BytesIO(b"user a file"), "text/plain")},
        )
        client.post(
            f"/api/v1/chat/conversations/{conv_b}/files",
            headers=user_b,
            files={"file": ("b.txt", io.BytesIO(b"user b file"), "text/plain")},
        )

    health_a = client.get("/api/v1/admin/faiss-health", headers=user_a).json()
    health_b = client.get("/api/v1/admin/faiss-health", headers=user_b).json()

    assert len(health_a) == 1
    assert health_a[0]["filename"] == "a.txt"
    assert len(health_b) == 1
    assert health_b[0]["filename"] == "b.txt"
