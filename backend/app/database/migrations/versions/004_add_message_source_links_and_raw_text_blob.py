"""Add message source/links and uploaded_files raw_text_blob.

Revision ID: 004_message_source_links
Revises: 20250603_0001
Create Date: 2026-06-03
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "004_message_source_links"
down_revision = "20250603_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column("source", sa.String(length=50), server_default="catalog", nullable=False),
    )
    op.add_column(
        "messages",
        sa.Column("links", sa.JSON(), server_default="[]", nullable=True),
    )
    op.add_column("uploaded_files", sa.Column("raw_text_blob", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("uploaded_files", "raw_text_blob")
    op.drop_column("messages", "links")
    op.drop_column("messages", "source")
