"""Create the schema for application tables."""

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA valora")
    op.execute("GRANT USAGE ON SCHEMA valora TO valora_app")


def downgrade() -> None:
    op.execute("DROP SCHEMA valora")
