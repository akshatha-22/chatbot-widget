from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from typing import Iterator, List, Optional, Tuple
from app.database.db import Conversation, Message, UploadedFile
from app.config import settings
from app.core.sanitizer import sanitize_message
from app.services import quota_service, response_cache, vector_store_service
from app.services.rag_quality_service import RAGQuality, classify_rag_context
from datetime import datetime
import json
import re
from pathlib import Path

MARKDOWN_INSTRUCTION = (
    "Always format your responses using markdown. Use bullet points for lists, "
    "**bold** for key terms, and blank lines between paragraphs."
)

DOCUMENT_ACCESS_OVERRIDE = """
SYSTEM OVERRIDE — READ THIS FIRST:
You are operating with direct access to document content that has been extracted
and provided to you below. This is NOT your training data.
This is NOT web search results.
This IS real content extracted from the user's actual uploaded document.

ABSOLUTE RULES:
1. NEVER say "I cannot access your document"
2. NEVER say "I don't have access to uploaded files"
3. NEVER say "I cannot read page by page"
4. NEVER say "my responses are based on training data" when document content is below
5. ALWAYS treat the DOCUMENT CONTENT section below as the actual contents of the user's file
6. If the user asks about a specific page, look for [Page X] markers and answer from that section
7. If the content below does not contain what the user asked for, say:
   "I found your document but this specific information wasn't in the retrieved sections.
   Try asking differently or specifying a page number."
   Then search the web for supplementary information if appropriate.
"""

NOT_FOUND_MESSAGE = (
    "I couldn't find information about this in your "
    "uploaded document or on the web. Try rephrasing "
    "your question or uploading a more specific document."
)

PENDING_DOCUMENT_MESSAGE = (
    "Your document is still being processed. Please wait a moment and ask again."
)

CONVERSATIONAL_PATTERNS = [
    r"^(hi|hello|hey|thanks|thank you|ok|okay|sure|great)",
    r"^(what do you think|what is your opinion)",
    r"^(tell me a joke|write me a|help me write)",
    r"^(can you|could you|would you|please)",
]

def _gemini_models_to_try() -> List[str]:
    """Primary model from settings, then sensible fallbacks (gemini-pro is retired)."""
    primary = (settings.GEMINI_MODEL or "gemini-2.5-flash").strip()
    fallbacks = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"]
    out: List[str] = []
    for name in [primary, *fallbacks]:
        if name and name not in out:
            out.append(name)
    return out


def _gemini_configured() -> bool:
    return settings.gemini_configured()


def prepare_user_message(content: str) -> str:
    """Sanitize an incoming user message before RAG/LLM use."""
    return sanitize_message(content)


def ensure_gemini_quota(
    db: Session, conversation_id: int, user_id: int, user_message: str
) -> None:
    """Consume daily Gemini quota unless the response is already cached."""
    user_message = prepare_user_message(user_message)

    if not _gemini_configured():
        return

    if detect_pdf_request(user_message) is not None:
        return

    rag_context = build_rag_context(db, conversation_id, user_message)
    use_search = _resolve_use_search(db, conversation_id, rag_context, user_message)
    if response_cache.get_cached_response(user_id, user_message, rag_context, use_search):
        return

    quota_service.check_and_consume_gemini_quota(db, user_id)


def _gemini_grounding_config():
    """Google Search grounding — model decides when to search (news, weather, scores, etc.)."""
    from google.genai import types

    return types.GenerateContentConfig(
        tools=[types.Tool(google_search=types.GoogleSearch())],
    )


def _gemini_genai_client():
    from google import genai

    return genai.Client(api_key=settings.GEMINI_API_KEY.strip())


def _response_text(response) -> str:
    try:
        return (response.text or "").strip()
    except (ValueError, AttributeError):
        return ""


def _stream_chunk_text(chunk) -> str:
    try:
        return chunk.text or ""
    except (ValueError, AttributeError):
        return ""


