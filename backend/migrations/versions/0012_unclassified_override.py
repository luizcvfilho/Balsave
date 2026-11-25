"""Store an explicit choice to leave an imported expense unclassified."""

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE balsave.transaction_category_assignments ALTER COLUMN category_id DROP NOT NULL")


def downgrade() -> None:
    op.execute("DELETE FROM balsave.transaction_category_assignments WHERE category_id IS NULL")
    op.execute("ALTER TABLE balsave.transaction_category_assignments ALTER COLUMN category_id SET NOT NULL")
