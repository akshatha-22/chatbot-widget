from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from typing import Iterator, List, Optional, Tuple
from app.database.db import Conversation, Message, UploadedFile
from app.config import settings
from app.services import vector_store_service
from datetime import datetime
import json

MARKDOWN_INSTRUCTION = (
    "Always format your responses using markdown. Use bullet points for lists, "
    "**bold** for key terms, and blank lines between paragraphs."
)

def _gemini_models_to_try() -> List[str]:
    """Primary model from settings, then sensible fallbacks (gemini-pro is retired)."""
    primary = (settings.GEMINI_MODEL or "gemini-2.5-flash").strip()
    fallbacks = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"]
    out: List[str] = []
    for name in [primary, *fallbacks]:
        if name and name not in out:
            out.append(name)
    return out


def _call_gemini(prompt: str) -> tuple[Optional[str], Optional[str]]:
    """Returns (text, error_detail). error_detail is set when all models fail."""
    if not settings.GEMINI_API_KEY:
        return None, None

    import google.generativeai as genai

    genai.configure(api_key=settings.GEMINI_API_KEY)
    last_error: Optional[str] = None

    for model_name in _gemini_models_to_try():
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            text = (response.text or "").strip()
            if text:
                return text, None
        except Exception as e:
            last_error = f"{model_name}: {e}"
            print(f"Gemini API error ({model_name}): {e}")

    return None, last_error


def _chunk_text(chunk) -> str:
    """Extract text from a Gemini streaming chunk."""
    try:
        return chunk.text or ""
    except (ValueError, AttributeError):
        return ""


def _stream_gemini(prompt: str) -> Iterator[str]:
    """Stream Gemini response chunks. Yields nothing if all models fail."""
    if not settings.GEMINI_API_KEY:
        return

    import google.generativeai as genai

    genai.configure(api_key=settings.GEMINI_API_KEY)

    for model_name in _gemini_models_to_try():
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt, stream=True)
            for chunk in response:
                text = _chunk_text(chunk)
                if text:
                    yield text
            return
        except Exception as e:
            print(f"Gemini stream error ({model_name}): {e}")


def format_sse(text: str) -> str:
    """Format a single SSE event: data: <text>\\n\\n (multi-line safe)."""
    if not text:
        return ""
    if "\n" not in text and "\r" not in text:
        return f"data: {text}\n\n"
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    return "".join(f"data: {line}\n" for line in lines) + "\n"


def format_sse_done(assistant_message: Message) -> str:
    """Final SSE event with persisted assistant message metadata."""
    payload = json.dumps(
        {
            "event": "done",
            "id": assistant_message.id,
            "role": assistant_message.role,
            "content": assistant_message.content,
            "created_at": assistant_message.created_at.isoformat()
            if assistant_message.created_at
            else None,
        }
    )
    return f"data: {payload}\n\n"


def _prepare_assistant_context(
    db: Session, conversation_id: int, user_id: int, user_message: str
) -> Tuple[Conversation, str, str, List[Message], Optional[str]]:
    """Shared setup: auto-title, history, RAG, Gemini prompt. Returns gemini_error hint."""
    conv = get_conversation(db, conversation_id, user_id)

    if not conv.title or conv.title in ("New Conversation", "Conversation"):
        conv.title = user_message[:40] + ("..." if len(user_message) > 40 else "")
        db.add(conv)
        db.commit()

    history = conv.messages[-6:-1]
    rag_context = build_rag_context(db, conversation_id, user_message)
    rag_block = (
        f"Relevant context from uploaded documents:\n{rag_context}\n\n"
        if rag_context
        else ""
    )

    gemini_prompt = (
        "You are a helpful assistant named Remi. Answer the user request briefly and politely.\n"
        f"{MARKDOWN_INSTRUCTION}\n"
    )
    for msg in history:
        gemini_prompt += f"{msg.role.capitalize()}: {msg.content}\n"
    gemini_prompt += rag_block
    gemini_prompt += f"User: {user_message}\nAssistant:"

    return conv, gemini_prompt, rag_context, history, None


