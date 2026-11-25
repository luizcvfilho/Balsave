"""Keep classification history for restoring purchases after category deletion."""

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE balsave.transaction_category_assignments
            ADD COLUMN previous_categories uuid[] NOT NULL DEFAULT '{}';
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE balsave.transaction_category_assignments DROP COLUMN previous_categories;
    """)
