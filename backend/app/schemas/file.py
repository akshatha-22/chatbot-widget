from datetime import datetime
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
