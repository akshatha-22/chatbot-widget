"""Unit tests for audit logging."""

import pytest

from app.schemas.audit_log import AuditAction, AuditLog
from app.services import audit_service


@pytest.mark.asyncio
async def test_log_action_persists_entry(db_engine, monkeypatch):
    Session = __import__("sqlalchemy.orm", fromlist=["sessionmaker"]).sessionmaker(
        autocommit=False, autoflush=False, bind=db_engine
    )

    def session_factory():
        return Session()

    monkeypatch.setattr("app.services.audit_service.SessionLocal", session_factory)

    await audit_service.log_action(
        Session(),
        user_id=42,
        action=AuditAction.login,
        resource_type="user",
        resource_id="42",
        ip="203.0.113.1",
    )

    verify = Session()
    row = verify.query(AuditLog).first()
    verify.close()
    assert row is not None
    assert row.user_id == 42
    assert row.action == AuditAction.login
    assert row.ip_address == "203.0.113.1"


@pytest.mark.asyncio
async def test_log_action_swallows_db_errors(db_session, monkeypatch):
    def broken_session_factory():
        raise RuntimeError("db unavailable")

    monkeypatch.setattr("app.services.audit_service.SessionLocal", broken_session_factory)

    await audit_service.log_action(
        db_session,
        user_id=1,
        action=AuditAction.message,
        resource_type="conversation",
        resource_id="1",
        ip="127.0.0.1",
    )
