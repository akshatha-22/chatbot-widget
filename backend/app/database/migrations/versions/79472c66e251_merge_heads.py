"""merge_heads

Revision ID: 79472c66e251
Revises: 004_message_source_links, 39bbe74f12ff
Create Date: 2026-06-16 10:45:18.878629

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '79472c66e251'
down_revision = ('004_message_source_links', '39bbe74f12ff')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
