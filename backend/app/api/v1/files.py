import logging
import os
import shutil
import threading
import traceback
from uuid import uuid4
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List

from app.core.mime_validation import _MAGIC_SAMPLE_SIZE, validate_upload_mime
from app.core.network import get_real_ip
from app.database.db import SessionLocal, get_db, User, UploadedFile
from app.schemas.audit_log import AuditAction
from app.schemas.file import FileResponse
from app.services import audit_service, auth_service, file_parser_service, vector_store_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat/conversations", tags=["Files"])

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

# Save uploaded files under backend/data/uploads
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "uploads"))


def _file_is_stale(db_file: UploadedFile) -> bool:
    if db_file.status != "processed":
        return False
    current = vector_store_service.get_current_embedding_model_version()
    return db_file.embedding_model_version != current


def _build_file_response(db_file: UploadedFile) -> FileResponse:
    return FileResponse(
        id=db_file.id,
        filename=db_file.filename,
        status=db_file.status,
        conversation_id=db_file.conversation_id,
        created_at=db_file.created_at,
        processing_error=db_file.processing_error,
        embedding_model_version=db_file.embedding_model_version,
        stale=_file_is_stale(db_file),
    )


def process_file_embedding(file_id: str, file_path: str, filename: str) -> None:
    """Parse, chunk, and index a file in the background (separate DB session)."""
    print(f"[EMBED] Starting embedding for {filename} ({file_id})")
    if not os.path.isfile(file_path):
        error_msg = f"Uploaded file missing on server: {filename}"
        print(f"[EMBED] ERROR: {error_msg}")
        db = SessionLocal()
        try:
            db_file = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
            if db_file:
                db_file.status = "failed"
                db_file.processing_error = error_msg[:500]
                db.commit()
        finally:
            db.close()
        return

    if not vector_store_service.gemini_embeddings_available():
        print("[EMBED] WARNING: GEMINI_API_KEY is not configured — embedding will fail")

    db = SessionLocal()
    try:
        print(f"[EMBED] Extracting text from {filename}")
        extracted_text = file_parser_service.extract_text(file_path, filename)
        if not extracted_text or not extracted_text.strip():
            raise ValueError(f"No text extracted from {filename}")

        print(f"[EMBED] Extracted {len(extracted_text)} characters")
        row_chunks = file_parser_service.parse_row_chunks(file_path, filename)
        print(f"[EMBED] Creating pgvector embeddings for {file_id}")
        vector_store_service.chunk_and_store(
            file_id,
            extracted_text,
            db=db,
            chunks=row_chunks,
            raw_text=extracted_text,
        )
        print(f"[EMBED] Embeddings stored successfully")

        db_file = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
        if db_file:
            db_file.status = "processed"
            db_file.processing_error = None
            db.commit()
            print(f"[EMBED] Status updated to processed")
        else:
            print(f"[EMBED] WARNING: file {file_id} not found in DB")
    except Exception as e:
        error_msg = str(e)
        print(f"[EMBED] ERROR: {error_msg}")
        traceback.print_exc()
        try:
            db.rollback()
            db_file = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
            if db_file:
                db_file.status = "failed"
                db_file.processing_error = error_msg[:500]
                db.commit()
                print(f"[EMBED] Status updated to failed")
        except Exception as db_err:
            print(f"[EMBED] Could not update failed status: {db_err}")
    finally:
        db.close()
        print(f"[EMBED] DB session closed")


def _run_embedding_in_thread(file_id: str, file_path: str, filename: str) -> None:
    """Run embedding off the asyncio event loop so health checks stay responsive."""
    thread = threading.Thread(
        target=process_file_embedding,
        args=(file_id, file_path, filename),
        daemon=False,
        name=f"embed-{file_id[:8]}",
    )
    thread.start()


@router.post("/{conversation_id}/files", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    conversation_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db),
):
    """Save file to disk and queue RAG indexing; returns immediately with status=pending."""
    from app.services.chat_service import get_conversation

    get_conversation(db, conversation_id, current_user.id)

    file_header = file.file.read(_MAGIC_SAMPLE_SIZE)
    file.file.seek(0)

    validate_upload_mime(file.content_type, file.filename or "", file_header=file_header)

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    file.file.seek(0, os.SEEK_END)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size is 100MB.",
        )

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
            _run_embedding_in_thread,
            file_id,
            file_path,
            filename,
        )

    background_tasks.add_task(
        audit_service.log_action,
        db,
        current_user.id,
        AuditAction.upload,
        "file",
        file_id,
        get_real_ip(request),
    )

    return _build_file_response(db_file)


@router.get("/{conversation_id}/files", response_model=List[FileResponse])
def list_uploaded_files(
    conversation_id: int,
    current_user: User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db),
):
    """List all files uploaded for a conversation."""
    from app.services.chat_service import get_conversation

    get_conversation(db, conversation_id, current_user.id)

    rows = (
        db.query(UploadedFile)
        .filter(UploadedFile.conversation_id == conversation_id)
        .all()
    )
    return [_build_file_response(row) for row in rows]


@router.post(
    "/{conversation_id}/files/{file_id}/reindex",
    response_model=FileResponse,
)
async def reindex_uploaded_file(
    conversation_id: int,
    file_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db),
):
    """Re-embed an existing upload (e.g. after index version upgrade)."""
    from app.services.chat_service import require_conversation_access

    require_conversation_access(db, conversation_id, current_user.id)

    db_file = (
        db.query(UploadedFile)
        .filter(
            UploadedFile.id == file_id,
            UploadedFile.conversation_id == conversation_id,
        )
        .first()
    )
    if not db_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )
    if not os.path.isfile(db_file.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Uploaded file missing on server — please upload again",
        )
    if db_file.status == "pending":
        return _build_file_response(db_file)

    db_file.status = "pending"
    db_file.processing_error = None
    db.commit()
    db.refresh(db_file)

    if os.getenv("INLINE_FILE_PROCESSING") == "1":
        process_file_embedding(db_file.id, db_file.file_path, db_file.filename)
        db.refresh(db_file)
    else:
        background_tasks.add_task(
            _run_embedding_in_thread,
            db_file.id,
            db_file.file_path,
            db_file.filename,
        )

    return _build_file_response(db_file)


@router.delete(
    "/{conversation_id}/files/{file_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_uploaded_file(
    conversation_id: int,
    file_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an uploaded file, its vectors, and on-disk copy."""
    from app.services.chat_service import require_conversation_access

    require_conversation_access(db, conversation_id, current_user.id)

    db_file = (
        db.query(UploadedFile)
        .filter(
            UploadedFile.id == file_id,
            UploadedFile.conversation_id == conversation_id,
        )
        .first()
    )
    if not db_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )

    stored_path = db_file.file_path
    vector_store_service.delete_file_data(file_id, db=db)
    db.delete(db_file)
    db.commit()
    if stored_path and os.path.isfile(stored_path):
        try:
            os.remove(stored_path)
        except OSError as exc:
            logger.warning("Could not delete upload file %s: %s", stored_path, exc)

    background_tasks.add_task(
        audit_service.log_action,
        db,
        current_user.id,
        AuditAction.delete,
        "file",
        file_id,
        get_real_ip(request),
    )

    return None