def _call_gemini_without_search(prompt: str) -> tuple[Optional[str], Optional[str]]:
    """Gemini without Google Search — prefer when answering from uploaded documents."""
    client = _gemini_genai_client()
    last_error: Optional[str] = None

    for model_name in _gemini_models_to_try():
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            text = _response_text(response)
            if text:
                return text, None
        except Exception as e:
            last_error = f"{model_name}: {e}"
            print(f"Gemini (no search) error ({model_name}): {e}")

    return None, last_error


def _stream_gemini_without_search(prompt: str) -> Iterator[str]:
    client = _gemini_genai_client()

    for model_name in _gemini_models_to_try():
        try:
            stream = client.models.generate_content_stream(
                model=model_name,
                contents=prompt,
            )
            yielded = False
            for chunk in stream:
                text = _stream_chunk_text(chunk)
                if text:
                    yielded = True
                    yield text
            if yielded:
                return
        except Exception as e:
            print(f"Gemini (no search) stream error ({model_name}): {e}")


def _call_gemini_with_search(prompt: str) -> tuple[Optional[str], Optional[str], Optional[object]]:
    """Gemini via google-genai with Google Search grounding."""
    client = _gemini_genai_client()
    config = _gemini_grounding_config()
    last_error: Optional[str] = None
    last_response: Optional[object] = None

    for model_name in _gemini_models_to_try():
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config,
            )
            last_response = response
            text = _response_text(response)
            if text:
                return text, None, response
        except Exception as e:
            last_error = f"{model_name}: {e}"
            print(f"Gemini search error ({model_name}): {e}")

    return None, last_error, last_response


def _call_gemini_legacy(prompt: str) -> tuple[Optional[str], Optional[str]]:
    """Fallback without search if google-genai or grounding fails."""
    import google.generativeai as genai

    genai.configure(api_key=settings.GEMINI_API_KEY)
    last_error: Optional[str] = None

    for model_name in _gemini_models_to_try():
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            text = _response_text(response)
            if text:
                return text, None
        except Exception as e:
            last_error = f"{model_name}: {e}"
            print(f"Gemini legacy error ({model_name}): {e}")

    return None, last_error


def _call_gemini(
    prompt: str, *, use_search: bool = True
) -> tuple[Optional[str], Optional[str], Optional[object]]:
    """Returns (text, error_detail, raw_response for grounding)."""
    if not _gemini_configured():
        return None, None, None

    if not use_search:
        try:
            text, err = _call_gemini_without_search(prompt)
            if text:
                return text, None, None
        except ImportError:
            print("google-genai not installed; using legacy Gemini client.")
        except Exception as e:
            print(f"Gemini (no search) client failed: {e}")
        text, err = _call_gemini_legacy(prompt)
        return text, err, None

    try:
        text, err, response = _call_gemini_with_search(prompt)
        if text:
            return text, None, response
    except ImportError:
        print("google-genai not installed; using legacy Gemini client without search.")
    except Exception as e:
        print(f"Gemini search client failed: {e}")

    text, err = _call_gemini_legacy(prompt)
    return text, err, None


def _stream_gemini_with_search(
    prompt: str, stream_meta: Optional[dict] = None
) -> Iterator[str]:
    client = _gemini_genai_client()
    config = _gemini_grounding_config()

    for model_name in _gemini_models_to_try():
        try:
            stream = client.models.generate_content_stream(
                model=model_name,
                contents=prompt,
                config=config,
            )
            yielded = False
            for chunk in stream:
                if stream_meta is not None:
                    stream_meta["last_chunk"] = chunk
                text = _stream_chunk_text(chunk)
                if text:
                    yielded = True
                    yield text
            if yielded:
                return
        except Exception as e:
            print(f"Gemini search stream error ({model_name}): {e}")


def _stream_gemini_legacy(prompt: str) -> Iterator[str]:
    import google.generativeai as genai

    genai.configure(api_key=settings.GEMINI_API_KEY)

    for model_name in _gemini_models_to_try():
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt, stream=True)
            yielded = False
            for chunk in response:
                text = _stream_chunk_text(chunk)
                if text:
                    yielded = True
                    yield text
            if yielded:
                return
        except Exception as e:
            print(f"Gemini legacy stream error ({model_name}): {e}")


