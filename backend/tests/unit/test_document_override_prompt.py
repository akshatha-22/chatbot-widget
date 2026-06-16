"""Unit tests for document access override prompts."""

from app.services import chat_service
from app.services.rag_quality_service import RAGQuality


DIRECT_CONTEXT = (
    "Machine learning algorithm training uses labeled data sets for model "
    "optimization, evaluation metrics, and validation pipelines."
)


def test_direct_prompt_contains_system_override():
    prompt, use_search, source = chat_service._build_prompt_and_search_flag(
        DIRECT_CONTEXT, "What is machine learning algorithm training?"
    )
    assert use_search is False
    assert source == "document"
    assert "SYSTEM OVERRIDE" in prompt
    assert "[Page X]" in prompt or "Page X" in prompt


def test_partial_prompt_contains_doc_and_web_labels():
    context = "Machine learning overview for beginners with general background."
    prompt, use_search, source = chat_service._build_prompt_and_search_flag(
        context, "What is machine learning algorithm training?"
    )
    assert use_search is True
    assert source == "both"
    assert "From your document:" in prompt
    assert "From the web:" in prompt
    assert "SYSTEM OVERRIDE" in prompt


def test_deflected_prompt_says_do_not_repeat_disclaimers():
    context = (
        "We cannot list all products. Please contact our sales team for details."
    )
    prompt, use_search, source = chat_service._build_prompt_and_search_flag(
        context, "list all brake parts"
    )
    assert use_search is True
    assert source == "web"
    assert "Do NOT repeat" in prompt


def test_empty_prompt_has_no_system_override():
    prompt, use_search, source = chat_service._build_prompt_and_search_flag(
        "", "What is quantum entanglement?"
    )
    assert use_search is True
    assert source == "web"
    assert "SYSTEM OVERRIDE" not in prompt
    assert "isn't in your uploaded document" in prompt
