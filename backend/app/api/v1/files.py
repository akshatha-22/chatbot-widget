import os
import shutil
from uuid import uuid4
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List

from app.database.db import SessionLocal, get_db, User, UploadedFile
from app.schemas.file import FileResponse
from app.services import auth_service, file_parser_service, vector_store_service

router = APIRouter(prefix="/chat/conversations", tags=["Files"])

# Save uploaded files under backend/data/uploads
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "uploads"))


def process_file_embedding(file_id: str, file_path: str, filename: str) -> None:
    """Parse, chunk, and index a file in the background (separate DB session)."""
    db = SessionLocal()
    try:
        extracted_text = file_parser_service.extract_text(file_path, filename)
        vector_store_service.chunk_and_store(file_id, extracted_text)
        db_file = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
        if db_file:
            db_file.status = "processed"
            db.commit()
    except Exception as e:
        print(f"Embedding failed for {file_id}: {e}")
        db_file = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
        if db_file:
            db_file.status = "failed"
            db.commit()
    finally:
        db.close()


@router.post("/{conversation_id}/files", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    conversation_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db),
):
    """Save file to disk and queue RAG indexing; returns immediately with status=pending."""
    from app.services.chat_service import get_conversation

    get_conversation(db, conversation_id, current_user.id)

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    file_id = str(uuid4())
    file_ext = os.path.splitext(file.filename or "")[1]
    safe_filename = f"{file_id}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write file to disk: {e}",
        )

    db_file = UploadedFile(
        id=file_id,
        conversation_id=conversation_id,
        filename=file.filename,
        file_path=file_path,
        status="pending",
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    filename = file.filename or safe_filename
    if os.getenv("INLINE_FILE_PROCESSING") == "1":
        # Tests: run inline so TestClient sees final status without async task runner.
        process_file_embedding(file_id, file_path, filename)
        db.refresh(db_file)
    else:
        background_tasks.add_task(
            process_file_embedding,
            file_id,
            file_path,
            filename,
        )

    return db_file


@router.get("/{conversation_id}/files", response_model=List[FileResponse])
def list_uploaded_files(
    conversation_id: int,
    current_user: User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db),
):
    """List all files uploaded for a conversation."""
    from app.services.chat_service import get_conversation

    get_conversation(db, conversation_id, current_user.id)

    return (
        db.query(UploadedFile)
        .filter(UploadedFile.conversation_id == conversation_id)
        .all()
    )
