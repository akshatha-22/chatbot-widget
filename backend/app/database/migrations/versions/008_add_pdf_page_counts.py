"""Add pdf_page_count and indexed_page_count to uploaded_files."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "008_pdf_page_counts"
down_revision = "007_status_detail"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "uploaded_files" not in insp.get_table_names():
        return
    columns = {col["name"] for col in insp.get_columns("uploaded_files")}
    if "pdf_page_count" not in columns:
        op.add_column(
            "uploaded_files",
            sa.Column("pdf_page_count", sa.Integer(), nullable=True),
        )
    if "indexed_page_count" not in columns:
        op.add_column(
            "uploaded_files",
            sa.Column("indexed_page_count", sa.Integer(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "uploaded_files" not in insp.get_table_names():
        return
    columns = {col["name"] for col in insp.get_columns("uploaded_files")}
    if "indexed_page_count" in columns:
        op.drop_column("uploaded_files", "indexed_page_count")
    if "pdf_page_count" in columns:
        op.drop_column("uploaded_files", "pdf_page_count")
