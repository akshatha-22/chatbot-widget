from fastapi import APIRouter, BackgroundTasks, Depends, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List

from app.core.network import get_real_ip
from app.database.db import get_db, User
from app.schemas.audit_log import AuditAction
from app.schemas.conversation import (
    ConversationCreate,
    ConversationRename,
    ConversationResponse,
    ConversationDetailResponse,
)
from app.schemas.message import MessageCreate, MessageResponse
from app.services import audit_service, auth_service, chat_service, quota_service
from app.services.quota_service import QuotaExceededError


from pydantic import BaseModel


class GenerateConversationRequest(BaseModel):
    type: str  # "summary" | "report" | "analysis"
    format: str  # "pdf" | "docx" | "txt"


class GenerateConversationResponse(BaseModel):
    filename: str
    format: str
    content: str
    type: str

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_new_conversation(
    conv_in: ConversationCreate = None,
    current_user: User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new conversation session."""
    title = conv_in.title if conv_in else None
    return chat_service.create_conversation(db, current_user.id, title)

@router.get("/conversations", response_model=List[ConversationResponse])
def get_conversations_list(
    current_user: User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db)
):
    """List all conversations belonging to the user."""
    return chat_service.list_conversations(db, current_user.id)

@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
def get_conversation_messages(
    conversation_id: int,
    current_user: User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db),
):
    """List all messages in a conversation, ordered by created_at ascending."""
    return chat_service.list_messages(db, conversation_id, current_user.id)


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation_details(
    conversation_id: int,
    current_user: User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db)
):
    """Get a detailed view of a conversation including all its messages."""
    return chat_service.get_conversation(db, conversation_id, current_user.id)

@router.patch("/conversations/{conversation_id}", response_model=ConversationResponse)
def rename_conversation_session(
    conversation_id: int,
    body: ConversationRename,
    current_user: User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db),
):
    """Rename a conversation (persists across restarts)."""
    return chat_service.rename_conversation(
        db, conversation_id, current_user.id, body.title
    )


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation_session(
    conversation_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a conversation session."""
    chat_service.delete_conversation(db, conversation_id, current_user.id)
    background_tasks.add_task(
        audit_service.log_action,
        db,
        current_user.id,
        AuditAction.delete,
        "conversation",
        str(conversation_id),
        get_real_ip(request),
    )
    return

@router.post("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
def post_new_message(
    conversation_id: int,
    msg_in: MessageCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db)
):
    """Send a message to a conversation. Returns both the sent user message and generated assistant message."""
    try:
        chat_service.ensure_gemini_quota(
            db, conversation_id, current_user.id, msg_in.content
        )
    except QuotaExceededError as exc:
        quota_service.raise_http_quota_exceeded(exc)

    # Create the user message
    user_msg = chat_service.create_message(
        db, conversation_id, current_user.id, role="user", content=msg_in.content
    )
    
    # Generate the assistant response
    assistant_msg = chat_service.generate_assistant_response(
        db, conversation_id, current_user.id, msg_in.content
    )

    background_tasks.add_task(
        audit_service.log_action,
        db,
        current_user.id,
        AuditAction.message,
        "conversation",
        str(conversation_id),
        get_real_ip(request),
    )
    
    return [user_msg, assistant_msg]


@router.post("/conversations/{conversation_id}/messages/stream")
def post_message_stream(
    conversation_id: int,
    msg_in: MessageCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db),
):
    """Stream assistant reply as Server-Sent Events (data: <text>\\n\\n per chunk)."""
    try:
        chat_service.ensure_gemini_quota(
            db, conversation_id, current_user.id, msg_in.content
        )
    except QuotaExceededError as exc:
        quota_service.raise_http_quota_exceeded(exc)

    chat_service.create_message(
        db, conversation_id, current_user.id, role="user", content=msg_in.content
    )

    background_tasks.add_task(
        audit_service.log_action,
        db,
        current_user.id,
        AuditAction.message,
        "conversation",
        str(conversation_id),
        get_real_ip(request),
    )

    def event_stream():
        yield from chat_service.stream_and_save_assistant(
            db, conversation_id, current_user.id, msg_in.content
        )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/conversations/{conversation_id}/generate", response_model=GenerateConversationResponse)
def generate_conversation_file(
    conversation_id: int,
    payload: GenerateConversationRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a derived file (summary/report/analysis) from a conversation."""
    result = chat_service.generate_conversation_file(
        db=db,
        conversation_id=conversation_id,
        user_id=current_user.id,
        kind=payload.type,
        out_format=payload.format,
    )
    background_tasks.add_task(
        audit_service.log_action,
        db,
        current_user.id,
        AuditAction.generate,
        "conversation",
        str(conversation_id),
        get_real_ip(request),
    )
    return result
