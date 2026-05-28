import os
import shutil
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List

from app.database.db import get_db, User, UploadedFile
from app.schemas.file import FileResponse
from app.services import auth_service, file_parser_service, vector_store_service

router = APIRouter(prefix="/chat/conversations", tags=["Files"])

# Save uploaded files under backend/data/uploads
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "uploads"))

@router.post("/{conversation_id}/files", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    conversation_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a file to a conversation, extracting its text and indexing it for RAG search."""
    # 1. Verify conversation exists and belongs to the current user
    from app.services.chat_service import get_conversation
    get_conversation(db, conversation_id, current_user.id)
    
    # Ensure upload directory exists
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    # Generate unique ID and save file to disk
    file_id = str(uuid4())
    file_ext = os.path.splitext(file.filename)[1]
    safe_filename = f"{file_id}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write file to disk: {e}"
        )
        
    # 2. Save file record to database with status="pending"
    db_file = UploadedFile(
        id=file_id,
        conversation_id=conversation_id,
        filename=file.filename,
        file_path=file_path,
        status="pending"
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    
    # 3. Parse and chunk file contents synchronously
    try:
        # Extract text using parser service
        extracted_text = file_parser_service.extract_text(file_path, file.filename)
        
        # Generate embeddings & save to local vector store
        vector_store_service.chunk_and_store(file_id, extracted_text)
        
        # Mark status as processed
        db_file.status = "processed"
        db.commit()
        db.refresh(db_file)
    except Exception as e:
        db_file.status = "failed"
        db.commit()
        db.refresh(db_file)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to process and index file contents: {e}"
        )
        
    return db_file

@router.get("/{conversation_id}/files", response_model=List[FileResponse])
def list_uploaded_files(
    conversation_id: int,
    current_user: User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db)
):
    """List all files uploaded and indexed for a conversation."""
    # Verify conversation ownership
    from app.services.chat_service import get_conversation
    get_conversation(db, conversation_id, current_user.id)
    
    # Query database
    files = db.query(UploadedFile).filter(UploadedFile.conversation_id == conversation_id).all()
    return files
