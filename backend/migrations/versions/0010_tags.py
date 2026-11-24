"""Persist owner-scoped transaction tags without provider financial data."""

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(r"""
        CREATE TABLE balsave.tags (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL REFERENCES balsave.users (id),
            name text NOT NULL,
            UNIQUE (user_id, id)
        );
        CREATE UNIQUE INDEX tags_owner_name_key ON balsave.tags (user_id, lower(name));
        CREATE TABLE balsave.transaction_tags (
            user_id uuid NOT NULL,
            entry_id text NOT NULL CHECK (entry_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
            tag_id uuid NOT NULL,
            PRIMARY KEY (user_id, entry_id, tag_id),
            FOREIGN KEY (user_id, tag_id) REFERENCES balsave.tags (user_id, id) ON DELETE CASCADE
        );
        GRANT SELECT, INSERT, UPDATE ON balsave.tags TO balsave_app;
        GRANT SELECT, INSERT, DELETE ON balsave.transaction_tags TO balsave_app;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE balsave.transaction_tags; DROP TABLE balsave.tags;")
