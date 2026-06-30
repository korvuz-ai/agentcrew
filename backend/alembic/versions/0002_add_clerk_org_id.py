"""Add clerk_org_id to companies

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-29

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("clerk_org_id", sa.String(255), nullable=False))
    # unique=True here creates a unique index — matches SQLAlchemy model's unique=True, index=True
    op.create_index("ix_companies_clerk_org_id", "companies", ["clerk_org_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_companies_clerk_org_id", table_name="companies")
    op.drop_column("companies", "clerk_org_id")
