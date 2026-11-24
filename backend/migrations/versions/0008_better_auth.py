"""Store Better Auth identities and sessions separately from financial data."""

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE ROLE balsave_identity NOLOGIN;
        GRANT CONNECT ON DATABASE balsave TO balsave_identity;
        CREATE SCHEMA balsave_identity;

        CREATE TABLE balsave_identity."user" (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name text NOT NULL,
            email text NOT NULL UNIQUE CHECK (email = lower(email)),
            "emailVerified" boolean NOT NULL DEFAULT false,
            image text,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now(),
            owner_id uuid NOT NULL UNIQUE DEFAULT '00000000-0000-0000-0000-000000000000'
                REFERENCES balsave.users (id)
        );

        CREATE TABLE balsave_identity.session (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "userId" uuid NOT NULL REFERENCES balsave_identity."user" (id) ON DELETE CASCADE,
            token text NOT NULL UNIQUE,
            "expiresAt" timestamptz NOT NULL,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now(),
            "ipAddress" text,
            "userAgent" text
        );
        CREATE INDEX identity_session_user_idx ON balsave_identity.session ("userId");
        CREATE INDEX identity_session_expiration_idx ON balsave_identity.session ("expiresAt");

        CREATE TABLE balsave_identity.account (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "userId" uuid NOT NULL REFERENCES balsave_identity."user" (id) ON DELETE CASCADE,
            "accountId" text NOT NULL,
            "providerId" text NOT NULL,
            "accessToken" text,
            "refreshToken" text,
            "idToken" text,
            "accessTokenExpiresAt" timestamptz,
            "refreshTokenExpiresAt" timestamptz,
            scope text,
            password text,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now(),
            UNIQUE ("providerId", "accountId")
        );
        CREATE INDEX identity_account_user_idx ON balsave_identity.account ("userId");

        CREATE TABLE balsave_identity.verification (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            identifier text NOT NULL,
            value text NOT NULL,
            "expiresAt" timestamptz NOT NULL,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX identity_verification_identifier_idx ON balsave_identity.verification (identifier);

        -- Better Auth omits owner_id. The trigger replaces its sentinel default.
        CREATE FUNCTION balsave_identity.assign_owner() RETURNS trigger
        LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
        BEGIN
            IF NEW.owner_id = '00000000-0000-0000-0000-000000000000' THEN
                INSERT INTO balsave.users DEFAULT VALUES RETURNING id INTO NEW.owner_id;
            END IF;
            RETURN NEW;
        END;
        $$;
        REVOKE EXECUTE ON FUNCTION balsave_identity.assign_owner() FROM PUBLIC;
        CREATE TRIGGER assign_owner BEFORE INSERT ON balsave_identity."user"
            FOR EACH ROW EXECUTE FUNCTION balsave_identity.assign_owner();

        CREATE FUNCTION balsave_identity.prune_sessions() RETURNS trigger
        LANGUAGE plpgsql SET search_path = pg_catalog AS $$
        BEGIN
            DELETE FROM balsave_identity.session AS session
            USING (
                SELECT id FROM balsave_identity.session WHERE "expiresAt" <= now()
                ORDER BY "expiresAt" LIMIT 50 FOR UPDATE SKIP LOCKED
            ) AS expired
            WHERE session.id = expired.id;
            RETURN NULL;
        END;
        $$;
        REVOKE EXECUTE ON FUNCTION balsave_identity.prune_sessions() FROM PUBLIC;
        CREATE TRIGGER prune_sessions BEFORE INSERT ON balsave_identity.session
            FOR EACH STATEMENT EXECUTE FUNCTION balsave_identity.prune_sessions();

        GRANT USAGE ON SCHEMA balsave_identity TO balsave_identity, balsave_app;
        GRANT SELECT ON balsave_identity."user" TO balsave_identity;
        GRANT INSERT (id, name, email, "emailVerified", image, "createdAt", "updatedAt"),
              UPDATE (name, email, "emailVerified", image, "updatedAt")
            ON balsave_identity."user" TO balsave_identity;
        GRANT SELECT, INSERT, UPDATE, DELETE
            ON balsave_identity.session, balsave_identity.account, balsave_identity.verification
            TO balsave_identity;
        GRANT SELECT (id, owner_id) ON balsave_identity."user" TO balsave_app;
        GRANT SELECT (id, "userId", "expiresAt") ON balsave_identity.session TO balsave_app;
        REVOKE SELECT, INSERT ON balsave.auth_credentials FROM balsave_app;
        REVOKE SELECT, INSERT, DELETE ON balsave.auth_sessions FROM balsave_app;
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE balsave_identity.verification;
        DROP TABLE balsave_identity.account;
        DROP TABLE balsave_identity.session;
        DROP TABLE balsave_identity."user";
        DROP FUNCTION balsave_identity.assign_owner();
        DROP FUNCTION balsave_identity.prune_sessions();
        DROP SCHEMA balsave_identity;
        REVOKE CONNECT ON DATABASE balsave FROM balsave_identity;
        DROP ROLE balsave_identity;

        GRANT SELECT, INSERT ON balsave.auth_credentials TO balsave_app;
        GRANT SELECT, INSERT, DELETE ON balsave.auth_sessions TO balsave_app;
    """)
