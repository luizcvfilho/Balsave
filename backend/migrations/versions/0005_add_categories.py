"""Persist provider taxonomy and owner-scoped category preferences."""

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE balsave.categories
            ADD COLUMN code text,
            ADD COLUMN archived_at timestamptz,
            ADD CONSTRAINT categories_code_key UNIQUE (user_id, code);

        CREATE TABLE balsave.pluggy_category_catalog (
            id text PRIMARY KEY,
            description text NOT NULL,
            description_translated text,
            parent_id text,
            parent_description text
        );
        CREATE TABLE balsave.pluggy_category_catalog_state (
            singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
            refreshed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE balsave.transaction_category_assignments (
            user_id uuid NOT NULL REFERENCES balsave.users (id),
            entry_id text NOT NULL CHECK (
                entry_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            ),
            category_id uuid NOT NULL,
            updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, entry_id),
            FOREIGN KEY (user_id, category_id) REFERENCES balsave.categories (user_id, id)
        );
        CREATE INDEX transaction_category_assignments_category_idx
            ON balsave.transaction_category_assignments (user_id, category_id);

        GRANT SELECT, INSERT, UPDATE, DELETE ON
            balsave.pluggy_category_catalog, balsave.transaction_category_assignments TO balsave_app;
        GRANT SELECT, INSERT, UPDATE ON balsave.pluggy_category_catalog_state TO balsave_app;
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE balsave.transaction_category_assignments;
        DROP TABLE balsave.pluggy_category_catalog_state;
        DROP TABLE balsave.pluggy_category_catalog;
        ALTER TABLE balsave.categories DROP CONSTRAINT categories_code_key,
            DROP COLUMN archived_at, DROP COLUMN code;
    """)
