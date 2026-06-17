"""Shared Gemini API error helpers."""

from __future__ import annotations


def is_quota_exhausted(exc: BaseException) -> bool:
    """True when Gemini returned 429 / RESOURCE_EXHAUSTED."""
    text = str(exc).upper()
    return "429" in text or "RESOURCE_EXHAUSTED" in text or "QUOTA" in text


def quota_exhausted_message(exc: BaseException | str, *, context: str = "API") -> str:
    detail = str(exc)
    return (
        f"Gemini {context} quota exceeded (429). Your API key hit Google's free-tier "
        f"daily limit — embedding and OCR cannot complete until the quota resets "
        f"(typically midnight Pacific) or billing is enabled. "
        f"See https://ai.google.dev/gemini-api/docs/rate-limits. Detail: {detail[:400]}"
    )
