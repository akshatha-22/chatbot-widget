"""Regression tests: never claim full page coverage without live embedding rows."""

from __future__ import annotations

from unittest.mock import patch

from sqlalchemy import text

from app.services import chat_service


def _insert_file(
    db_session,
    file_id: str,
    *,
    status: str = "processed",
    pdf_page_count: int | None = None,
    conversation_id: int = 1,
) -> None:
    db_session.execute(
        text(
            """
            INSERT INTO uploaded_files
            (id, conversation_id, filename, file_path, status, pdf_page_count)
            VALUES (:id, :cid, :name, :path, :status, :pages)
            """
        ),
        {
            "id": file_id,
            "cid": conversation_id,
            "name": "doc.pdf",
            "path": "/tmp/doc.pdf",
            "status": status,
            "pages": pdf_page_count,
        },
    )


def _insert_embedding(db_session, file_id: str, page: int) -> None:
    db_session.execute(
        text(
            """
            INSERT INTO embeddings
            (file_id, chunk_text, embedding, chunk_index, page)
            VALUES (:fid, :text, '[]', :idx, :page)
            """
        ),
        {
            "fid": file_id,
            "text": f"page {page} content",
            "idx": page,
            "page": page,
        },
    )


def test_failed_file_never_claims_full_coverage(db_session):
    """status='failed' and 0 embedding rows must not claim coverage."""
    _insert_file(
        db_session,
        "test-failed-file",
        status="failed",
        pdf_page_count=447,
    )
    db_session.commit()

    msg = chat_service._build_page_response_or_fallback(
        db=db_session,
        file_id="test-failed-file",
        requested_page=100,
        pdf_page_count=447,
        file_status="failed",
    )
    assert msg is not None
    assert "failed to process" in msg
    assert "covers pages" not in msg
    assert "1–447" not in msg
    assert "1-447" not in msg


def test_processed_file_with_zero_chunks_is_honest(db_session):
    """status='processed' but 0 embedding rows must be reported honestly."""
    _insert_file(
        db_session,
        "test-empty-file",
        status="processed",
        pdf_page_count=200,
    )
    db_session.commit()

    msg = chat_service._build_page_response_or_fallback(
        db=db_session,
        file_id="test-empty-file",
        requested_page=50,
        pdf_page_count=200,
        file_status="processed",
    )
    assert msg is not None
    assert "no searchable content" in msg
    assert "covers pages" not in msg


def test_partial_coverage_reports_accurate_percentage(db_session):
    """Only pages present in embeddings count toward coverage."""
    _insert_file(
        db_session,
        "test-partial-file",
        status="processed",
        pdf_page_count=447,
    )
    for page in (1, 2, 3, 4, 5):
        _insert_embedding(db_session, "test-partial-file", page)
    db_session.commit()

    msg = chat_service._build_page_response_or_fallback(
        db=db_session,
        file_id="test-partial-file",
        requested_page=100,
        pdf_page_count=447,
        file_status="processed",
    )
    assert msg is not None
    assert "5 of 447" in msg
    assert "100" in msg
    assert "covers pages" not in msg


def test_available_page_returns_none(db_session):
    """When the requested page IS indexed, return None for normal retrieval."""
    _insert_file(
        db_session,
        "test-good-file",
        status="processed",
        pdf_page_count=447,
    )
    _insert_embedding(db_session, "test-good-file", 100)
    db_session.commit()

    result = chat_service._build_page_response_or_fallback(
        db=db_session,
        file_id="test-good-file",
        requested_page=100,
        pdf_page_count=447,
        file_status="processed",
    )
    assert result is None


def test_resolve_fallback_blocks_failed_file_with_no_processed_siblings(db_session):
    """Page query on a failed-only upload must not fall through to web search."""
    _insert_file(
        db_session,
        "only-failed",
        status="failed",
        pdf_page_count=447,
        conversation_id=99,
    )
    db_session.commit()

    msg = chat_service._resolve_page_query_fallback(db_session, 99, 100)
    assert msg is not None
    assert "failed to process" in msg


def test_page_query_with_failed_upload_never_uses_web_search(
    client, auth_headers, conversation_id, db_session
):
    """Regression: failed-only file + page query must not reach Gemini."""
    from sqlalchemy import text

    db_session.execute(
        text(
            """
            INSERT INTO uploaded_files
            (id, conversation_id, filename, file_path, status, pdf_page_count)
            VALUES ('failed-gita', :cid, 'gita.pdf', '/tmp/gita.pdf', 'failed', 447)
            """
        ),
        {"cid": conversation_id},
    )
    db_session.commit()

    with patch("app.services.chat_service._call_gemini") as mock_gemini:
        response = client.post(
            f"/api/v1/chat/conversations/{conversation_id}/messages",
            headers=auth_headers,
            json={"content": "what's on page 11"},
        )

    assert response.status_code == 200
    assistant = response.json()[1]
    assert assistant["source"] == "document"
    assert "failed to process" in assistant["content"].lower()
    assert "47 of 447" not in assistant["content"]
    assert "covers pages" not in assistant["content"].lower()
    mock_gemini.assert_not_called()


def test_page_not_found_message_never_uses_covers_phrase(db_session):
    _insert_file(db_session, "f-page", pdf_page_count=447)
    _insert_embedding(db_session, "f-page", 50)
    db_session.commit()

    msg = chat_service._page_not_found_message(115, db_session, ["f-page"])
    assert "covers pages" not in msg
    assert "1–447" not in msg
    assert "115" in msg
