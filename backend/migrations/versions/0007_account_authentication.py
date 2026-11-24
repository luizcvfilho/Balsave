"""Add account credentials, revocable sessions, and shared rate limits."""

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE balsave.auth_credentials (
            user_id uuid PRIMARY KEY REFERENCES balsave.users (id) ON DELETE CASCADE,
            username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
            password_hash text NOT NULL
        );

        CREATE TABLE balsave.auth_sessions (
            token_hash bytea PRIMARY KEY CHECK (octet_length(token_hash) = 32),
            user_id uuid NOT NULL REFERENCES balsave.auth_credentials (user_id) ON DELETE CASCADE,
            expires_at timestamptz NOT NULL
        );
        CREATE INDEX auth_sessions_user_idx ON balsave.auth_sessions (user_id);
        CREATE INDEX auth_sessions_expiration_idx ON balsave.auth_sessions (expires_at);

        CREATE TABLE balsave.auth_rate_limits (
            key_hash bytea PRIMARY KEY CHECK (octet_length(key_hash) = 32),
            attempts integer NOT NULL CHECK (attempts > 0),
            expires_at timestamptz NOT NULL
        );
        CREATE INDEX auth_rate_limits_expiration_idx ON balsave.auth_rate_limits (expires_at);

        GRANT SELECT, INSERT ON balsave.auth_credentials TO balsave_app;
        GRANT SELECT, INSERT, DELETE ON balsave.auth_sessions TO balsave_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON balsave.auth_rate_limits TO balsave_app;
        REVOKE SELECT, UPDATE (singleton) ON balsave.preview_owner FROM balsave_app;
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE balsave.auth_rate_limits;
        DROP TABLE balsave.auth_sessions;
        DROP TABLE balsave.auth_credentials;
        GRANT SELECT, UPDATE (singleton) ON balsave.preview_owner TO balsave_app;
    """)
