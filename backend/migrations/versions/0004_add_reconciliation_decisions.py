"""Persist owner-scoped reconciliation decisions and investment overlap links."""

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE balsave.reconciliation_decisions (
            user_id uuid NOT NULL REFERENCES balsave.users (id),
            entry_id text NOT NULL,
            counterpart_id text,
            fingerprint char(64) NOT NULL,
            PRIMARY KEY (user_id, entry_id),
            CHECK (counterpart_id IS NULL OR counterpart_id <> entry_id)
        );
        CREATE TABLE balsave.investment_account_links (
            user_id uuid NOT NULL REFERENCES balsave.users (id),
            investment_id uuid NOT NULL,
            account_id uuid,
            PRIMARY KEY (user_id, investment_id)
        );
        GRANT SELECT, INSERT, UPDATE, DELETE ON balsave.reconciliation_decisions TO balsave_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON balsave.investment_account_links TO balsave_app;
        GRANT UPDATE (singleton) ON balsave.preview_owner TO balsave_app;
    """)


def downgrade() -> None:
    op.execute("""
        REVOKE UPDATE (singleton) ON balsave.preview_owner FROM balsave_app;
        DROP TABLE balsave.investment_account_links;
        DROP TABLE balsave.reconciliation_decisions;
    """)
