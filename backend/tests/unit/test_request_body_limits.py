"""Tests for per-route request body size limits."""

import io


def test_chat_message_body_limit_returns_413(client, auth_headers, conversation_id):
    oversized = "x" * (1024 * 1024 + 1)
    response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={"content": oversized},
    )
    assert response.status_code == 413
    assert response.json()["detail"] == "Request body too large"
