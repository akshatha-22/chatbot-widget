"""Per-user daily Gemini API quota."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database.db import GeminiDailyUsage


class QuotaExceededError(Exception):
    def __init__(self, retry_after_seconds: int):
        self.retry_after_seconds = retry_after_seconds
        super().__init__(f"Daily quota exceeded; retry in {retry_after_seconds}s")


def _utc_date() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def utc_midnight_reset_at() -> datetime:
    """UTC timestamp when the daily Gemini quota resets."""
    now = datetime.now(timezone.utc)
    return (now + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )


def seconds_until_utc_midnight() -> int:
    now = datetime.now(timezone.utc)
    return max(1, int((utc_midnight_reset_at() - now).total_seconds()))


def check_and_consume_gemini_quota(db: Session, user_id: int) -> None:
    """Increment today's Gemini usage or raise QuotaExceededError."""
    limit = settings.GEMINI_DAILY_QUOTA_PER_USER
    if limit <= 0:
        return

    usage_date = _utc_date()
    row = (
        db.query(GeminiDailyUsage)
        .filter(
            GeminiDailyUsage.user_id == user_id,
            GeminiDailyUsage.usage_date == usage_date,
        )
        .first()
    )

    current = row.call_count if row else 0
    if current >= limit:
        raise QuotaExceededError(seconds_until_utc_midnight())

    if row:
        row.call_count = current + 1
    else:
        db.add(
            GeminiDailyUsage(
                user_id=user_id,
                usage_date=usage_date,
                call_count=1,
            )
        )
    db.commit()


def raise_http_quota_exceeded(exc: QuotaExceededError) -> None:
    reset_at = utc_midnight_reset_at()
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "message": (
                f"Daily Gemini limit reached ({settings.GEMINI_DAILY_QUOTA_PER_USER} calls per day). "
                "Please wait before sending more messages."
            ),
            "retry_after_seconds": exc.retry_after_seconds,
            "reset_at": reset_at.isoformat().replace("+00:00", "Z"),
        },
        headers={"Retry-After": str(exc.retry_after_seconds)},
    )
