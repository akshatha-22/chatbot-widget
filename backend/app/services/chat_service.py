from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from typing import Iterator, List, Optional, Tuple
from app.database.db import Conversation, Message, UploadedFile
from app.config import settings
from app.services import vector_store_service
from datetime import datetime
import json
import re

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
            "has_pdf": bool(getattr(assistant_message, "has_pdf", False)),
            "pdf_content": getattr(assistant_message, "pdf_content", None),
            "pdf_filename": getattr(assistant_message, "pdf_filename", None),
        }
    )
    return f"data: {payload}\n\n"


def _is_contextual_pdf_topic(topic: str) -> bool:
    """Topics that should pull content from the current conversation."""
    t = topic.lower().strip().rstrip("?.!")
    if t in {"content", "this", "that", "it", "above", "below"}:
        return True
    return bool(re.match(r"^(the|this|that|our|my)\s+", t))


def detect_pdf_request(message: str) -> Optional[str]:
    """Returns the content topic if message is a PDF request, else None."""
    msg_lower = message.lower().strip().rstrip("?.!")
    if not re.search(r"\bpdf\b", msg_lower):
        return None

    prefix = r"(?:(?:can|could|will|would)\s+you|please|kindly)\s+"
    article = r"(?:the|a|an)?\s*"
    verb = r"(?:generate|create|make|produce|build|get|give|export|download|turn|save|provide|send)"
    prep = r"(?:with|of|about|for|on|containing|from)"

    patterns: list[tuple[str, bool]] = [
        # "can you generate the pdf with the recipe"
        (rf"(?:{prefix})?{verb}\s+(?:me\s+)?(?:{article})?pdf\s+{prep}\s+(.+)", True),
        # "generate a pdf recipe" / "make pdf of X"
        (rf"(?:{prefix})?{verb}\s+(?:me\s+)?(?:{article})?pdf\s+(?:file\s+)?(?:{prep}\s+)?(.+)", True),
        # "turn this into a pdf"
        (r"turn\s+(?:this|that|it|the conversation)\s+into\s+(?:a|the)?\s*pdf", False),
        # "export/download this as pdf"
        (r"(?:export|save|download)\s+(?:this|that|it|the conversation)?\s*(?:chat|conversation)?\s*(?:as|to)\s+(?:a|the)?\s*pdf", False),
        # "generate the pdf" (no topic — use conversation)
        (rf"(?:{prefix})?{verb}\s+(?:me\s+)?(?:{article})?pdf\s*$", False),
        # "I need a pdf of the recipe"
        (rf"(?:i\s+(?:need|want)|get\s+me)\s+(?:a|the)?\s*pdf\s+{prep}\s+(.+)", True),
    ]

    for pattern, has_topic in patterns:
        match = re.search(pattern, msg_lower)
        if match:
            if has_topic:
                topic = match.group(1).strip().rstrip("?.!")
                return topic or "content"
            return "content"

    # Broad fallback: pdf + action verb in the same message
    if re.search(
        r"\b(generate|create|make|export|download|turn|save|provide|build|give)\b",
        msg_lower,
    ):
        topic_match = re.search(rf"\b{prep}\s+(.+)$", msg_lower)
        if topic_match:
            return topic_match.group(1).strip().rstrip("?.!") or "content"
        return "content"

    return None


def _build_pdf_topic_prompt(pdf_topic: str, conversation_text: str = "") -> str:
    """Prompt LLM for structured markdown suitable for PDF export."""
    use_conversation = (
        pdf_topic == "content" or _is_contextual_pdf_topic(pdf_topic)
    ) and conversation_text.strip()

    if use_conversation:
        focus = ""
        if pdf_topic not in {"content"} and not pdf_topic.startswith("content"):
            focus = f" Focus on: {pdf_topic}."
        subject_block = (
            "Using the conversation below, create a well-structured PDF-ready document."
            f"{focus}\n"
            "Extract and organize the relevant information from the chat.\n"
            "Do NOT say you cannot create files — output the document content only.\n\n"
            f"{conversation_text}\n"
        )
    elif pdf_topic == "content":
        subject_block = "Create a helpful structured document based on the user's request.\n"
    else:
        subject_block = f"Create well-structured content about: {pdf_topic}\n"

    return f"""{subject_block}
Format your response with:
## Title (topic name)

A brief intro paragraph

## Ingredients / Key Points / Overview
- bullet point 1
- bullet point 2
- bullet point 3

## Steps / Details / Method
1. numbered step 1
2. numbered step 2

## Notes / Tips
- any extra tips

## Summary
closing paragraph

Use proper markdown formatting throughout.
"""


def _conversation_text_for_pdf(conv: Conversation, limit: int = 30) -> str:
    msgs = sorted(conv.messages, key=lambda m: m.created_at)[-limit:]
    return "\n".join(f"{m.role}: {m.content}" for m in msgs)


def _safe_pdf_filename(pdf_topic: str) -> str:
    safe = re.sub(r"[^\w\-_]+", "_", pdf_topic.strip())[:30].strip("_")
    return f"{safe or 'remi_generated'}.pdf"


