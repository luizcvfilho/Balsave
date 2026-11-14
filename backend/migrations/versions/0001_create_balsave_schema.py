"""Create the initial Balsave schema and application tables."""

from alembic import op

from migrations.initial_schema import create_tables

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA balsave")
    op.execute("GRANT USAGE ON SCHEMA balsave TO balsave_app")
    create_tables()


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS balsave.refunds")
    op.execute("DROP TABLE IF EXISTS balsave.transactions")
    op.execute("DROP FUNCTION IF EXISTS balsave.validate_refund()")
    op.execute("DROP TABLE IF EXISTS balsave.categories")
    op.execute("DROP TABLE IF EXISTS balsave.accounts")
    op.execute("DROP TABLE IF EXISTS balsave.users")
    op.execute("DROP SCHEMA balsave")
