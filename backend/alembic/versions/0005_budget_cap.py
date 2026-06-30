"""add budget_cap_usd and alert_threshold_pct to companies

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "companies",
        sa.Column("budget_cap_usd", sa.Numeric(10, 4), server_default="0", nullable=False),
    )
    op.add_column(
        "companies",
        sa.Column("alert_threshold_pct", sa.Integer, server_default="80", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("companies", "alert_threshold_pct")
    op.drop_column("companies", "budget_cap_usd")
