"""Unit tests for RAG context quality classification."""

from unittest.mock import patch

from app.services.rag_quality_service import RAGQuality, classify_rag_context


DIRECT_CONTEXT = (
    "Machine learning algorithm training uses labeled data sets for model "
    "optimization, evaluation metrics, and validation pipelines."
)


def test_direct_when_sixty_percent_query_terms_match():
    query = "What is machine learning algorithm training?"
    assert classify_rag_context(DIRECT_CONTEXT, query) == RAGQuality.DIRECT


def test_partial_when_twenty_to_fifty_nine_percent_coverage():
    context = (
        "Machine learning overview for beginners with general background "
        "information about technology trends in modern software."
    )
    query = "What is machine learning algorithm training?"
    assert classify_rag_context(context, query) == RAGQuality.PARTIAL


def test_empty_when_context_under_thirty_chars():
    assert classify_rag_context("short", "what is machine learning") == RAGQuality.EMPTY


def test_deflected_when_two_plus_deflection_phrases():
    context = (
        "We cannot list all products due to volume. "
        "Please contact our sales team for more information contact details."
    )
    assert classify_rag_context(context, "list all brake parts") == RAGQuality.DEFLECTED


def test_contact_us_and_unable_to_list_is_deflected():
    context = (
        "We are unable to list every item online. "
        "Please contact us to enquire about availability."
    )
    assert classify_rag_context(context, "BP-4821 price") == RAGQuality.DEFLECTED


def test_empty_string_returns_empty():
    assert classify_rag_context("", "anything") == RAGQuality.EMPTY


def test_exception_in_classifier_returns_empty():
    with patch("app.services.rag_quality_service.sum", side_effect=RuntimeError("boom")):
        assert (
            classify_rag_context("long enough context for classification", "query terms")
            == RAGQuality.EMPTY
        )