def _stream_gemini(
    prompt: str, *, use_search: bool = True, stream_meta: Optional[dict] = None
) -> Iterator[str]:
    """Stream Gemini reply; uses Google Search grounding when enabled and available."""
    if not _gemini_configured():
        return

    if not use_search:
        streamed = False
        try:
            for piece in _stream_gemini_without_search(prompt):
                streamed = True
                yield piece
            if streamed:
                return
        except ImportError:
            print("google-genai not installed; streaming without search.")
        except Exception as e:
            print(f"Gemini (no search) stream failed: {e}")
        yield from _stream_gemini_legacy(prompt)
        return

    streamed = False
    try:
        for piece in _stream_gemini_with_search(prompt, stream_meta=stream_meta):
            streamed = True
            yield piece
        if streamed:
            return
    except ImportError:
        print("google-genai not installed; streaming without search.")
    except Exception as e:
        print(f"Gemini search stream failed: {e}")

    yield from _stream_gemini_legacy(prompt)


def extract_grounding_links(response) -> List[dict]:
    """
    Extract web source URLs and titles from Gemini grounding metadata.
    Returns [] if grounding metadata is absent or malformed.
    Never raises — all errors swallowed silently.
    """
    links: List[dict] = []
    try:
        chunks = (
            response.candidates[0]
            .grounding_metadata
            .grounding_chunks
        )
        for chunk in chunks:
            if hasattr(chunk, "web") and chunk.web.uri:
                links.append(
                    {
                        "url": chunk.web.uri,
                        "title": chunk.web.title or chunk.web.uri,
                    }
                )
    except Exception:
        pass
    return links[:5]


def _rag_confidence(rag_context: str, query: str) -> str:
    """
    Returns:
      "high"   — document clearly contains relevant answer
      "low"    — document has something but probably incomplete
      "none"   — document has nothing relevant
    """
    if not rag_context or len(rag_context.strip()) < 50:
        return "none"

    query_terms = set(query.lower().split())
    context_lower = rag_context.lower()

    matches = sum(
        1 for term in query_terms if len(term) > 3 and term in context_lower
    )
    coverage = matches / max(len([t for t in query_terms if len(t) > 3]), 1)

    if coverage >= 0.6:
        return "high"
    if coverage >= 0.2:
        return "low"
    return "none"


def _is_general_conversational_message(query: str) -> bool:
    """True for greetings, creative tasks, opinions — skip web search when no files."""
    msg_lower = query.lower().strip()
    if re.search(r"\b(?:hello|hi|hey|thanks|thank you|bye|goodbye|greetings)\b", msg_lower):
        return True
    if re.search(
        r"\b(?:write|create|draft|compose|brainstorm|imagine|story|poem|joke|roleplay)\b",
        msg_lower,
    ):
        return True
    if re.search(r"\b(?:what do you think|your opinion|how are you|who are you)\b", msg_lower):
        return True
    return False


def _is_factual_lookup(query: str) -> bool:
    """Heuristic: factual questions that benefit from web grounding."""
    if _is_general_conversational_message(query):
        return False
    msg_lower = query.lower().strip()
    factual_patterns = [
        r"\bwhat is\b",
        r"\bwho is\b",
        r"\bwhen (?:was|did)\b",
        r"\bwhere is\b",
        r"\bhow many\b",
        r"\bhow much\b",
        r"\bcapital of\b",
        r"\bdefine\b",
        r"\bexplain\b",
        r"\blatest\b",
        r"\bcurrent\b",
        r"\bprice of\b",
        r"\bcost of\b",
        r"\btell me about\b",
        r"\bscore\b",
    ]
    if any(re.search(p, msg_lower) for p in factual_patterns):
        return True
    if msg_lower.endswith("?"):
        return len(msg_lower.split()) <= 15
    return False


def _has_uploaded_files(db: Session, conversation_id: int) -> bool:
    return (
        db.query(UploadedFile)
        .filter(
            UploadedFile.conversation_id == conversation_id,
            UploadedFile.status == "processed",
        )
        .count()
        > 0
    )


