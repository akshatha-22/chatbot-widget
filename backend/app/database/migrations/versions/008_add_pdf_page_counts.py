"""Add pdf_page_count and indexed_page_count to uploaded_files."""

from alembic import op
import sqlalchemy as sa

revision = "008_add_pdf_page_counts"
down_revision = "007_add_status_detail_column"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "uploaded_files",
        sa.Column("pdf_page_count", sa.Integer(), nullable=True),
    )
    op.add_column(
        "uploaded_files",
        sa.Column("indexed_page_count", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("uploaded_files", "indexed_page_count")
    op.drop_column("uploaded_files", "pdf_page_count")
