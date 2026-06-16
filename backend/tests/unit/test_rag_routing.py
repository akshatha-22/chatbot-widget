"""Tests for document-first RAG routing and page-specific retrieval."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.services import chat_service, response_cache, vector_store_service


@pytest.fixture(autouse=True)
def clear_response_cache():
    response_cache.clear_cache()
    yield
    response_cache.clear_cache()


def test_detect_page_query_what_is_on_page_115():
    assert vector_store_service.detect_page_query("what's on page 115") == 115
    assert vector_store_service.detect_page_query("What is on page 115") == 115


def test_is_question_unrelated_false_for_page_query():
    assert chat_service._is_question_unrelated_to_documents(
        "what's on page 115",
        ["CATALOGUE-flipbook.pdf"],
    ) is False


def test_is_question_unrelated_true_for_general_knowledge():
    assert chat_service._is_question_unrelated_to_documents(
        "What is the capital of France?",
        ["CATALOGUE-flipbook.pdf"],
    ) is True


def test_is_question_unrelated_false_when_filename_mentioned():
    assert chat_service._is_question_unrelated_to_documents(
        "summarize catalogue flipbook pricing",
        ["CATALOGUE-flipbook.pdf"],
    ) is False


@patch("app.services.chat_service._has_pending_files", return_value=False)
@patch("app.services.chat_service._has_uploaded_files", return_value=True)
def test_resolve_use_search_skips_web_for_page_query(_files, _pending):
    assert (
        chat_service._resolve_use_search(
            db=object(),
            conversation_id=1,
            rag_context="",
            user_message="what's on page 115",
        )
        is False
    )


@patch("app.services.chat_service._has_pending_files", return_value=False)
@patch("app.services.chat_service._has_uploaded_files", return_value=True)
@patch("app.services.chat_service._processed_filenames", return_value=["manual.pdf"])
@patch(
    "app.services.chat_service._is_question_unrelated_to_documents",
    return_value=False,
)
def test_resolve_use_search_skips_web_when_rag_empty_but_doc_related(
    _unrelated, _filenames, _files, _pending
):
    assert (
        chat_service._resolve_use_search(
            db=object(),  # type: ignore[arg-type]
            conversation_id=1,
            rag_context="",
            user_message="tell me about the bearing spec in my document",
        )
        is False
    )


def test_page_not_found_message_includes_max_page(db_session):
    from sqlalchemy import text

    db_session.execute(
        text(
            """
            INSERT INTO uploaded_files
            (id, conversation_id, filename, file_path, status)
            VALUES ('f-page', 1, 'doc.pdf', '/tmp/doc.pdf', 'processed')
            """
        )
    )
    db_session.execute(
        text(
            """
            INSERT INTO embeddings
            (file_id, chunk_text, embedding, chunk_index, page)
            VALUES ('f-page', 'content', '[]', 0, 50)
            """
        )
    )
    db_session.commit()

    msg = chat_service._page_not_found_message(115, db_session, ["f-page"])
    assert "page 115" in msg
    assert "50" in msg


@patch("app.services.chat_service._has_uploaded_files", return_value=True)
@patch("app.services.chat_service._get_searchable_file_ids", return_value=["f1"])
@patch("app.services.chat_service.build_rag_context", return_value="")
@patch("app.services.chat_service._gemini_configured", return_value=True)
@patch("app.services.chat_service._call_gemini")
@patch("app.services.chat_service._openai_assistant_content", return_value="")
def test_page_not_found_returns_document_not_web(
    mock_openai,
    mock_gemini,
    _mock_cfg,
    mock_rag,
    _file_ids,
    _has_files,
    client,
    auth_headers,
    conversation_id,
):
    mock_gemini.return_value = ("should not be called", None, None)

    with patch(
        "app.services.vector_store_service.get_page_content",
        return_value="",
    ):
        with patch(
            "app.services.vector_store_service.get_max_page_number",
            return_value=100,
        ):
            response = client.post(
                f"/api/v1/chat/conversations/{conversation_id}/messages",
                headers=auth_headers,
                json={"content": "what's on page 115"},
            )

    assert response.status_code == 200
    assistant = response.json()[1]
    assert assistant["source"] == "document"
    assert "page 115" in assistant["content"].lower()
    mock_gemini.assert_not_called()


_DIRECT_RAG = (
    "The BP-4821 bearing part is listed in the uploaded document with full "
    "specifications, pricing, and catalog details for industrial widgets."
)


@patch("app.services.chat_service._has_uploaded_files", return_value=True)
@patch("app.services.chat_service._get_searchable_file_ids", return_value=["f1"])
@patch("app.services.chat_service._gemini_configured", return_value=True)
@patch("app.services.chat_service._call_gemini")
@patch("app.services.chat_service._openai_assistant_content", return_value="")
def test_document_query_after_web_search_still_uses_document(
    mock_openai,
    mock_gemini,
    _mock_cfg,
    _file_ids,
    _has_files,
    client,
    auth_headers,
    conversation_id,
):
    """Document must be searched on turn 2 even after turn 1 used web search."""
    mock_gemini.return_value = ("Web answer", None, None)

    with patch(
        "app.services.chat_service._is_question_unrelated_to_documents",
        return_value=True,
    ):
        with patch("app.services.chat_service.build_rag_context", return_value=""):
            web_resp = client.post(
                f"/api/v1/chat/conversations/{conversation_id}/messages",
                headers=auth_headers,
                json={"content": "What is the IPL score today?"},
            )
    assert web_resp.json()[1]["source"] == "web"

    doc_context = _DIRECT_RAG
    mock_gemini.return_value = ("From your document: BP-4821 details", None, None)

    with patch("app.services.chat_service.build_rag_context", return_value=doc_context):
        doc_resp = client.post(
            f"/api/v1/chat/conversations/{conversation_id}/messages",
            headers=auth_headers,
            json={"content": "What is the BP-4821 bearing part specifications?"},
        )

    assert doc_resp.status_code == 200
    assistant = doc_resp.json()[1]
    assert assistant["source"] in ("document", "both")
    assert mock_gemini.call_args.kwargs["use_search"] is False


@patch("app.services.chat_service._has_uploaded_files", return_value=True)
@patch("app.services.chat_service._get_searchable_file_ids", return_value=["f1"])
@patch("app.services.chat_service._gemini_configured", return_value=True)
@patch("app.services.chat_service._call_gemini")
@patch("app.services.chat_service._openai_assistant_content", return_value="")
def test_unrelated_question_with_document_uses_web(
    mock_openai,
    mock_gemini,
    _mock_cfg,
    _file_ids,
    _has_files,
    client,
    auth_headers,
    conversation_id,
):
    mock_gemini.return_value = ("IPL score update", None, None)

    with patch("app.services.chat_service.build_rag_context", return_value=""):
        response = client.post(
            f"/api/v1/chat/conversations/{conversation_id}/messages",
            headers=auth_headers,
            json={"content": "What is the IPL score today?"},
        )

    assert response.status_code == 200
    assert response.json()[1]["source"] == "web"
    assert mock_gemini.call_args.kwargs["use_search"] is True
