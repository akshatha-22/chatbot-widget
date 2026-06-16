"""Tests for embedding model config normalization."""

from app.config import Settings


def test_retired_embedding_model_maps_to_gemini_embedding_001():
    settings = Settings(EMBEDDING_MODEL="text-embedding-004")
    assert settings.EMBEDDING_MODEL == "gemini-embedding-001"


def test_unknown_embedding_model_maps_to_gemini_embedding_001():
    settings = Settings(EMBEDDING_MODEL="some-other-model")
    assert settings.EMBEDDING_MODEL == "gemini-embedding-001"
