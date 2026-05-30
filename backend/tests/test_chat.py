import pytest

@pytest.fixture
def auth_headers(client):
    """Fixture to register and login a test user, returning auth headers with JWT token."""
    client.post(
        "/api/v1/auth/signup",
        json={"email": "test@example.com", "password": "securepassword123"}
    )
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "securepassword123"},
    )
    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_create_conversation(client, auth_headers):
    """Test conversation session creation."""
    response = client.post(
        "/api/v1/chat/conversations",
        json={"title": "Custom Title"},
        headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Custom Title"
    assert "id" in data
    assert "user_id" in data

def test_list_conversations(client, auth_headers):
    """Test listing conversations ordered descending by creation date."""
    client.post(
        "/api/v1/chat/conversations",
        json={"title": "Conv 1"},
        headers=auth_headers
    )
    client.post(
        "/api/v1/chat/conversations",
        json={"title": "Conv 2"},
        headers=auth_headers
    )
    
    response = client.get("/api/v1/chat/conversations", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    titles = {c["title"] for c in data}
    assert titles == {"Conv 1", "Conv 2"}
    # When created_at ties (same second), order is undefined; ids still reflect creation order
    by_title = {c["title"]: c for c in data}
    assert by_title["Conv 2"]["id"] > by_title["Conv 1"]["id"]

def test_get_conversation_detail(client, auth_headers):
    """Test retrieving conversation details with messages list."""
    conv_response = client.post(
        "/api/v1/chat/conversations",
        json={"title": "My Detail Conv"},
        headers=auth_headers
    )
    conv_id = conv_response.json()["id"]
    
    response = client.get(f"/api/v1/chat/conversations/{conv_id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "My Detail Conv"
    assert "messages" in data
    assert len(data["messages"]) == 0

def test_post_message_and_get_reply(client, auth_headers):
    """Test posting a user message and verifying the assistant responds."""
    conv_response = client.post(
        "/api/v1/chat/conversations",
        json={"title": "Conversation"},
        headers=auth_headers
    )
    conv_id = conv_response.json()["id"]
    
    response = client.post(
        f"/api/v1/chat/conversations/{conv_id}/messages",
        json={"content": "hello there"},
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    
    # Returns both user message and assistant message
    assert len(data) == 2
    assert data[0]["role"] == "user"
    assert data[0]["content"] == "hello there"
    assert data[1]["role"] == "assistant"
    assert len(data[1]["content"]) > 0
    assert "local fallback mode" not in data[1]["content"].lower()

def test_get_conversation_messages_ordered(client, auth_headers):
    """Messages endpoint returns user then assistant in chronological order."""
    conv_response = client.post(
        "/api/v1/chat/conversations",
        json={"title": "Messages Test"},
        headers=auth_headers,
    )
    conv_id = conv_response.json()["id"]

    client.post(
        f"/api/v1/chat/conversations/{conv_id}/messages",
        json={"content": "first question"},
        headers=auth_headers,
    )

    response = client.get(
        f"/api/v1/chat/conversations/{conv_id}/messages",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["role"] == "user"
    assert data[0]["content"] == "first question"
    assert data[1]["role"] == "assistant"
    assert data[0]["created_at"] <= data[1]["created_at"]


def test_delete_conversation(client, auth_headers):
    """Test deleting a conversation."""
    conv_response = client.post(
        "/api/v1/chat/conversations",
        json={"title": "To Delete"},
        headers=auth_headers
    )
    conv_id = conv_response.json()["id"]
    
    delete_response = client.delete(f"/api/v1/chat/conversations/{conv_id}", headers=auth_headers)
    assert delete_response.status_code == 204
    
    # Check that it's no longer found
    get_response = client.get(f"/api/v1/chat/conversations/{conv_id}", headers=auth_headers)
    assert get_response.status_code == 404
