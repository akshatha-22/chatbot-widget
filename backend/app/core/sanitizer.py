"""User message sanitization for prompt-injection mitigation."""

from __future__ import annotations

import logging
import re
from typing import Pattern

from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

_INJECTION_PATTERNS: tuple[Pattern[str], ...] = (
    re.compile(
        r"ignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+instructions",
        re.IGNORECASE,
    ),
    re.compile(r"disregard\s+(?:all\s+)?(?:previous|prior|above)\s+instructions", re.IGNORECASE),
    re.compile(r"you\s+are\s+now", re.IGNORECASE),
    re.compile(r"^\s*system\s*:", re.IGNORECASE | re.MULTILINE),
    re.compile(r"<\|im_start\|>", re.IGNORECASE),
    re.compile(r"<\|im_end\|>", re.IGNORECASE),
    re.compile(r"\{\{[^{}]*\}\}"),
)

_REPEATED_CHAR_PATTERN = re.compile(r"(.)\1{4,}")


def _strip_injection_patterns(text: str) -> str:
    cleaned = text
    for pattern in _INJECTION_PATTERNS:
        cleaned = pattern.sub("", cleaned)
    cleaned = _REPEATED_CHAR_PATTERN.sub(r"\1\1\1\1", cleaned)
    return cleaned.strip()


def sanitize_message(text: str) -> str:
    """
    Remove common prompt-injection patterns and collapse excessive repeated characters.

    Returns the cleaned message. Raises HTTP 400 if nothing substantive remains.
    """
    if not text or not text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty.",
        )

    cleaned = _strip_injection_patterns(text)
    if cleaned != text.strip():
        logger.info(
            "Sanitized user message (len %d -> %d)",
            len(text.strip()),
            len(cleaned),
        )
    if not cleaned:
        logger.warning("Rejected message containing only injection patterns")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Message was rejected because it contains only disallowed "
                "prompt-injection patterns."
            ),
        )
    return cleaned
