"""Unit tests for universal two-tier retrieval and grounding link extraction."""

from types import SimpleNamespace
from unittest.mock import patch

from app.services import chat_service


class _WebChunk:
    def __init__(self, uri: str, title: str | None = None):
        self.web = SimpleNamespace(uri=uri, title=title)


HIGH_CONFIDENCE_CONTEXT = (
    "Machine learning algorithm training uses labeled data sets for model "
    "optimization, evaluation metrics, and validation pipelines."
)


def test_rag_confidence_high_when_sixty_percent_terms_match():
    query = "What is machine learning algorithm training?"
    assert chat_service._rag_confidence(HIGH_CONFIDENCE_CONTEXT, query) == "high"


def test_rag_confidence_low_when_partial_term_overlap():
    context = (
        "Machine learning overview for beginners with general background "
        "information about technology trends in modern software."
    )
    query = "What is machine learning algorithm training?"
    assert chat_service._rag_confidence(context, query) == "low"


def test_rag_confidence_none_when_context_under_fifty_chars():
    assert chat_service._rag_confidence("short", "what is machine learning") == "none"
    assert chat_service._rag_confidence("", "anything") == "none"


def test_extract_grounding_links_returns_empty_when_metadata_absent():
    assert chat_service.extract_grounding_links(None) == []
    assert chat_service.extract_grounding_links(object()) == []


def test_extract_grounding_links_caps_at_five():
    chunks = [_WebChunk(f"https://example.com/{i}", f"Title {i}") for i in range(8)]
    response = SimpleNamespace(
        candidates=[
            SimpleNamespace(
                grounding_metadata=SimpleNamespace(grounding_chunks=chunks)
            )
        ]
    )
    links = chat_service.extract_grounding_links(response)
    assert len(links) == 5
    assert links[0]["url"] == "https://example.com/0"


def test_extract_grounding_links_skips_chunks_without_uri():
    chunks = [
        _WebChunk("https://ok.example", "OK"),
        SimpleNamespace(web=SimpleNamespace(uri=None, title="Missing")),
    ]
    response = SimpleNamespace(
        candidates=[
            SimpleNamespace(
                grounding_metadata=SimpleNamespace(grounding_chunks=chunks)
            )
        ]
    )
    links = chat_service.extract_grounding_links(response)
    assert links == [{"url": "https://ok.example", "title": "OK"}]


@patch("app.services.chat_service._gemini_configured", return_value=True)
@patch("app.services.chat_service._call_gemini")
@patch("app.services.chat_service._openai_assistant_content", return_value="")
@patch("app.services.chat_service.build_rag_context", return_value=HIGH_CONFIDENCE_CONTEXT)
def test_high_confidence_sets_document_source(
    mock_rag, mock_openai, mock_gemini, _mock_cfg, client, auth_headers, conversation_id
):
    mock_gemini.return_value = ("Answer from document", None, None)

    response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={"content": "What is machine learning algorithm training?"},
    )
    assert response.status_code == 200
    assistant = response.json()[1]
    assert assistant["source"] == "document"
    assert assistant["links"] == []
    mock_gemini.assert_called_once()
    assert mock_gemini.call_args.kwargs["use_search"] is False


@patch("app.services.chat_service._has_uploaded_files", return_value=True)
@patch("app.services.chat_service._gemini_configured", return_value=True)
@patch("app.services.chat_service._call_gemini")
@patch("app.services.chat_service._openai_assistant_content", return_value="")
@patch(
    "app.services.chat_service.build_rag_context",
    return_value=(
        "Machine learning overview for beginners with general background "
        "information about technology trends in modern software."
    ),
)
def test_low_confidence_sets_both_source(
    mock_rag, mock_openai, mock_gemini, _mock_cfg, _mock_files, client, auth_headers, conversation_id
):
    mock_gemini.return_value = ("Combined answer", None, SimpleNamespace(candidates=[]))

    response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={"content": "What is machine learning algorithm training?"},
    )
    assert response.status_code == 200
    assistant = response.json()[1]
    assert assistant["source"] == "both"
    assert mock_gemini.call_args.kwargs["use_search"] is True


@patch("app.services.chat_service._has_uploaded_files", return_value=True)
@patch("app.services.chat_service._gemini_configured", return_value=True)
@patch("app.services.chat_service._call_gemini")
@patch("app.services.chat_service._openai_assistant_content", return_value="")
@patch("app.services.chat_service.build_rag_context", return_value="")
def test_empty_rag_with_files_sets_web_source(
    mock_rag, mock_openai, mock_gemini, _mock_cfg, _mock_files, client, auth_headers, conversation_id
):
    mock_gemini.return_value = ("Web answer", None, SimpleNamespace(candidates=[]))

    response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={"content": "What is quantum entanglement theory?"},
    )
    assert response.status_code == 200
    assistant = response.json()[1]
    assert assistant["source"] == "web"
    assert mock_gemini.call_args.kwargs["use_search"] is True


@patch("app.services.chat_service._gemini_configured", return_value=False)
@patch("app.services.chat_service._openai_assistant_content", return_value="")
@patch("app.services.chat_service._fallback_assistant_content", return_value="")
@patch("app.services.chat_service._has_uploaded_files", return_value=True)
@patch("app.services.chat_service.build_rag_context", return_value="")
def test_both_empty_sets_none_without_gemini_call(
    mock_rag, mock_files, mock_fallback, mock_openai, _mock_cfg, client, auth_headers, conversation_id
):
    with patch("app.services.chat_service._call_gemini") as mock_gemini:
        response = client.post(
            f"/api/v1/chat/conversations/{conversation_id}/messages",
            headers=auth_headers,
            json={"content": "What is unknown topic ZZZ-999?"},
        )
        assert response.status_code == 200
        assistant = response.json()[1]
        assert assistant["source"] == "none"
        assert chat_service.NOT_FOUND_MESSAGE in assistant["content"]
        mock_gemini.assert_not_called()


@patch("app.services.chat_service._gemini_configured", return_value=True)
@patch("app.services.chat_service._call_gemini")
@patch("app.services.chat_service._openai_assistant_content", return_value="")
@patch("app.services.chat_service._has_uploaded_files", return_value=False)
@patch("app.services.chat_service.build_rag_context", return_value="")
def test_general_chat_without_files_uses_document_source(
    mock_rag, mock_files, mock_openai, mock_gemini, _mock_cfg, client, auth_headers, conversation_id
):
    mock_gemini.return_value = ("Hello there!", None, None)

    response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={"content": "Hello Remi"},
    )
    assert response.status_code == 200
    assistant = response.json()[1]
    assert assistant["source"] == "document"
    assert mock_gemini.call_args.kwargs["use_search"] is False