def _get_searchable_file_ids(db: Session, conversation_id: int) -> List[str]:
    """Processed files that have current-version pgvector rows."""
    files = (
        db.query(UploadedFile)
        .filter(
            UploadedFile.conversation_id == conversation_id,
            UploadedFile.status == "processed",
        )
        .all()
    )
    return [
        f.id for f in files if vector_store_service.file_has_searchable_embeddings(db, f.id)
    ]


def _processed_filenames(db: Session, conversation_id: int) -> List[str]:
    return [
        row.filename
        for row in db.query(UploadedFile)
        .filter(
            UploadedFile.conversation_id == conversation_id,
            UploadedFile.status == "processed",
        )
        .all()
    ]


def _is_question_unrelated_to_documents(
    user_message: str,
    filenames: List[str],
) -> bool:
    """
    Heuristic: question is clearly outside uploaded documents (e.g. current events).
    Page queries and document references are always treated as related.
    """
    if vector_store_service.detect_page_query(user_message) is not None:
        return False

    msg = user_message.lower()
    doc_signals = (
        "document",
        "uploaded",
        "upload",
        "my file",
        "my pdf",
        "the pdf",
        "the catalog",
        "the catalogue",
        "in the doc",
        "from my",
        "page ",
        "this manual",
    )
    if any(signal in msg for signal in doc_signals):
        return False

    for filename in filenames:
        stem = Path(filename).stem.lower().replace("_", " ").replace("-", " ")
        if len(stem) > 3 and stem in msg:
            return False

    return _is_factual_lookup(user_message)


def _has_pending_files(db: Session, conversation_id: int) -> bool:
    return (
        db.query(UploadedFile)
        .filter(
            UploadedFile.conversation_id == conversation_id,
            UploadedFile.status.in_(("pending", "extracting", "embedding")),
        )
        .count()
        > 0
    )


def _append_history_to_prompt(
    prompt: str, history: List[Message], user_message: str
) -> str:
    for msg in history:
        prompt += f"{msg.role.capitalize()}: {msg.content}\n"
    prompt += f"User: {user_message}\nAssistant:"
    return prompt


def _finalize_prompt_with_history(
    body: str, history: List[Message], user_message: str
) -> str:
    if not history:
        return body
    history_block = "".join(f"{msg.role.capitalize()}: {msg.content}\n" for msg in history)
    marker = f"Question: {user_message}"
    if marker in body:
        return body.replace(marker, f"{history_block}{marker}\nAssistant:")
    return _append_history_to_prompt(body, history, user_message)


def _is_conversational(query: str) -> bool:
    """True if the query is general conversation that doesn't need web search."""
    q = query.lower().strip()
    return any(re.match(pattern, q) for pattern in CONVERSATIONAL_PATTERNS)


def _build_prompt_and_search_flag(
    rag_context: str, query: str
) -> Tuple[str, bool, str]:
    """
    Returns: (prompt, use_search, source).
    Never raises — falls back to web search on any internal error.
    """
    try:
        quality = classify_rag_context(rag_context, query)

        if quality == RAGQuality.DIRECT:
            return (
                f"""{DOCUMENT_ACCESS_OVERRIDE}

{MARKDOWN_INSTRUCTION}

DOCUMENT CONTENT (extracted from user's file):
═══════════════════════════════════════════════
{rag_context}
═══════════════════════════════════════════════

User question: {query}

Answer using ONLY the document content above.
Quote specific details. Reference page numbers using [Page X] markers when relevant.""",
                False,
                "document",
            )

        if quality == RAGQuality.PARTIAL:
            return (
                f"""{DOCUMENT_ACCESS_OVERRIDE}

{MARKDOWN_INSTRUCTION}

DOCUMENT CONTENT (extracted from user's file):
═══════════════════════════════════════════════
{rag_context}
═══════════════════════════════════════════════

The document has partial information.
First answer from the document content above, labeled "From your document:".
Then supplement with web search results, labeled "From the web:".

User question: {query}""",
                True,
                "both",
            )

        if quality == RAGQuality.DEFLECTED:
            return (
                f"""{DOCUMENT_ACCESS_OVERRIDE}

NOTE: The document contains disclaimers instead of direct answers.
Do NOT repeat these disclaimers.
Search the web and provide a direct, useful answer.
Begin with: "Your document doesn't cover this specifically — here's what I found online:"

{MARKDOWN_INSTRUCTION}

User question: {query}""",
                True,
                "web",
            )

        return (
            f"""You are Remi, a helpful assistant.

The uploaded document has no relevant information
about this topic. Search the web and provide a
thorough, helpful answer with specific details.

Begin with: "This isn't in your uploaded document —
here's what I found online:"

{MARKDOWN_INSTRUCTION}

Question: {query}""",
            True,
            "web",
        )
    except Exception:
        return (
            f"""You are Remi, a helpful assistant.
Search the web and answer the question thoroughly.

{MARKDOWN_INSTRUCTION}

Question: {query}""",
            True,
            "web",
        )


