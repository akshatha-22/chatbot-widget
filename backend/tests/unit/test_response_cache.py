"""Unit tests for per-user response cache keys."""

from app.services import response_cache


def test_cache_keys_are_scoped_by_user_id(monkeypatch):
    monkeypatch.setattr("app.config.settings.RESPONSE_CACHE_ENABLED", True)
    response_cache.clear_cache()

    response_cache.set_cached_response(
        1, "What is Remi?", "", True, "User one answer"
    )
    response_cache.set_cached_response(
        2, "What is Remi?", "", True, "User two answer"
    )

    assert response_cache.get_cached_response(1, "What is Remi?", "", True) == "User one answer"
    assert response_cache.get_cached_response(2, "What is Remi?", "", True) == "User two answer"


def test_cache_key_normalizes_whitespace_and_case(monkeypatch):
    monkeypatch.setattr("app.config.settings.RESPONSE_CACHE_ENABLED", True)
    response_cache.clear_cache()

    response_cache.set_cached_response(5, "  Hello   World  ", "", False, "cached")
    assert response_cache.get_cached_response(5, "hello world", "", False) == "cached"