def _create_pdf_assistant_message(
    db: Session,
    conversation_id: int,
    user_id: int,
    pdf_topic: str,
) -> Message:
    """Generate PDF markdown via LLM and persist assistant message with PDF metadata."""
    conv = get_conversation(db, conversation_id, user_id)
    conversation_text = _conversation_text_for_pdf(conv)
    prompt = _build_pdf_topic_prompt(pdf_topic, conversation_text)
    generated_content = generate_text(prompt)

    if not generated_content:
        title = pdf_topic if pdf_topic != "content" else "Document"
        generated_content = (
            f"## {title.title()}\n\n"
            "_Content could not be generated. Please configure GEMINI_API_KEY or OPENAI_API_KEY._"
        )

    filename = _safe_pdf_filename(pdf_topic if pdf_topic != "content" else "conversation")
    display_topic = pdf_topic if pdf_topic != "content" else "your request"
    assistant_content = (
        f"I've generated the PDF for **{display_topic}**! It should download automatically. ✅"
    )

    return create_message(
        db,
        conversation_id,
        user_id,
        "assistant",
        assistant_content,
        has_pdf=True,
        pdf_content=generated_content,
        pdf_filename=filename,
    )


def _prepare_assistant_context(
    db: Session, conversation_id: int, user_id: int, user_message: str
) -> Tuple[Conversation, str, str, List[Message], Optional[str]]:
    """Shared setup: auto-title, history, RAG, Gemini prompt. Returns gemini_error hint."""
    conv = get_conversation(db, conversation_id, user_id)

    _DEFAULT_TITLES = ("New Conversation", "New Chat", "Conversation")
    if conv.title and conv.title not in _DEFAULT_TITLES:
        pass  # user renamed — never overwrite a custom title
    elif not conv.title or conv.title in _DEFAULT_TITLES:
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
    pdf_topic = detect_pdf_request(user_message)
    if pdf_topic is not None:
        assistant_msg = _create_pdf_assistant_message(
            db, conversation_id, user_id, pdf_topic
        )
        yield format_sse_done(assistant_msg)
        return

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


def rename_conversation(
    db: Session, conversation_id: int, user_id: int, title: str
) -> Conversation:
    """Persist a user-edited conversation title."""
    conv = get_conversation(db, conversation_id, user_id)
    conv.title = title.strip() or conv.title
    db.commit()
    db.refresh(conv)
    return conv


def delete_conversation(db: Session, conversation_id: int, user_id: int) -> bool:
    """Delete a conversation, verifying user ownership."""
    conv = get_conversation(db, conversation_id, user_id)
    db.delete(conv)
    db.commit()
    return True


def create_message(
    db: Session,
    conversation_id: int,
    user_id: int,
    role: str,
    content: str,
    has_pdf: bool = False,
    pdf_content: Optional[str] = None,
    pdf_filename: Optional[str] = None,
) -> Message:
    """Create a new message in a conversation after verifying user ownership."""
    get_conversation(db, conversation_id, user_id)

    db_msg = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        has_pdf=has_pdf,
        pdf_content=pdf_content,
        pdf_filename=pdf_filename,
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
    pdf_topic = detect_pdf_request(user_message)
    if pdf_topic is not None:
        return _create_pdf_assistant_message(db, conversation_id, user_id, pdf_topic)

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


def generate_text(prompt: str) -> str:
    """Generate text from a one-shot prompt via Gemini, with OpenAI fallback."""
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
                    {"role": "system", "content": "You are Remi, a helpful writing assistant."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=2000,
            )
            content = (response.choices[0].message.content or "").strip()
        except Exception as e:
            print(f"OpenAI generate_text error: {e}")

    return content


def _build_document_prompt(kind: str, conversation_text: str) -> str:
    """Return a type-specific prompt that asks for structured markdown output."""
    prompts = {
        "summary": f"""
Analyze this conversation and create a structured summary with:
- An executive summary paragraph
- Key Points (bullet list)
- Main Topics Discussed (bullet list)
- Action Items if any (bullet list)
- Conclusion paragraph

Format using markdown with ## headings and - bullet points.
Do NOT paste the raw conversation transcript — synthesize and summarize only.

Conversation:
{conversation_text}
""",
        "report": f"""
Create a formal report from this conversation with these sections:
## Overview
## Findings
## Key Insights (bullet points)
## Recommendations (numbered list)
## Conclusion

Format using markdown with ## headings, - bullets, and numbered lists.
Do NOT paste the raw conversation transcript — write a polished report.

Conversation:
{conversation_text}
""",
        "analysis": f"""
Perform a detailed analysis of this conversation with:
## Analysis Summary
## Sentiment & Tone
## Key Themes (bullet points)
## Notable Patterns
## Conclusions

Format using markdown with ## headings and - bullet points.
Do NOT paste the raw conversation transcript — provide analytical insight only.

Conversation:
{conversation_text}
""",
    }
    return prompts.get(kind, prompts["summary"])


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

    msgs = sorted(conv.messages, key=lambda m: m.created_at)[-50:]
    conversation_text = "\n".join(f"{m.role}: {m.content}" for m in msgs)

    if not conversation_text.strip():
        conversation_text = "(No messages in this conversation yet.)"

    prompt = _build_document_prompt(kind_norm, conversation_text)
    content = generate_text(prompt)

    type_labels = {"summary": "Summary", "report": "Report", "analysis": "Analysis"}
    doc_type = type_labels[kind_norm]

    if not content:
        content = (
            f"## {doc_type}\n\n"
            "_AI generation is unavailable. Please configure GEMINI_API_KEY or OPENAI_API_KEY "
            "and try again._"
        )

    safe_title = (conv.title or "conversation").strip().replace("/", "-").replace("\\", "-")
    filename = f"{safe_title}-{kind_norm}.{fmt_norm}"

    return {
        "filename": filename,
        "format": fmt_norm,
        "content": content,
        "type": doc_type,
    }