def _resolve_use_search(
    db: Session, conversation_id: int, rag_context: str, user_message: str
) -> bool:
    if _has_pending_files(db, conversation_id):
        return False
    if not _has_uploaded_files(db, conversation_id):
        return not _is_conversational(user_message)
    if vector_store_service.detect_page_query(user_message) is not None:
        return False
    if not (rag_context or "").strip():
        try:
            unrelated = _is_question_unrelated_to_documents(
                user_message, _processed_filenames(db, conversation_id)
            )
        except Exception:
            unrelated = _is_factual_lookup(user_message)
        return unrelated
    _, use_search, _ = _build_prompt_and_search_flag(rag_context, user_message)
    return use_search


def _page_not_found_message(
    page_num: int,
    db: Session,
    file_ids: List[str],
) -> str:
    max_indexed = vector_store_service.get_max_page_number(db, file_ids)
    pdf_total = vector_store_service.get_stored_pdf_page_count(db, file_ids)

    if pdf_total and page_num <= pdf_total and page_num > max_indexed:
        return (
            f"I couldn't read page {page_num} from your PDF. "
            f"Your file has {pdf_total} pages and {max_indexed} were indexed with readable text. "
            f"Page {page_num} may be image-only or failed during processing — try re-uploading the file."
        )

    if pdf_total and max_indexed > 0:
        return (
            f"I couldn't find page {page_num} in your uploaded document. "
            f"Your PDF has {pdf_total} pages; indexed content covers pages 1–{max_indexed}."
        )

    if max_indexed > 0:
        return (
            f"I couldn't find page {page_num} in your uploaded document. "
            f"The indexed content covers pages 1–{max_indexed}."
        )

    return (
        f"I couldn't find page {page_num} in your uploaded document. "
        "Try a different page number."
    )


