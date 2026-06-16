"""Add processing_error column to uploaded_files.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-16
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "uploaded_files" not in insp.get_table_names():
        return
    columns = {col["name"] for col in insp.get_columns("uploaded_files")}
    if "processing_error" not in columns:
        op.add_column("uploaded_files", sa.Column("processing_error", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "uploaded_files" not in insp.get_table_names():
        return
    columns = {col["name"] for col in insp.get_columns("uploaded_files")}
    if "processing_error" in columns:
        op.drop_column("uploaded_files", "processing_error")
