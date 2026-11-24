"""Verify Better Auth sessions and enforce shared request limits."""

import os
import re
from hmac import compare_digest, digest
from ipaddress import IPv6Address, ip_address, ip_network
from typing import Annotated
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from starlette.requests import ClientDisconnect

from app import database

RATE_WINDOW_SECONDS = 15 * 60
SESSION_ID = re.compile(r"Bearer ([0-9a-f-]{36})")
SERVICE_SECRET = re.compile(r"[!-~]{32,}")
NO_STORE = {"Cache-Control": "no-store"}


def error(status: int, detail: str) -> HTTPException:
    return HTTPException(status_code=status, detail=detail, headers=NO_STORE)


def require_internal(request: Request) -> bytes:
    secret = os.getenv("BALSAVE_AUTH_SECRET", "")
    if not secret:
        raise error(404, "Internal application access is disabled")
    if not SERVICE_SECRET.fullmatch(secret):
        raise error(503, "Internal application access is unavailable")
    expected = secret.encode("ascii")
    supplied = request.headers.get("x-balsave-internal", "").encode("latin-1")
    if not compare_digest(supplied, expected):
        raise error(403, "Internal application access is required")
    return expected


InternalSecret = Annotated[bytes, Depends(require_internal)]
router = APIRouter(prefix="/_internal/auth", include_in_schema=False)


def require_user(request: Request, _secret: InternalSecret) -> UUID:
    match = SESSION_ID.fullmatch(request.headers.get("authorization", ""))
    if not match:
        raise error(401, "Authentication required")
    try:
        session_id = UUID(match[1])
    except ValueError:
        raise error(401, "Authentication required") from None
    try:
        with database.connect() as connection:
            owner = connection.execute(
                """
                SELECT identity.owner_id
                FROM balsave_identity.session AS session
                JOIN balsave_identity."user" AS identity ON identity.id = session."userId"
                WHERE session.id = %s AND session."expiresAt" > CURRENT_TIMESTAMP
                """,
                (session_id,),
            ).fetchone()
    except (KeyError, psycopg.Error):
        raise error(503, "Session verification unavailable") from None
    if owner is None:
        raise error(401, "Authentication required")
    return owner[0]


async def read_attempt(request: Request) -> tuple[str, str]:
    if request.headers.get("content-type", "").partition(";")[0].lower() != "application/json":
        raise error(422, "Invalid authentication attempt")
    try:
        data = await request.json()
    except (ClientDisconnect, ValueError, RecursionError):
        raise error(422, "Invalid authentication attempt") from None
    if (
        not isinstance(data, dict) or data.keys() != {"mode", "email"}
        or data["mode"] not in ("login", "register")
        or not isinstance(data["email"], str) or not 1 <= len(data["email"]) <= 254
        or not data["email"].isascii()
    ):
        raise error(422, "Invalid authentication attempt")
    return data["mode"], data["email"].strip().lower()


def client_rate_group(request: Request) -> str:
    try:
        address = ip_address(request.headers.get("x-balsave-client-ip", ""))
    except ValueError:
        return "unknown"
    if isinstance(address, IPv6Address):
        return str(address.ipv4_mapped or ip_network((address, 64), strict=False))
    return str(address)


def charge_attempt(connection, key: bytes, maximum: int) -> bool:
    return connection.execute(
        """
        INSERT INTO balsave.auth_rate_limits AS limit_row (key_hash, attempts, expires_at)
        VALUES (%s, 1, CURRENT_TIMESTAMP + %s * INTERVAL '1 second')
        ON CONFLICT (key_hash) DO UPDATE SET
            attempts = CASE WHEN limit_row.expires_at <= CURRENT_TIMESTAMP
                THEN 1 ELSE limit_row.attempts + 1 END,
            expires_at = CASE WHEN limit_row.expires_at <= CURRENT_TIMESTAMP
                THEN EXCLUDED.expires_at ELSE limit_row.expires_at END
        WHERE limit_row.expires_at <= CURRENT_TIMESTAMP OR limit_row.attempts < %s
        RETURNING 1
        """,
        (key, RATE_WINDOW_SECONDS, maximum),
    ).fetchone() is not None


def enforce_rate_limits(*limits: tuple[bytes, int], detail: str) -> None:
    with database.connect() as connection:
        connection.execute("""
            DELETE FROM balsave.auth_rate_limits WHERE key_hash IN (
                SELECT key_hash FROM balsave.auth_rate_limits WHERE expires_at <= CURRENT_TIMESTAMP
                ORDER BY expires_at LIMIT 50 FOR UPDATE SKIP LOCKED
            )
        """)
        # Release cleanup locks before taking the current IP and email locks.
        connection.commit()
        allowed = all(charge_attempt(connection, key, maximum) for key, maximum in limits)
    if not allowed:
        raise error(429, detail)


@router.post("/attempt")
def authentication_attempt(request: Request, secret: InternalSecret, attempt: Annotated[tuple[str, str], Depends(read_attempt)]):
    mode, email = attempt
    ip_maximum, email_maximum = (8, 5) if mode == "register" else (30, 10)
    ip_key = digest(secret, f"{mode}/ip/{client_rate_group(request)}".encode(), "sha256")
    email_key = digest(secret, f"{mode}/email/{email}".encode(), "sha256")
    try:
        enforce_rate_limits((ip_key, ip_maximum), (email_key, email_maximum), detail="Too many authentication attempts")
    except (KeyError, psycopg.Error):
        raise error(503, "Authentication rate limit unavailable") from None
    return Response(status_code=204, headers=NO_STORE)
