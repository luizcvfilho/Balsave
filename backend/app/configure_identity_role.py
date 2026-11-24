"""Set the dedicated login role password after applying database migrations."""

import os

import psycopg
from psycopg import sql

from app.database import connect_admin


def main() -> None:
    password = os.getenv("BALSAVE_IDENTITY_DB_PASSWORD")
    if not password:
        return

    with connect_admin() as connection:
        verifier = connection.pgconn.encrypt_password(
            password.encode(), b"balsave_identity", b"scram-sha-256",
        ).decode()
        connection.execute(sql.SQL("ALTER ROLE balsave_identity LOGIN PASSWORD {}").format(sql.Literal(verifier)))


if __name__ == "__main__":
    try:
        main()
    except (KeyError, psycopg.Error):
        raise SystemExit("Could not configure the identity database role.") from None
