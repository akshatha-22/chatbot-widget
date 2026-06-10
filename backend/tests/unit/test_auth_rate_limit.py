"""Unit tests for auth route rate limiting."""

import pytest
from fastapi import HTTPException

from app.config import settings
from app.services import auth_rate_limit_service


@pytest.fixture(autouse=True)
def _clear_limits():
    auth_rate_limit_service.clear_rate_limits()
    yield
    auth_rate_limit_service.clear_rate_limits()


def test_is_rate_limited_after_max_failed_attempts(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_MAX_ATTEMPTS", 3)
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_WINDOW_SECONDS", 60)

    for _ in range(3):
        auth_rate_limit_service.record_failed_attempt("login", "203.0.113.1")

    limited, retry_after = auth_rate_limit_service.is_rate_limited("login", "203.0.113.1")
    assert limited is True
    assert retry_after > 0


def test_reset_attempts_clears_lockout(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_MAX_ATTEMPTS", 2)

    auth_rate_limit_service.record_failed_attempt("login", "10.0.0.1")
    auth_rate_limit_service.record_failed_attempt("login", "10.0.0.1")
    auth_rate_limit_service.reset_attempts("login", "10.0.0.1")

    limited, _ = auth_rate_limit_service.is_rate_limited("login", "10.0.0.1")
    assert limited is False


def test_login_and_signup_scopes_are_independent(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_MAX_ATTEMPTS", 2)

    auth_rate_limit_service.record_failed_attempt("login", "203.0.113.9")
    auth_rate_limit_service.record_failed_attempt("login", "203.0.113.9")

    login_limited, _ = auth_rate_limit_service.is_rate_limited("login", "203.0.113.9")
    signup_limited, _ = auth_rate_limit_service.is_rate_limited("signup", "203.0.113.9")

    assert login_limited is True
    assert signup_limited is False


def test_raise_http_rate_limited_returns_429(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_MAX_ATTEMPTS", 1)

    auth_rate_limit_service.record_failed_attempt("signup", "198.51.100.2")

    with pytest.raises(HTTPException) as exc:
        auth_rate_limit_service.raise_http_rate_limited("signup", "198.51.100.2")

    assert exc.value.status_code == 429
    assert "retry_after_seconds" in exc.value.detail
