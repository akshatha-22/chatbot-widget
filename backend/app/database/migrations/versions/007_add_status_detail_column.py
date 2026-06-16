"""Add status_detail column to uploaded_files for processing progress.

Revision ID: 007_status_detail
Revises: 006_embeddings_page
Create Date: 2026-06-16
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "007_status_detail"
down_revision = "006_embeddings_page"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "uploaded_files" not in insp.get_table_names():
        return
    columns = {col["name"] for col in insp.get_columns("uploaded_files")}
    if "status_detail" not in columns:
        op.add_column("uploaded_files", sa.Column("status_detail", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "uploaded_files" not in insp.get_table_names():
        return
    columns = {col["name"] for col in insp.get_columns("uploaded_files")}
    if "status_detail" in columns:
        op.drop_column("uploaded_files", "status_detail")
