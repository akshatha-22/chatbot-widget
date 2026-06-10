"""Admin diagnostics endpoints (JWT-authenticated)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.database.db import Conversation, UploadedFile, User, get_db
from app.services import auth_service, vector_store_service
from pydantic import BaseModel

router = APIRouter(prefix="/admin", tags=["Admin"])


class FaissHealthItem(BaseModel):
    file_id: str
    filename: str
    embedding_model_version: str | None
    stale: bool


@router.get("/faiss-health", response_model=List[FaissHealthItem])
def faiss_health(
    current_user: User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db),
):
    """List FAISS index versions for the current user's files only."""
    current_version = vector_store_service.get_current_embedding_model_version()
    rows = (
        db.query(UploadedFile)
        .join(Conversation, UploadedFile.conversation_id == Conversation.id)
        .filter(Conversation.user_id == current_user.id)
        .order_by(UploadedFile.created_at.desc())
        .all()
    )
    return [
        FaissHealthItem(
            file_id=row.id,
            filename=row.filename,
            embedding_model_version=row.embedding_model_version,
            stale=row.embedding_model_version != current_version,
        )
        for row in rows
    ]
