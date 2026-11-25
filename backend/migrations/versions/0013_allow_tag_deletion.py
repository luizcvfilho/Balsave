"""Allow the application role to delete tags and cascade their assignments."""

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("GRANT DELETE ON balsave.tags TO balsave_app")


def downgrade() -> None:
    op.execute("REVOKE DELETE ON balsave.tags FROM balsave_app")