def _document_miss_prompt(user_message: str) -> str:
    """Prompt when documents exist but no relevant chunks were retrieved."""
    return (
        f"""{DOCUMENT_ACCESS_OVERRIDE}

{MARKDOWN_INSTRUCTION}

The uploaded document has no retrieved sections matching this question.
Do NOT say you cannot access the user's document.
Tell the user you searched their file but this specific information was not found
in the retrieved sections. Suggest rephrasing or specifying a page number.

User question: {user_message}"""
    )


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
    links = getattr(assistant_message, "links", None) or []
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
            "cache_hit": bool(getattr(assistant_message, "cache_hit", False)),
            "source": getattr(assistant_message, "source", "document") or "document",
            "links": links,
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
    generated_content = generate_text(prompt, db=db, user_id=user_id)

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
) -> Tuple[Conversation, str, str, List[Message], Optional[str], str, bool, Optional[str]]:
    """Shared setup: auto-title, history, RAG, tiered Gemini prompt."""
    conv = get_conversation(db, conversation_id, user_id)

    _DEFAULT_TITLES = ("New Conversation", "New Chat", "Conversation")
    if conv.title and conv.title not in _DEFAULT_TITLES:
        pass
    elif not conv.title or conv.title in _DEFAULT_TITLES:
        conv.title = user_message[:40] + ("..." if len(user_message) > 40 else "")
        db.add(conv)
        db.commit()

    ordered = sorted(conv.messages, key=lambda m: m.created_at or datetime.min)
    history = ordered[-7:-1] if len(ordered) > 1 else []

    if _has_pending_files(db, conversation_id):
        return conv, "", "", history, None, "document", False, PENDING_DOCUMENT_MESSAGE

    file_ids = _get_searchable_file_ids(db, conversation_id)
    has_documents = _has_uploaded_files(db, conversation_id)
    rag_context = ""

    if has_documents:
        page_num = vector_store_service.detect_page_query(user_message)
        if page_num is not None and file_ids:
            page_context = vector_store_service.get_page_content(db, file_ids, page_num)
            if page_context:
                rag_context = page_context
                print(f"[RAG] Page {page_num} direct retrieval: {len(page_context)} chars")
            else:
                fixed = _page_not_found_message(page_num, db, file_ids)
                print(f"[RAG] Page {page_num} not found in indexed embeddings")
                return conv, "", "", history, None, "document", False, fixed

        if not rag_context:
            rag_context = build_rag_context(db, conversation_id, user_message)

    print(f"[RAG] conversation_id: {conversation_id}")
    print(f"[RAG] context length: {len(rag_context)}")
    if rag_context:
        print(f"[RAG] context preview: {rag_context[:200]}")

    if not has_documents:
        if _is_conversational(user_message):
            body = (
                "You are Remi, a helpful assistant.\n"
                "Answer the user's message conversationally and helpfully.\n"
                f"{MARKDOWN_INSTRUCTION}\n\n"
            )
            gemini_prompt = _append_history_to_prompt(body, history, user_message)
            return conv, gemini_prompt, "", history, None, "document", False, None

        body = (
            "You are Remi, a helpful assistant.\n"
            "Answer this question thoroughly using web search.\n"
            f"{MARKDOWN_INSTRUCTION}\n\n"
            f"Question: {user_message}"
        )
        gemini_prompt = _finalize_prompt_with_history(body, history, user_message)
        return conv, gemini_prompt, "", history, None, "web", True, None

    if rag_context:
        prompt_body, use_search, source = _build_prompt_and_search_flag(
            rag_context, user_message
        )
        gemini_prompt = _finalize_prompt_with_history(prompt_body, history, user_message)
        return conv, gemini_prompt, rag_context, history, None, source, use_search, None

    filenames = _processed_filenames(db, conversation_id)
    if _is_question_unrelated_to_documents(user_message, filenames):
        body = (
            "You are Remi, a helpful assistant.\n"
            "The user has uploaded documents, but this question is clearly outside them.\n"
            "Search the web and provide a thorough answer.\n"
            "Begin with: \"This isn't covered in your uploaded document — "
            "here's what I found online:\"\n"
            f"{MARKDOWN_INSTRUCTION}\n\n"
            f"Question: {user_message}"
        )
        gemini_prompt = _finalize_prompt_with_history(body, history, user_message)
        return conv, gemini_prompt, "", history, None, "web", True, None

    prompt_body = _document_miss_prompt(user_message)
    gemini_prompt = _finalize_prompt_with_history(prompt_body, history, user_message)
    return conv, gemini_prompt, "", history, None, "document", False, None


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
    if re.search(r"\b(?:hello|hi|hey|greetings)\b", msg_lower):
        return "Hello! I'm Remi. How can I help you today?"
    if re.search(r"\bhelp\b", msg_lower):
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
    if not settings.openai_configured():
        return ""
    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        system_prompt = (
            "You are Remi, a helpful AI assistant. Answer the user's questions directly "
            "and helpfully. Be concise and accurate. "
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
    db: Session, conversation_id: int, user_id: int, user_message: str,
    stream_meta: Optional[dict] = None,
) -> Iterator[str]:
    """Yield assistant reply text chunks (Gemini stream, or one-shot fallback/OpenAI)."""
    user_message = prepare_user_message(user_message)
    _conv, gemini_prompt, rag_context, history, _, source, use_search, fixed_response = (
        _prepare_assistant_context(db, conversation_id, user_id, user_message)
    )
    if stream_meta is not None:
        stream_meta["source"] = source
        stream_meta["use_search"] = use_search
        if fixed_response:
            stream_meta["fixed_response"] = fixed_response

    if fixed_response:
        yield fixed_response
        return

    cached = response_cache.get_cached_response(user_id, user_message, rag_context, use_search)
    if cached:
        yield cached
        return

    if _gemini_configured():
        streamed = False
        parts: List[str] = []
        for piece in _stream_gemini(
            gemini_prompt, use_search=use_search, stream_meta=stream_meta
        ):
            streamed = True
            parts.append(piece)
            yield piece
        if streamed:
            response_cache.set_cached_response(
                user_id, user_message, rag_context, use_search, "".join(parts)
            )
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
    user_message = prepare_user_message(user_message)
    pdf_topic = detect_pdf_request(user_message)
    if pdf_topic is not None:
        assistant_msg = _create_pdf_assistant_message(
            db, conversation_id, user_id, pdf_topic
        )
        yield format_sse_done(assistant_msg)
        return

    parts: List[str] = []
    stream_meta: dict = {}
    for piece in iter_assistant_chunks(
        db, conversation_id, user_id, user_message, stream_meta=stream_meta
    ):
        parts.append(piece)
        event = format_sse(piece)
        if event:
            yield event

    fixed_response = stream_meta.get("fixed_response")
    if fixed_response:
        assistant_msg = create_message(
            db,
            conversation_id,
            user_id,
            "assistant",
            fixed_response,
            source=stream_meta.get("source", "document"),
            links=[],
        )
        yield format_sse_done(assistant_msg)
        return

    assistant_content = "".join(parts).strip()
    source = stream_meta.get("source", "document")
    use_search = stream_meta.get("use_search", False)
    links: List[dict] = []

    if use_search and stream_meta.get("last_chunk") is not None:
        links = extract_grounding_links(stream_meta["last_chunk"])

    if not assistant_content:
        assistant_content = _fallback_assistant_content(user_message, "", None)

    if source in ("web", "both") and not assistant_content.strip():
        assistant_content = NOT_FOUND_MESSAGE
        source = "none"
        links = []

    assistant_msg = create_message(
        db,
        conversation_id,
        user_id,
        "assistant",
        assistant_content,
        source=source,
        links=links,
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


def require_conversation_access(
    db: Session, conversation_id: int, user_id: int
) -> Conversation:
    """Return a conversation or raise 404/403 without leaking cross-user ownership."""
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    if conv.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this conversation",
        )
    return conv


