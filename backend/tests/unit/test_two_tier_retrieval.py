"""Unit tests for two-tier retrieval and grounding link extraction."""

from types import SimpleNamespace
from unittest.mock import patch

from app.services import chat_service


class _WebChunk:
    def __init__(self, uri: str, title: str | None = None):
        self.web = SimpleNamespace(uri=uri, title=title)


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
@patch("app.services.chat_service.build_rag_context", return_value="catalog chunk")
def test_rag_hit_sets_catalog_source(mock_rag, mock_openai, mock_gemini, _mock_cfg, client, auth_headers, conversation_id):
    mock_gemini.return_value = ("Answer from catalog", None, None)

    response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={"content": "What is BP-4821?"},
    )
    assert response.status_code == 200
    assistant = response.json()[1]
    assert assistant["source"] == "catalog"
    assert assistant["links"] == []
    mock_gemini.assert_called_once()
    assert mock_gemini.call_args.kwargs["use_search"] is False


@patch("app.services.chat_service._gemini_configured", return_value=True)
@patch("app.services.chat_service._call_gemini")
@patch("app.services.chat_service._openai_assistant_content", return_value="")
@patch("app.services.chat_service.build_rag_context", return_value="")
def test_rag_miss_sets_web_source(mock_rag, mock_openai, mock_gemini, _mock_cfg, client, auth_headers, conversation_id):
    mock_gemini.return_value = ("Web answer", None, SimpleNamespace(candidates=[]))

    response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={"content": "What is unknown part ZZZ?"},
    )
    assert response.status_code == 200
    assistant = response.json()[1]
    assert assistant["source"] == "web"
    assert mock_gemini.call_args.kwargs["use_search"] is True


@patch("app.services.chat_service._gemini_configured", return_value=True)
@patch("app.services.chat_service._call_gemini", return_value=("", None, None))
@patch("app.services.chat_service._openai_assistant_content", return_value="")
@patch("app.services.chat_service._fallback_assistant_content", return_value="")
@patch("app.services.chat_service.build_rag_context", return_value="")
def test_both_empty_sets_none_source(
    mock_rag, mock_fallback, mock_openai, mock_gemini, _mock_cfg, client, auth_headers, conversation_id
):
    response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers,
        json={"content": "totally unknown item"},
    )
    assert response.status_code == 200
    assistant = response.json()[1]
    assert assistant["source"] == "none"
    assert chat_service.NOT_FOUND_CATALOG_MESSAGE in assistant["content"]
