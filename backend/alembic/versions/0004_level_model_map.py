"""add level_model_map config table

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

# Default model IDs per level × provider (update in DB when providers release new models)
DEFAULT_MAPPINGS = [
    # Level 1 — Junior
    (1, "claude", "claude-haiku-4-5-20251001"),
    (1, "gemini", "gemini/gemini-3.1-flash-lite-001"),
    (1, "gpt",    "openai/gpt-5.5-instant"),
    # Level 2 — Mid
    (2, "claude", "claude-sonnet-4-6"),
    (2, "gemini", "gemini/gemini-3.1-pro-001"),
    (2, "gpt",    "openai/gpt-5.5"),
    # Level 3 — Senior
    (3, "claude", "claude-opus-4-8"),
    (3, "gemini", "gemini/gemini-3.1-pro-001"),  # deep-think is a run mode, not a different model
    (3, "gpt",    "openai/gpt-5.5-pro"),
]


def upgrade() -> None:
    op.create_table(
        "level_model_map",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("level", sa.SmallInteger(), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("model_id", sa.String(100), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("level", "provider", name="uq_level_model_map"),
    )

    op.execute(
        sa.text(
            "INSERT INTO level_model_map (level, provider, model_id) VALUES "
            + ", ".join(f"({lvl}, '{prov}', '{mid}')" for lvl, prov, mid in DEFAULT_MAPPINGS)
        )
    )


def downgrade() -> None:
    op.drop_table("level_model_map")
