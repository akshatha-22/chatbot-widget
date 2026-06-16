"""Idempotent schema patches for dev/SQLite and post-Alembic safety.

Alembic revision ``20250603_0001`` is the source of truth for production deploys.
These helpers only add objects that are missing — safe to run after ``create_all``
or ``alembic upgrade`` without duplicate-column errors.
"""

from __future__ import annotations

from sqlalchemy import inspect, text

from app.config import settings
from app.database.db import engine


def _is_sqlite() -> bool:
    return settings.DATABASE_URL.startswith("sqlite")


def _column_names(table: str) -> set[str]:
    insp = inspect(engine)
    if table not in insp.get_table_names():
        return set()
    return {c["name"] for c in insp.get_columns(table)}


def _index_names(table: str) -> set[str]:
    insp = inspect(engine)
    if table not in insp.get_table_names():
        return set()
    return {idx["name"] for idx in insp.get_indexes(table)}


def _run_alters(statements: list[str]) -> None:
    if not statements:
        return
    with engine.begin() as conn:
        for sql in statements:
            conn.execute(text(sql))


def apply_startup_migrations() -> None:
    """Apply all idempotent schema patches."""
    _migrate_message_pdf_columns()
    _migrate_message_source_links_columns()
    _migrate_uploaded_file_vector_columns()
    _migrate_gemini_usage_index()


def _migrate_message_pdf_columns() -> None:
    existing = _column_names("messages")
    if not existing:
        return

    alters: list[str] = []
    if "has_pdf" not in existing:
        if _is_sqlite():
            alters.append("ALTER TABLE messages ADD COLUMN has_pdf BOOLEAN DEFAULT 0")
        else:
            alters.append(
                "ALTER TABLE messages ADD COLUMN IF NOT EXISTS has_pdf BOOLEAN DEFAULT FALSE"
            )
    if "pdf_content" not in existing:
        if _is_sqlite():
            alters.append("ALTER TABLE messages ADD COLUMN pdf_content TEXT")
        else:
            alters.append(
                "ALTER TABLE messages ADD COLUMN IF NOT EXISTS pdf_content TEXT"
            )
    if "pdf_filename" not in existing:
        if _is_sqlite():
            alters.append("ALTER TABLE messages ADD COLUMN pdf_filename VARCHAR(255)")
        else:
            alters.append(
                "ALTER TABLE messages ADD COLUMN IF NOT EXISTS pdf_filename VARCHAR(255)"
            )
    _run_alters(alters)


def _migrate_message_source_links_columns() -> None:
    existing = _column_names("messages")
    if not existing:
        return

    alters: list[str] = []
    if "source" not in existing:
        if _is_sqlite():
            alters.append(
                "ALTER TABLE messages ADD COLUMN source VARCHAR(50) DEFAULT 'document'"
            )
        else:
            alters.append(
                "ALTER TABLE messages ADD COLUMN IF NOT EXISTS "
                "source VARCHAR(50) DEFAULT 'document'"
            )
    if "links" not in existing:
        if _is_sqlite():
            alters.append("ALTER TABLE messages ADD COLUMN links JSON DEFAULT '[]'")
        else:
            alters.append(
                "ALTER TABLE messages ADD COLUMN IF NOT EXISTS links JSON DEFAULT '[]'"
            )
    _run_alters(alters)


def _migrate_uploaded_file_vector_columns() -> None:
    existing = _column_names("uploaded_files")
    if not existing:
        return

    alters: list[str] = []
    if "embedding_model_version" not in existing:
        if _is_sqlite():
            alters.append(
                "ALTER TABLE uploaded_files ADD COLUMN embedding_model_version VARCHAR(100)"
            )
        else:
            alters.append(
                "ALTER TABLE uploaded_files "
                "ADD COLUMN IF NOT EXISTS embedding_model_version VARCHAR(100)"
            )
    if "raw_text_blob" not in existing:
        if _is_sqlite():
            alters.append("ALTER TABLE uploaded_files ADD COLUMN raw_text_blob TEXT")
        else:
            alters.append(
                "ALTER TABLE uploaded_files "
                "ADD COLUMN IF NOT EXISTS raw_text_blob TEXT"
            )
    _run_alters(alters)


def _migrate_gemini_usage_index() -> None:
    if "gemini_daily_usage" not in inspect(engine).get_table_names():
        return
    if "ix_gemini_daily_usage_user_date" in _index_names("gemini_daily_usage"):
        return
    _run_alters(
        [
            "CREATE INDEX IF NOT EXISTS ix_gemini_daily_usage_user_date "
            "ON gemini_daily_usage (user_id, usage_date)"
        ]
    )