def get_conversation(db: Session, conversation_id: int, user_id: int) -> Conversation:
    """Retrieve a specific conversation, verifying it belongs to the user."""
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id,
    ).first()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    return conv


def list_conversations(db: Session, user_id: int) -> List[Conversation]:
    """List all conversations for a user, newest first."""
    return (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.created_at.desc(), Conversation.id.desc())
        .all()
    )


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
    cache_hit: bool = False,
    source: str = "document",
    links: Optional[List[dict]] = None,
) -> Message:
    """Create a new message in a conversation after verifying user ownership."""
    get_conversation(db, conversation_id, user_id)

    if role == "user":
        content = prepare_user_message(content)

    db_msg = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        has_pdf=has_pdf,
        pdf_content=pdf_content,
        pdf_filename=pdf_filename,
        source=source,
        links=links or [],
    )
    db.add(db_msg)
    db.commit()
    db.refresh(db_msg)
    if cache_hit:
        setattr(db_msg, "cache_hit", True)
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
    Retrieve the most relevant document chunks for the user message via vector search.
    Returns an empty string if no processed files exist for this conversation.
    """
    try:
        files = db.query(UploadedFile).filter(
            UploadedFile.conversation_id == conversation_id,
            UploadedFile.status == "processed",
        ).all()
        print(f"[RAG] processed files found: {len(files)}")
        for f in files:
            print(f"[RAG] file: {f.id} | {f.filename} | {f.status}")

        if not files:
            print(f"[RAG] No processed files for {conversation_id}")
            return ""

        searchable = [
            f for f in files if vector_store_service.file_has_searchable_embeddings(db, f.id)
        ]
        if not searchable:
            print(
                f"[RAG] {len(files)} processed file(s) but none have searchable embeddings "
                "(re-upload required)"
            )
            return ""

        file_ids = [f.id for f in searchable]
        print(f"[RAG] Searching {len(file_ids)} files with embeddings")

        top_k = (
            vector_store_service.PAGE_QUERY_TOP_K
            if vector_store_service._extract_page_number(user_message)
            else 5
        )
        chunks = vector_store_service.search(file_ids, user_message, top_k=top_k, db=db)
        if not chunks:
            print(f"[RAG] No chunks returned from search for query: {user_message!r}")
            return ""

        print(f"[RAG] Retrieved {len(chunks)} chunks ({sum(len(c) for c in chunks)} chars)")
        return "\n\n".join(chunks)
    except Exception as e:
        print(f"[RAG] Error building context: {e}")
        import traceback

        traceback.print_exc()
        return ""


def generate_assistant_response(db: Session, conversation_id: int, user_id: int, user_message: str) -> Message:
    """Generate assistant response using Gemini, OpenAI, or a smart local fallback."""
    user_message = prepare_user_message(user_message)
    pdf_topic = detect_pdf_request(user_message)
    if pdf_topic is not None:
        return _create_pdf_assistant_message(db, conversation_id, user_id, pdf_topic)

    _conv, gemini_prompt, rag_context, history, _, source, use_search, fixed_response = (
        _prepare_assistant_context(db, conversation_id, user_id, user_message)
    )

    if fixed_response:
        return create_message(
            db,
            conversation_id,
            user_id,
            "assistant",
            fixed_response,
            source=source,
            links=[],
        )

    assistant_content = ""
    gemini_error: Optional[str] = None
    links: List[dict] = []

    cached = response_cache.get_cached_response(user_id, user_message, rag_context, use_search)
    if cached:
        return create_message(
            db,
            conversation_id,
            user_id,
            "assistant",
            cached,
            cache_hit=True,
            source=source,
            links=[],
        )

    if _gemini_configured():
        assistant_content, gemini_error, response = _call_gemini(
            gemini_prompt, use_search=use_search
        )
        if assistant_content is None:
            assistant_content = ""
        if use_search and response is not None:
            links = extract_grounding_links(response)

    if not assistant_content:
        assistant_content = _openai_assistant_content(history, user_message, rag_context)

    if not assistant_content:
        assistant_content = _fallback_assistant_content(
            user_message, rag_context, gemini_error
        )

    if source in ("web", "both") and not assistant_content.strip():
        assistant_content = NOT_FOUND_MESSAGE
        source = "none"
        links = []

    if (
        not assistant_content.strip()
        and source == "document"
        and not (rag_context or "").strip()
    ):
        assistant_content = NOT_FOUND_MESSAGE
        source = "none"

    if assistant_content and _gemini_configured():
        response_cache.set_cached_response(
            user_id, user_message, rag_context, use_search, assistant_content
        )

    return create_message(
        db,
        conversation_id,
        user_id,
        "assistant",
        assistant_content,
        source=source,
        links=links,
    )


def generate_text(
    prompt: str,
    *,
    db: Optional[Session] = None,
    user_id: Optional[int] = None,
) -> str:
    """Generate text from a one-shot prompt via Gemini, with OpenAI fallback."""
    content = ""
    if _gemini_configured():
        if db is not None and user_id is not None:
            quota_service.check_and_consume_gemini_quota(db, user_id)
        content, _, _ = _call_gemini(prompt)
        content = (content or "").strip()

    if not content and settings.openai_configured():
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
    content = generate_text(prompt, db=db, user_id=user_id)

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