def _fallback_assistant_content(
    user_message: str,
    rag_context: str,
    gemini_error: Optional[str],
) -> str:
    """Rule-based / RAG fallback when AI providers are unavailable."""
    if gemini_error and "429" in gemini_error:
        return (
            "Remi couldn't reach Gemini right now (API quota or rate limit). "
            "Check billing at https://aistudio.google.com/apikey or try again later."
        )
    if gemini_error and settings.GEMINI_API_KEY:
        return (
            "Remi couldn't get a Gemini response. Check the API key in `.env.local` "
            f"and that `{settings.GEMINI_MODEL}` is enabled for your project."
        )
    if rag_context:
        return (
            f"Based on the uploaded documents, here is what I found:\n\n"
            f"{rag_context[:800]}\n\n"
            f"_(Running in local fallback mode — configure GEMINI_API_KEY or OPENAI_API_KEY for full AI answers.)_"
        )

    msg_lower = user_message.lower()
    if any(greet in msg_lower for greet in ["hello", "hi", "hey", "greetings"]):
        return "Hello! I'm Remi. How can I help you today?"
    if "help" in msg_lower:
        return (
            "I can assist you with understanding the application, answering questions, "
            "or managing files. What would you like to do?"
        )
    if any(kw in msg_lower for kw in ["features", "what can you do", "capabilities"]):
        return (
            "I am a chatbot widget supporting user authentication, session history, "
            "customizable themes, and a file upload interface."
        )
    if any(kw in msg_lower for kw in ["clear", "reset", "delete"]):
        return "To clean up the workspace, you can clear messages or start a new conversation session."

    return (
        f"Thanks for your message: '{user_message}'. "
        "I'm running in local fallback mode. "
        "Add GEMINI_API_KEY to the repo-root `.env.local` (or `backend/.env`) and restart the API."
    )


def _openai_assistant_content(
    history: List[Message], user_message: str, rag_context: str
) -> str:
    if not settings.OPENAI_API_KEY:
        return ""
    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        system_prompt = (
            "You are a helpful assistant named Remi. "
            f"{MARKDOWN_INSTRUCTION}"
        )
        if rag_context:
            system_prompt += f"\n\nRelevant context from uploaded documents:\n{rag_context}"

        messages = [{"role": "system", "content": system_prompt}]
        for msg in history:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": user_message})

        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            max_tokens=300,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"OpenAI API error: {e}")
        return ""


def iter_assistant_chunks(
    db: Session, conversation_id: int, user_id: int, user_message: str
) -> Iterator[str]:
    """Yield assistant reply text chunks (Gemini stream, or one-shot fallback/OpenAI)."""
    _conv, gemini_prompt, rag_context, history, _ = _prepare_assistant_context(
        db, conversation_id, user_id, user_message
    )

    if settings.GEMINI_API_KEY:
        streamed = False
        for piece in _stream_gemini(gemini_prompt):
            streamed = True
            yield piece
        if streamed:
            return

    content = _openai_assistant_content(history, user_message, rag_context)
    if content:
        yield content
        return

    yield _fallback_assistant_content(user_message, rag_context, None)


def stream_and_save_assistant(
    db: Session, conversation_id: int, user_id: int, user_message: str
) -> Iterator[str]:
    """Yield SSE-formatted chunks, then a final done event after persisting the assistant message."""
    parts: List[str] = []
    for piece in iter_assistant_chunks(db, conversation_id, user_id, user_message):
        parts.append(piece)
        event = format_sse(piece)
        if event:
            yield event

    assistant_content = "".join(parts).strip()
    if not assistant_content:
        assistant_content = _fallback_assistant_content(user_message, "", None)

    assistant_msg = create_message(
        db, conversation_id, user_id, "assistant", assistant_content
    )
    yield format_sse_done(assistant_msg)


def create_conversation(db: Session, user_id: int, title: Optional[str] = None) -> Conversation:
    """Create a new conversation session for a user."""
    db_conv = Conversation(
        title=title or "New Conversation",
        user_id=user_id
    )
    db.add(db_conv)
    db.commit()
    db.refresh(db_conv)
    return db_conv


def list_messages(db: Session, conversation_id: int, user_id: int) -> List[Message]:
    """Return all messages for a conversation, oldest first."""
    get_conversation(db, conversation_id, user_id)
    return (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .all()
    )


def get_conversation(db: Session, conversation_id: int, user_id: int) -> Conversation:
    """Retrieve a specific conversation, verifying it belongs to the user."""
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id
    ).first()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    return conv


def list_conversations(db: Session, user_id: int) -> List[Conversation]:
    """List all conversations for a user, sorted by creation date descending."""
    return db.query(Conversation).filter(
        Conversation.user_id == user_id
    ).order_by(Conversation.created_at.desc()).all()


