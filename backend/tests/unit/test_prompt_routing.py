"""Unit tests for prompt routing based on RAG quality."""

from unittest.mock import patch

from app.services import chat_service


DIRECT_CONTEXT = (
    "Machine learning algorithm training uses labeled data sets for model "
    "optimization, evaluation metrics, and validation pipelines."
)


def test_direct_sets_document_source_and_no_search():
    prompt, use_search, source = chat_service._build_prompt_and_search_flag(
        DIRECT_CONTEXT, "What is machine learning algorithm training?"
    )
    assert use_search is False
    assert source == "document"
    assert "SYSTEM OVERRIDE" in prompt
    assert "DOCUMENT CONTENT" in prompt


def test_partial_sets_both_source_and_search():
    context = (
        "Machine learning overview for beginners with general background "
        "information about technology trends in modern software."
    )
    prompt, use_search, source = chat_service._build_prompt_and_search_flag(
        context, "What is machine learning algorithm training?"
    )
    assert use_search is True
    assert source == "both"
    assert "From your document:" in prompt


def test_deflected_sets_web_and_ignores_disclaimers():
    context = (
        "We cannot list all products due to volume. "
        "Please contact our sales team for more information contact details."
    )
    prompt, use_search, source = chat_service._build_prompt_and_search_flag(
        context, "list all brake parts"
    )
    assert use_search is True
    assert source == "web"
    assert "do not repeat" in prompt.lower()


def test_empty_sets_web_source():
    prompt, use_search, source = chat_service._build_prompt_and_search_flag(
        "", "What is quantum entanglement?"
    )
    assert use_search is True
    assert source == "web"
    assert "isn't in your uploaded document" in prompt


@patch("app.services.chat_service._has_uploaded_files", return_value=False)
@patch("app.services.chat_service._has_pending_files", return_value=False)
def test_no_files_conversational_skips_web_search(_pending, _files):
    assert chat_service._is_conversational("Hello Remi") is True
    assert chat_service._resolve_use_search(
        db=object(),
        conversation_id=1,
        rag_context="",
        user_message="Hello Remi",
    ) is False


@patch("app.services.chat_service._has_uploaded_files", return_value=False)
@patch("app.services.chat_service._has_pending_files", return_value=False)
def test_no_files_factual_uses_web_search(_pending, _files):
    assert chat_service._resolve_use_search(
        db=None,  # type: ignore[arg-type]
        conversation_id=1,
        rag_context="",
        user_message="What is the capital of France?",
    ) is True


@patch("app.services.chat_service._gemini_configured", return_value=True)
@patch("app.services.chat_service._call_gemini")
@patch("app.services.chat_service._has_pending_files", return_value=True)
@patch("app.services.chat_service._has_uploaded_files", return_value=False)
@patch("app.services.chat_service.build_rag_context", return_value="")
def test_pending_files_returns_processing_message_without_llm(
    mock_rag, mock_files, mock_pending, mock_gemini, _mock_cfg, client, auth_headers, conversation_id
):
    response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={"content": "What is in my document?"},
    )
    assert response.status_code == 200
    assistant = response.json()[1]
    assert chat_service.PENDING_DOCUMENT_MESSAGE in assistant["content"]
    assert assistant["source"] == "document"
    mock_gemini.assert_not_called()
