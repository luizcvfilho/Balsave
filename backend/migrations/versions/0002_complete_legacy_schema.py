"""Add the initial tables to databases that already ran the original 0001."""

from migrations.initial_schema import create_tables

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    create_tables()


def downgrade() -> None:
    # The current 0001 owns the tables. Keep them when returning to that revision.
    pass
