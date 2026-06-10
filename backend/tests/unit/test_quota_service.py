"""Unit tests for Gemini daily quota UTC reset."""

from datetime import datetime, timezone

from app.services import quota_service


def test_utc_date_uses_calendar_day_not_rolling_window():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    assert quota_service._utc_date() == today


def test_seconds_until_utc_midnight_is_positive():
    assert quota_service.seconds_until_utc_midnight() > 0


def test_utc_midnight_reset_at_is_next_utc_midnight():
    reset_at = quota_service.utc_midnight_reset_at()
    now = datetime.now(timezone.utc)
    assert reset_at > now
    assert reset_at.hour == 0
    assert reset_at.minute == 0
    assert reset_at.second == 0
