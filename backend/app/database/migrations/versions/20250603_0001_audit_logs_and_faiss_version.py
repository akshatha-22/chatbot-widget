"""Add audit_logs table, embedding_model_version, and gemini usage index.

Revision ID: 20250603_0001
Revises:
Create Date: 2025-06-03

Run in production: ``alembic upgrade head``
Startup patches in ``app/database/migrations/startup.py`` are idempotent and
safe to run after this revision (inspect-before-ALTER / IF NOT EXISTS).
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20250603_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "action",
            sa.Enum(
                "upload",
                "message",
                "generate",
                "export",
                "login",
                "delete",
                name="auditaction",
            ),
            nullable=False,
        ),
        sa.Column("resource_type", sa.String(length=100), nullable=True),
        sa.Column("resource_id", sa.String(length=255), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_audit_logs_id", "audit_logs", ["id"])
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_timestamp", "audit_logs", ["timestamp"])

    op.add_column(
        "uploaded_files",
        sa.Column("embedding_model_version", sa.String(length=100), nullable=True),
    )

    op.create_index(
        "ix_gemini_daily_usage_user_date",
        "gemini_daily_usage",
        ["user_id", "usage_date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_gemini_daily_usage_user_date", table_name="gemini_daily_usage")
    op.drop_column("uploaded_files", "embedding_model_version")
    op.drop_index("ix_audit_logs_timestamp", table_name="audit_logs")
    op.drop_index("ix_audit_logs_user_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_id", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.execute("DROP TYPE IF EXISTS auditaction")
