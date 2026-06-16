"""Add embeddings table with pgvector column.

Revision ID: 39bbe74f12ff
Revises: 004_message_source_links
Create Date: 2026-06-03
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "39bbe74f12ff"
down_revision = "004_message_source_links"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if "embeddings" in insp.get_table_names():
        return

    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "embeddings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "file_id",
            sa.String(length=255),
            sa.ForeignKey("uploaded_files.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("chunk_text", sa.Text(), nullable=True),
        sa.Column("chunk_index", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE embeddings ADD COLUMN embedding vector(768)")
    else:
        op.add_column("embeddings", sa.Column("embedding", sa.Text(), nullable=True))

    op.create_index("embeddings_file_id_idx", "embeddings", ["file_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "embeddings" not in insp.get_table_names():
        return
    op.drop_index("embeddings_file_id_idx", table_name="embeddings")
    op.drop_table("embeddings")
