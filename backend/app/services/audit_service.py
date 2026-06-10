"""Best-effort audit logging — failures must never break the main request."""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.database.db import SessionLocal
from app.schemas.audit_log import AuditAction, AuditLog

logger = logging.getLogger(__name__)


async def log_action(
    db: Session,
    user_id: Optional[int],
    action: AuditAction,
    resource_type: Optional[str],
    resource_id: Optional[str],
    ip: Optional[str],
) -> None:
    """Persist one audit event. Swallows all errors."""
    try:
        audit_db = SessionLocal()
    except Exception as exc:
        logger.warning("Audit log session failed for action=%s: %s", action.value, exc)
        return

    try:
        entry = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            ip_address=ip,
        )
        audit_db.add(entry)
        audit_db.commit()
    except Exception as exc:
        try:
            audit_db.rollback()
        except Exception:
            pass
        logger.warning("Audit log failed for action=%s: %s", action.value, exc)
    finally:
        audit_db.close()
