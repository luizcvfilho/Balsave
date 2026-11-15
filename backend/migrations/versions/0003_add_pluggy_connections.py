"""Store Pluggy item references for the local preview owner."""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE balsave.preview_owner (
            singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
            user_id uuid NOT NULL REFERENCES balsave.users (id)
        );

        WITH owner AS (
            INSERT INTO balsave.users DEFAULT VALUES RETURNING id
        )
        INSERT INTO balsave.preview_owner (user_id) SELECT id FROM owner;

        CREATE TABLE balsave.pluggy_connections (
            item_id uuid PRIMARY KEY,
            user_id uuid NOT NULL REFERENCES balsave.users (id),
            created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        GRANT SELECT ON balsave.preview_owner TO balsave_app;
        GRANT SELECT, INSERT ON balsave.pluggy_connections TO balsave_app;
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE balsave.pluggy_connections;
        WITH owner AS (
            DELETE FROM balsave.preview_owner RETURNING user_id
        )
        DELETE FROM balsave.users WHERE id IN (SELECT user_id FROM owner);
        DROP TABLE balsave.preview_owner;
    """)
