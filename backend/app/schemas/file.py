from datetime import datetime
from typing import Optional
from app.schemas.base import BaseSchema

class FileBase(BaseSchema):
    filename: str
    status: str

class FileCreate(BaseSchema):
    filename: str
    conversation_id: int
    file_path: str

class FileResponse(FileBase):
    id: str
    conversation_id: int
    created_at: datetime
    processing_error: Optional[str] = None
