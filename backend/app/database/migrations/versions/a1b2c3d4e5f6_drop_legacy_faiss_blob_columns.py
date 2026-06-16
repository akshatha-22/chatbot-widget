"""Drop legacy FAISS blob columns from uploaded_files.

Revision ID: a1b2c3d4e5f6
Revises: 79472c66e251
Create Date: 2026-06-16
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "79472c66e251"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = {col["name"] for col in insp.get_columns("uploaded_files")}

    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("uploaded_files") as batch_op:
            if "faiss_index_blob" in columns:
                batch_op.drop_column("faiss_index_blob")
            if "chunks_blob" in columns:
                batch_op.drop_column("chunks_blob")
        return

    if "faiss_index_blob" in columns:
        op.drop_column("uploaded_files", "faiss_index_blob")
    if "chunks_blob" in columns:
        op.drop_column("uploaded_files", "chunks_blob")


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = {col["name"] for col in insp.get_columns("uploaded_files")}

    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("uploaded_files") as batch_op:
            if "faiss_index_blob" not in columns:
                batch_op.add_column(sa.Column("faiss_index_blob", sa.LargeBinary(), nullable=True))
            if "chunks_blob" not in columns:
                batch_op.add_column(sa.Column("chunks_blob", sa.LargeBinary(), nullable=True))
        return

    if "faiss_index_blob" not in columns:
        op.add_column(
            "uploaded_files",
            sa.Column("faiss_index_blob", sa.LargeBinary(), nullable=True),
        )
    if "chunks_blob" not in columns:
        op.add_column(
            "uploaded_files",
            sa.Column("chunks_blob", sa.LargeBinary(), nullable=True),
        )
