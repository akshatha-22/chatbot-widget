"""In-memory per-IP rate limiting for auth routes (no Redis)."""

from __future__ import annotations

import threading
import time
from typing import Dict, List, Tuple

from fastapi import HTTPException, status

from app.config import settings

_lock = threading.Lock()
_attempts: Dict[str, List[float]] = {}


def _window_seconds() -> int:
    return max(1, settings.AUTH_RATE_LIMIT_WINDOW_SECONDS)


def _max_attempts() -> int:
    return max(1, settings.AUTH_RATE_LIMIT_MAX_ATTEMPTS)


def _prune(bucket: List[float], now: float) -> List[float]:
    cutoff = now - _window_seconds()
    return [ts for ts in bucket if ts >= cutoff]


def _retry_after_seconds(bucket: List[float], now: float) -> int:
    if not bucket:
        return _window_seconds()
    oldest = min(bucket)
    return max(1, int(_window_seconds() - (now - oldest)))


def is_rate_limited(scope: str, ip: str) -> Tuple[bool, int]:
    """Return whether the IP is locked out for this auth scope and retry-after seconds."""
    if not settings.AUTH_RATE_LIMIT_ENABLED:
        return False, 0

    key = f"{scope}:{ip}"
    now = time.monotonic()
    with _lock:
        bucket = _prune(_attempts.get(key, []), now)
        _attempts[key] = bucket
        if len(bucket) >= _max_attempts():
            return True, _retry_after_seconds(bucket, now)
    return False, 0


def record_failed_attempt(scope: str, ip: str) -> None:
    """Record a failed auth attempt for the IP."""
    if not settings.AUTH_RATE_LIMIT_ENABLED:
        return

    key = f"{scope}:{ip}"
    now = time.monotonic()
    with _lock:
        bucket = _prune(_attempts.get(key, []), now)
        bucket.append(now)
        _attempts[key] = bucket


def reset_attempts(scope: str, ip: str) -> None:
    """Clear attempts after a successful auth action."""
    key = f"{scope}:{ip}"
    with _lock:
        _attempts.pop(key, None)


def raise_http_rate_limited(scope: str, ip: str) -> None:
    """Raise HTTP 429 if the IP is currently rate-limited."""
    limited, retry_after = is_rate_limited(scope, ip)
    if not limited:
        return
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "message": "Too many authentication attempts. Please try again later.",
            "retry_after_seconds": retry_after,
        },
        headers={"Retry-After": str(retry_after)},
    )


def clear_rate_limits() -> None:
    """Drop all counters (used in tests)."""
    with _lock:
        _attempts.clear()
