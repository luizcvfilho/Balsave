"""Persist personal category rules without copying financial descriptions."""

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE balsave.category_rules (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL REFERENCES balsave.users (id),
            category_id uuid NOT NULL,
            description text NOT NULL CHECK (
                char_length(btrim(description)) BETWEEN 1 AND 200
                AND description !~ '[[:cntrl:]]'
            ),
            match_type text NOT NULL CHECK (match_type IN ('exact', 'contains', 'starts_with', 'ends_with')),
            account_id uuid,
            priority smallint NOT NULL DEFAULT 100 CHECK (priority BETWEEN 1 AND 1000),
            starts_on date,
            enabled boolean NOT NULL DEFAULT true,
            created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id, category_id) REFERENCES balsave.categories (user_id, id)
        );
        CREATE INDEX category_rules_owner_priority_idx
            ON balsave.category_rules (user_id, priority, created_at, id);
        GRANT SELECT, INSERT, UPDATE, DELETE ON balsave.category_rules TO balsave_app;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE balsave.category_rules")
