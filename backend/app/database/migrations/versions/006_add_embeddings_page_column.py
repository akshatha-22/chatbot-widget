"""Add page column to embeddings for page-aware RAG.

Revision ID: 006_embeddings_page
Revises: b2c3d4e5f6a7
Create Date: 2026-06-16
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "006_embeddings_page"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "embeddings" not in insp.get_table_names():
        return

    columns = {col["name"] for col in insp.get_columns("embeddings")}
    if "page" not in columns:
        op.add_column(
            "embeddings",
            sa.Column("page", sa.Integer(), server_default="1", nullable=True),
        )

    indexes = {idx["name"] for idx in insp.get_indexes("embeddings")}
    if "embeddings_page_idx" not in indexes:
        op.create_index("embeddings_page_idx", "embeddings", ["file_id", "page"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "embeddings" not in insp.get_table_names():
        return

    indexes = {idx["name"] for idx in insp.get_indexes("embeddings")}
    if "embeddings_page_idx" in indexes:
        op.drop_index("embeddings_page_idx", table_name="embeddings")

    columns = {col["name"] for col in insp.get_columns("embeddings")}
    if "page" in columns:
        op.drop_column("embeddings", "page")
