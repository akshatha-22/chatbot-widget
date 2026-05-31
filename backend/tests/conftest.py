"""Shared fixtures for backend API tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database.db import Base, get_db
from app.main import app

# In-memory SQLite — isolated per test, no files on disk.
TEST_DATABASE_URL = "sqlite://"


@pytest.fixture()
def db_engine():
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture()
def db_session(db_engine):
    Session = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def patch_background_db_session(db_engine, monkeypatch):
    """Background file tasks must use the same DB as the TestClient override."""
    bg_session = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    monkeypatch.setattr("app.api.v1.files.SessionLocal", bg_session)


@pytest.fixture(autouse=True)
def inline_file_processing(monkeypatch):
    """Run file embedding synchronously in API tests."""
    monkeypatch.setenv("INLINE_FILE_PROCESSING", "1")


@pytest.fixture(autouse=True)
def disable_external_llm_keys(monkeypatch):
    """Keep chat tests deterministic — use local fallback, no live API calls."""
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "")


@pytest.fixture()
def auth_headers(client):
    """Register a user and return Authorization headers for protected routes."""
    email = "tester@example.com"
    password = "secret123"

    signup = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": password},
    )
    assert signup.status_code == 201, signup.text

    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]

    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def conversation_id(client, auth_headers):
    """Create a conversation and return its id."""
    response = client.post(
        "/api/v1/chat/conversations",
        headers=auth_headers,
        json={"title": "Test conversation"},
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


@pytest.fixture()
def make_auth_headers(client):
    """Factory: sign up + log in any email; return Authorization headers."""

    def _make(email: str, password: str = "password1") -> dict[str, str]:
        signup = client.post(
            "/api/v1/auth/signup",
            json={"email": email, "password": password},
        )
        assert signup.status_code == 201, signup.text
        login = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _make


@pytest.fixture()
def upload_dir(tmp_path, monkeypatch):
    """Point uploads at a temp directory for the test run."""
    upload_path = tmp_path / "uploads"
    upload_path.mkdir()
    monkeypatch.setattr("app.api.v1.files.UPLOAD_DIR", str(upload_path))
    return upload_path
