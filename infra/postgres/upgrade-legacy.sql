\set ON_ERROR_STOP on

\set app_password ''
\getenv app_password BALSAVE_DB_PASSWORD
SELECT length(:'app_password') > 0 AS has_app_password \gset
\if :has_app_password
\else
    DO $$ BEGIN RAISE EXCEPTION 'Set BALSAVE_DB_PASSWORD before running this upgrade.'; END $$;
\endif

-- Run from the maintenance database. ALTER DATABASE cannot rename the current database.
SELECT 'ALTER DATABASE valora RENAME TO balsave'
FROM pg_database WHERE datname = 'valora'
\gexec

\connect balsave
BEGIN;

SELECT 'ALTER ROLE valora_app RENAME TO balsave_app'
FROM pg_roles WHERE rolname = 'valora_app'
\gexec

-- PostgreSQL clears passwords stored as MD5 when renaming a role.
ALTER ROLE balsave_app PASSWORD :'app_password';

SELECT 'ALTER SCHEMA valora RENAME TO balsave'
FROM pg_namespace WHERE nspname = 'valora'
\gexec

-- PostgreSQL keeps trigger links by object ID, but not names in PL/pgSQL source.
SELECT replace(pg_get_functiondef(oid), 'valora.', 'balsave.')
FROM pg_proc
WHERE oid = to_regprocedure('balsave.validate_refund()') AND strpos(prosrc, 'valora.') > 0
\gexec

COMMIT;
