"""Add metadata for manually maintained accounts without changing existing rows."""

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE balsave.accounts
            ADD COLUMN institution text NOT NULL DEFAULT '',
            ADD COLUMN opening_balance_cents bigint NOT NULL DEFAULT 0,
            ADD COLUMN limit_cents bigint,
            ADD COLUMN last_four text,
            ADD COLUMN archived_at timestamptz,
            ADD CONSTRAINT accounts_limit_nonnegative CHECK (limit_cents IS NULL OR limit_cents >= 0),
            ADD CONSTRAINT accounts_last_four_valid CHECK (last_four IS NULL OR last_four ~ '^[0-9]{4}$');
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE balsave.accounts DROP COLUMN institution, DROP COLUMN opening_balance_cents,
            DROP COLUMN limit_cents, DROP COLUMN last_four, DROP COLUMN archived_at;
    """)
