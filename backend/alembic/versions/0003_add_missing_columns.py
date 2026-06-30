"""add missing columns for b3 alignment

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # agents: backstory + cwd
    op.add_column("agents", sa.Column("backstory", sa.Text(), nullable=True))
    op.add_column("agents", sa.Column("cwd", sa.String(500), nullable=True))

    # skills: category
    op.add_column("skills", sa.Column("category", sa.String(100), nullable=True))

    # pipelines: orchestrator_id (FK → agents)
    op.add_column("pipelines", sa.Column(
        "orchestrator_id", postgresql.UUID(as_uuid=True), nullable=True
    ))
    op.create_foreign_key(
        "fk_pipelines_orchestrator_id",
        "pipelines", "agents",
        ["orchestrator_id"], ["id"],
        ondelete="SET NULL",
    )

    # pipeline_nodes: condition
    op.add_column("pipeline_nodes", sa.Column("condition", sa.Text(), nullable=True))

    # sessions: status + total_cost_usd
    op.add_column("sessions", sa.Column(
        "status", sa.String(50), nullable=False, server_default="running"
    ))
    op.add_column("sessions", sa.Column(
        "total_cost_usd", sa.Numeric(12, 6), nullable=False, server_default="0"
    ))

    # messages: thinking + tokens_in + cost_usd + latency_ms
    op.add_column("messages", sa.Column("thinking", sa.Text(), nullable=True))
    op.add_column("messages", sa.Column(
        "tokens_in", sa.Integer(), nullable=False, server_default="0"
    ))
    op.add_column("messages", sa.Column(
        "cost_usd", sa.Numeric(12, 6), nullable=False, server_default="0"
    ))
    op.add_column("messages", sa.Column(
        "latency_ms", sa.Integer(), nullable=False, server_default="0"
    ))


def downgrade() -> None:
    op.drop_column("messages", "latency_ms")
    op.drop_column("messages", "cost_usd")
    op.drop_column("messages", "tokens_in")
    op.drop_column("messages", "thinking")
    op.drop_column("sessions", "total_cost_usd")
    op.drop_column("sessions", "status")
    op.drop_column("pipeline_nodes", "condition")
    op.drop_constraint("fk_pipelines_orchestrator_id", "pipelines", type_="foreignkey")
    op.drop_column("pipelines", "orchestrator_id")
    op.drop_column("skills", "category")
    op.drop_column("agents", "cwd")
    op.drop_column("agents", "backstory")
