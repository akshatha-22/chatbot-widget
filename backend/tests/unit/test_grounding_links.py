"""Unit tests for Gemini grounding link extraction."""

from types import SimpleNamespace

from app.services import chat_service


class _WebChunk:
    def __init__(self, uri: str, title: str | None = None):
        self.web = SimpleNamespace(uri=uri, title=title)


def test_valid_grounding_metadata_returns_url_and_title():
    response = SimpleNamespace(
        candidates=[
            SimpleNamespace(
                grounding_metadata=SimpleNamespace(
                    grounding_chunks=[_WebChunk("https://example.com", "Example")]
                )
            )
        ]
    )
    links = chat_service.extract_grounding_links(response)
    assert links == [{"url": "https://example.com", "title": "Example"}]


def test_missing_metadata_returns_empty_list():
    assert chat_service.extract_grounding_links(None) == []
    assert chat_service.extract_grounding_links(object()) == []


def test_chunk_without_web_uri_is_skipped():
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
    assert chat_service.extract_grounding_links(response) == [
        {"url": "https://ok.example", "title": "OK"}
    ]


def test_more_than_five_chunks_capped_at_five():
    chunks = [_WebChunk(f"https://example.com/{i}", f"T{i}") for i in range(8)]
    response = SimpleNamespace(
        candidates=[
            SimpleNamespace(
                grounding_metadata=SimpleNamespace(grounding_chunks=chunks)
            )
        ]
    )
    assert len(chat_service.extract_grounding_links(response)) == 5


def test_corrupted_response_returns_empty_list():
    class BadCandidates:
        def __getitem__(self, _index):
            raise TypeError("corrupt")

    assert chat_service.extract_grounding_links(SimpleNamespace(candidates=BadCandidates())) == []
