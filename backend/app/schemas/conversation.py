from datetime import datetime
from typing import Optional, List
from app.schemas.base import BaseSchema
from app.schemas.message import MessageResponse

class ConversationBase(BaseSchema):
    title: Optional[str] = "New Conversation"

class ConversationCreate(BaseSchema):
    title: Optional[str] = None

class ConversationResponse(ConversationBase):
    id: int
    user_id: int
    created_at: datetime

class ConversationDetailResponse(ConversationResponse):
    messages: List[MessageResponse] = []
