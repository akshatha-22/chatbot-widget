"""In-process TTL cache for repeated assistant questions (no Redis)."""

from __future__ import annotations

import hashlib
from typing import Optional, Tuple, Union

from cachetools import TTLCache

from app.config import settings

_cache: Optional[TTLCache] = None

CacheKey = Tuple[int, str, str, int]


def normalize_question(text: str) -> str:
    """Lowercase and collapse whitespace for cache lookups."""
    return " ".join((text or "").strip().lower().split())


def make_cache_key(
    user_id: int, user_message: str, rag_context: str, use_search: bool
) -> CacheKey:
    normalized = normalize_question(user_message)
    rag_digest = hashlib.sha256((rag_context or "").encode("utf-8")).hexdigest()[:24]
    return (user_id, normalized, rag_digest, int(use_search))


def get_cached_response(
    user_id: int, user_message: str, rag_context: str, use_search: bool
) -> Optional[str]:
    if not settings.RESPONSE_CACHE_ENABLED:
        return None
    key = make_cache_key(user_id, user_message, rag_context, use_search)
    return _get_cache().get(key)


def set_cached_response(
    user_id: int,
    user_message: str,
    rag_context: str,
    use_search: bool,
    response: str,
) -> None:
    if not settings.RESPONSE_CACHE_ENABLED:
        return
    text = (response or "").strip()
    if not text:
        return
    key = make_cache_key(user_id, user_message, rag_context, use_search)
    _get_cache()[key] = text


def _get_cache() -> TTLCache:
    global _cache
    if _cache is None:
        _cache = TTLCache(
            maxsize=settings.RESPONSE_CACHE_MAX_SIZE,
            ttl=settings.RESPONSE_CACHE_TTL_SECONDS,
        )
    return _cache


def clear_cache() -> None:
    """Drop all cached entries (used in tests)."""
    global _cache
    _cache = None
