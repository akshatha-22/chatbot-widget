"""Add message source and links columns.

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
    bind = op.get_bind()
    insp = sa.inspect(bind)
    message_cols = {col["name"] for col in insp.get_columns("messages")}
    file_cols = {col["name"] for col in insp.get_columns("uploaded_files")}

    if "source" not in message_cols:
        op.add_column(
            "messages",
            sa.Column(
                "source",
                sa.String(length=50),
                server_default="document",
                nullable=False,
            ),
        )
    if "links" not in message_cols:
        op.add_column(
            "messages",
            sa.Column("links", sa.JSON(), server_default="[]", nullable=True),
        )
    if "raw_text_blob" not in file_cols:
        op.add_column("uploaded_files", sa.Column("raw_text_blob", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    message_cols = {col["name"] for col in insp.get_columns("messages")}
    file_cols = {col["name"] for col in insp.get_columns("uploaded_files")}

    if "raw_text_blob" in file_cols:
        op.drop_column("uploaded_files", "raw_text_blob")
    if "links" in message_cols:
        op.drop_column("messages", "links")
    if "source" in message_cols:
        op.drop_column("messages", "source")
