def test_signup(client):
    """Test standard user sign up."""
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "test@example.com", "password": "securepassword123"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data
    assert data["is_active"] is True

def test_signup_duplicate_email(client):
    """Test duplicate email sign up rejection."""
    client.post(
        "/api/v1/auth/signup",
        json={"email": "test@example.com", "password": "securepassword123"}
    )
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "test@example.com", "password": "differentpwd456"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "A user with this email already exists."

def test_login_normalized_email_matching_signup_case(client):
    """Login should succeed when email casing differs from stored (lowercased at signup)."""
    client.post(
        "/api/v1/auth/signup",
        json={"email": "User@Example.com", "password": "securepassword123"},
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "User@Example.COM", "password": "securepassword123"},
    )
    assert response.status_code == 200


def test_login(client):
    """Test successful user login."""
    client.post(
        "/api/v1/auth/signup",
        json={"email": "test@example.com", "password": "securepassword123"}
    )
    
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "securepassword123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_invalid_credentials(client):
    """Test login rejection for incorrect credentials."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@example.com", "password": "password"},
    )
    assert response.status_code == 401

def test_get_me(client):
    """Test retrieving authenticated user profile."""
    client.post(
        "/api/v1/auth/signup",
        json={"email": "test@example.com", "password": "securepassword123"}
    )
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "securepassword123"},
    )
    token = login_response.json()["access_token"]
    
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"

def test_get_me_unauthorized(client):
    """Test profile retrieval rejection when no authentication token is provided."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