def delete_conversation(db: Session, conversation_id: int, user_id: int) -> bool:
    """Delete a conversation, verifying user ownership."""
    conv = get_conversation(db, conversation_id, user_id)
    db.delete(conv)
    db.commit()
    return True


def create_message(db: Session, conversation_id: int, user_id: int, role: str, content: str) -> Message:
    """Create a new message in a conversation after verifying user ownership."""
    get_conversation(db, conversation_id, user_id)

    db_msg = Message(
        conversation_id=conversation_id,
        role=role,
        content=content
    )
    db.add(db_msg)
    db.commit()
    db.refresh(db_msg)
    return db_msg


def get_processed_file_ids(db: Session, conversation_id: int) -> List[str]:
    """Return IDs of all successfully processed/indexed files in a conversation."""
    files = db.query(UploadedFile).filter(
        UploadedFile.conversation_id == conversation_id,
        UploadedFile.status == "processed"
    ).all()
    return [f.id for f in files]


def build_rag_context(db: Session, conversation_id: int, user_message: str) -> str:
    """
    Retrieve the most relevant document chunks for the user message via FAISS search.
    Returns an empty string if no processed files exist for this conversation.
    """
    file_ids = get_processed_file_ids(db, conversation_id)
    if not file_ids:
        return ""

    try:
        chunks = vector_store_service.search(file_ids, user_message, top_k=5)
        return "\n\n".join(chunks) if chunks else ""
    except Exception as e:
        print(f"RAG vector search error: {e}")
        return ""


def generate_assistant_response(db: Session, conversation_id: int, user_id: int, user_message: str) -> Message:
    """Generate assistant response using Gemini, OpenAI, or a smart local fallback."""
    _conv, gemini_prompt, rag_context, history, _ = _prepare_assistant_context(
        db, conversation_id, user_id, user_message
    )

    assistant_content = ""
    gemini_error: Optional[str] = None

    if settings.GEMINI_API_KEY:
        assistant_content, gemini_error = _call_gemini(gemini_prompt)
        if assistant_content is None:
            assistant_content = ""

    if not assistant_content:
        assistant_content = _openai_assistant_content(history, user_message, rag_context)

    if not assistant_content:
        assistant_content = _fallback_assistant_content(
            user_message, rag_context, gemini_error
        )

    return create_message(db, conversation_id, user_id, "assistant", assistant_content)


def generate_conversation_file(
    db: Session,
    conversation_id: int,
    user_id: int,
    kind: str,
    out_format: str,
) -> dict:
    """Generate a derived document from conversation history.

    Returns a JSON payload the frontend can download/print.
    """
    conv = get_conversation(db, conversation_id, user_id)
    kind_norm = (kind or "summary").strip().lower()
    if kind_norm not in {"summary", "report", "analysis"}:
        kind_norm = "summary"

    fmt_norm = (out_format or "txt").strip().lower()
    if fmt_norm not in {"pdf", "docx", "txt"}:
        fmt_norm = "txt"

    # Build a plain transcript (latest 50 messages) as context.
    msgs = conv.messages[-50:]
    transcript_lines: List[str] = []
    for m in msgs:
        speaker = "User" if m.role == "user" else "Assistant"
        transcript_lines.append(f"{speaker}: {m.content}")

    transcript = "\n\n".join(transcript_lines).strip()

    prompt = (
        f"You are a helpful assistant named Remi.\n\n"
        f"Task: Write a {kind_norm} of this conversation.\n"
        f"- Keep it structured with headings and bullet points when appropriate.\n"
        f"- Do not include private tokens.\n\n"
        f"Conversation:\n{transcript}\n\n"
        f"Output:"
    )

    content = ""
    if settings.GEMINI_API_KEY:
        content, _ = _call_gemini(prompt)
        content = (content or "").strip()

    if not content and settings.OPENAI_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            response = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "You are Remi."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=900,
            )
            content = response.choices[0].message.content.strip()
        except Exception as e:
            print(f"OpenAI generate file error: {e}")

    if not content:
        # Fallback: basic structured output
        now = datetime.now().strftime("%Y-%m-%d %H:%M")
        content = (
            f"{conv.title}\n"
            f"Generated: {now}\n"
            f"Type: {kind_norm}\n\n"
            f"(AI generation unavailable — showing transcript.)\n\n"
            f"{transcript}"
        )

    safe_title = (conv.title or "conversation").strip().replace("/", "-").replace("\\", "-")
    ext = fmt_norm
    filename = f"{safe_title}-{kind_norm}.{ext}"

    return {"filename": filename, "format": fmt_norm, "content": content}
