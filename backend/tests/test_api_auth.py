"""Tests for /api/v1/auth routes."""


def test_signup_success(client):
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "newuser@example.com", "password": "password1"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["is_active"] is True
    assert "id" in data
    assert "created_at" in data


def test_signup_duplicate_email(client):
    payload = {"email": "dup@example.com", "password": "password1"}
    assert client.post("/api/v1/auth/signup", json=payload).status_code == 201
    response = client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"].lower()


def test_signup_invalid_email(client):
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "not-an-email", "password": "password1"},
    )
    assert response.status_code == 422


def test_signup_short_password(client):
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "short@example.com", "password": "12345"},
    )
    assert response.status_code == 422


def test_login_success(client):
    client.post(
        "/api/v1/auth/signup",
        json={"email": "login@example.com", "password": "password1"},
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "login@example.com", "password": "password1"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert isinstance(data["access_token"], str)
    assert len(data["access_token"]) > 0


def test_login_wrong_password(client):
    client.post(
        "/api/v1/auth/signup",
        json={"email": "wrongpw@example.com", "password": "password1"},
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "wrongpw@example.com", "password": "bad-password"},
    )
    assert response.status_code == 401


def test_me_requires_auth(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_me_returns_profile(client, auth_headers):
    response = client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "tester@example.com"
    assert data["is_active"] is True
