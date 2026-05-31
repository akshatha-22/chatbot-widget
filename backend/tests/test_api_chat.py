"""Tests for /api/v1/chat routes."""


def test_create_conversation(client, auth_headers):
    response = client.post(
        "/api/v1/chat/conversations",
        headers=auth_headers,
        json={"title": "My chat"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "My chat"
    assert "id" in data
    assert "user_id" in data


def test_list_conversations_empty(client, auth_headers):
    response = client.get("/api/v1/chat/conversations", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_list_conversations_after_create(client, auth_headers, conversation_id):
    response = client.get("/api/v1/chat/conversations", headers=auth_headers)
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 1
    assert items[0]["id"] == conversation_id


def test_get_conversation_detail(client, auth_headers, conversation_id):
    response = client.get(
        f"/api/v1/chat/conversations/{conversation_id}",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == conversation_id
    assert data["messages"] == []


def test_rename_conversation(client, auth_headers, conversation_id):
    response = client.patch(
        f"/api/v1/chat/conversations/{conversation_id}",
        headers=auth_headers,
        json={"title": "Renamed title"},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Renamed title"


def test_delete_conversation(client, auth_headers, conversation_id):
    response = client.delete(
        f"/api/v1/chat/conversations/{conversation_id}",
        headers=auth_headers,
    )
    assert response.status_code == 204

    gone = client.get(
        f"/api/v1/chat/conversations/{conversation_id}",
        headers=auth_headers,
    )
    assert gone.status_code == 404


def test_post_message_returns_user_and_assistant(client, auth_headers, conversation_id):
    response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={"content": "Hello Remi"},
    )
    assert response.status_code == 200
    messages = response.json()
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "Hello Remi"
    assert messages[1]["role"] == "assistant"
    assert len(messages[1]["content"]) > 0


def test_list_messages(client, auth_headers, conversation_id):
    client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={"content": "List me"},
    )
    response = client.get(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
    )
    assert response.status_code == 200
    messages = response.json()
    assert len(messages) == 2


def test_stream_message_sse(client, auth_headers, conversation_id):
    with client.stream(
        "POST",
        f"/api/v1/chat/conversations/{conversation_id}/messages/stream",
        headers=auth_headers,
        json={"content": "Stream hello"},
    ) as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")
        body = "".join(response.iter_text())
        assert "data:" in body


def test_chat_requires_auth(client):
    response = client.get("/api/v1/chat/conversations")
    assert response.status_code == 401


def test_conversation_not_found(client, auth_headers):
    response = client.get(
        "/api/v1/chat/conversations/99999",
        headers=auth_headers,
    )
    assert response.status_code == 404
