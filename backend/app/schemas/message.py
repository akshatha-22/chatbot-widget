from datetime import datetime
from typing import Optional
from app.schemas.base import BaseSchema

class MessageBase(BaseSchema):
    role: str  # "user" or "assistant"
    content: str

class MessageCreate(BaseSchema):
    content: str
    role: Optional[str] = "user"

class MessageResponse(MessageBase):
    id: int
    conversation_id: int
    created_at: datetime
    has_pdf: bool = False
    pdf_content: Optional[str] = None
    pdf_filename: Optional[str] = None
