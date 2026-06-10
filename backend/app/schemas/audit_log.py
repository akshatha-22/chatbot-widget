"""Audit log model and action enum."""

from __future__ import annotations

import datetime
import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String

from app.database.db import Base


class AuditAction(str, enum.Enum):
    upload = "upload"
    message = "message"
    generate = "generate"
    export = "export"
    login = "login"
    delete = "delete"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(Enum(AuditAction, native_enum=False), nullable=False)
    resource_type = Column(String(100), nullable=True)
    resource_id = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)
