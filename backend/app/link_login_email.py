"""Link a legacy financial owner to an email login as a database administrator."""

import argparse
import re
import sys
from getpass import GetPassWarning, getpass
from hashlib import scrypt
from secrets import token_bytes
from uuid import UUID
from warnings import catch_warnings, simplefilter

import psycopg

from app.database import connect_admin

# Match the email addresses accepted by Better Auth's credential form.
EMAIL = re.compile(r"(?:[a-z0-9_'+-]+\.)*[a-z0-9_'+-]*[a-z0-9_+-]@(?:[a-z0-9][a-z0-9-]*\.)+[a-z]{2,}")


def link_email(
    connection, email: str, *, username: str | None = None, preview_password_hash: str | None = None,
) -> UUID | None:
    if username is not None:
        legacy = connection.execute(
            "SELECT user_id, username, password_hash FROM balsave.auth_credentials WHERE username = %s",
            (username,),
        ).fetchone()
    else:
        legacy = connection.execute(
            """
            SELECT user_id, 'Balsave', %s::text
            FROM balsave.preview_owner AS preview
            WHERE NOT EXISTS (
                SELECT 1 FROM balsave.auth_credentials AS cred WHERE cred.user_id = preview.user_id
            )
            """,
            (preview_password_hash,),
        ).fetchone()
    if not legacy or not legacy[2]:
        return None
    owner, name, password_hash = legacy
    identity = connection.execute(
        """
        INSERT INTO balsave_identity."user" (owner_id, name, email)
        VALUES (%s, %s, %s)
        ON CONFLICT (owner_id) DO NOTHING
        RETURNING id
        """,
        (owner, name, email),
    ).fetchone()
    if identity is None:
        return None
    connection.execute(
        """
        INSERT INTO balsave_identity.account ("accountId", "providerId", "userId", password)
        VALUES (%s, 'credential', %s, %s)
        """,
        (str(identity[0]), identity[0], password_hash),
    )
    return owner


def preview_password() -> str:
    if not sys.stdin.isatty():
        raise ValueError("An interactive terminal is required to set the preview password.")
    with catch_warnings():
        simplefilter("error", GetPassWarning)
        password = getpass("New password: ")
        if not password or password != getpass("Confirm the new password: "):
            raise ValueError("Enter matching, non-empty passwords.")
    salt = token_bytes(16)
    key = scrypt(password.encode(), salt=salt, n=2**16, r=8, p=2, maxmem=80 * 2**20, dklen=32)
    return f"scrypt-v1${salt.hex()}${key.hex()}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--legacy-username", help="Link an existing username and preserve its password.")
    target.add_argument("--preview-owner", action="store_true", help="Claim a preview owner without credentials.")
    parser.add_argument("--email", required=True)
    args = parser.parse_args()
    email = args.email.strip().lower()
    if len(email) > 254 or not EMAIL.fullmatch(email):
        print("Enter a valid email address.", file=sys.stderr)
        return 1

    try:
        password_hash = preview_password() if args.preview_owner else None
        with connect_admin() as connection:
            linked = link_email(
                connection, email, username=args.legacy_username.strip().lower() if args.legacy_username else None,
                preview_password_hash=password_hash,
            )
    except (KeyboardInterrupt, EOFError):
        return 1
    except GetPassWarning:
        print("Password input could not be hidden.", file=sys.stderr)
        return 1
    except ValueError as error:
        print(error, file=sys.stderr)
        return 1
    except psycopg.errors.UniqueViolation:
        print("The email address is already in use.", file=sys.stderr)
        return 1
    except (KeyError, psycopg.Error):
        print("Could not link the login email. Check database access and apply migrations.", file=sys.stderr)
        return 1
    if linked is None:
        print("The requested owner is missing or already has login credentials.", file=sys.stderr)
        return 1
    print("Email login linked to the existing financial owner.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
