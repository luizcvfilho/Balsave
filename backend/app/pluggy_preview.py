import os
from hashlib import sha256
from hmac import compare_digest, digest
from threading import Lock
from time import monotonic
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app import database, pluggy
from app.financial_snapshot import load_snapshot


def require_preview_service(authorization: str = Header(default="")) -> None:
    password = os.getenv("BALSAVE_PREVIEW_PASSWORD", "")
    if len(password) < 32:
        raise HTTPException(status_code=404)
    expected = "Bearer " + digest(password.encode(), b"balsave/preview/backend", sha256).hex()
    if not compare_digest(authorization.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Authentication required")


router = APIRouter(
    prefix="/_internal/pluggy",
    dependencies=[Depends(require_preview_service)],
    include_in_schema=False,
)

snapshot_lock = Lock()
cached_snapshot: tuple[tuple[UUID, ...], float, dict] | None = None


class Connection(BaseModel):
    itemId: UUID


def response(content: dict) -> JSONResponse:
    return JSONResponse(content, headers={"Cache-Control": "no-store"})


def owner_and_items() -> tuple[UUID, tuple[UUID, ...]]:
    with database.connect() as connection:
        owner = connection.execute("SELECT user_id FROM balsave.preview_owner").fetchone()
        if owner is None:
            raise psycopg.Error("Missing preview owner")
        user_id = owner[0]
        items = connection.execute(
            "SELECT item_id FROM balsave.pluggy_connections WHERE user_id = %s ORDER BY created_at, item_id",
            (user_id,),
        ).fetchall()
    return user_id, tuple(item[0] for item in items)


def api_key() -> str:
    client_id = os.getenv("PLUGGY_CLIENT_ID", "").strip()
    client_secret = os.getenv("PLUGGY_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        raise pluggy.PluggyError("Pluggy application credentials are missing.")
    return pluggy.authenticate(client_id, client_secret)


@router.post("/token")
def create_token() -> JSONResponse:
    try:
        owner, _ = owner_and_items()
        token = pluggy.request(
            "/connect_token", api_key=api_key(), body={"options": {"clientUserId": str(owner)}},
        ).get("accessToken")
        if not isinstance(token, str) or not token:
            raise pluggy.PluggyError("Pluggy returned an invalid Connect token.")
    except (KeyError, psycopg.Error, pluggy.PluggyError):
        raise HTTPException(status_code=503, detail="Could not start Pluggy Connect") from None
    return response({"accessToken": token, "connectorId": pluggy.MEU_PLUGGY_CONNECTOR_ID})


@router.post("/connections")
def save_connection(payload: Connection) -> JSONResponse:
    try:
        owner, items = owner_and_items()
        if payload.itemId in items:
            return response({"saved": True})
        item = pluggy.meu_pluggy_item(payload.itemId, api_key())
        if item.get("clientUserId") != str(owner):
            raise HTTPException(status_code=403, detail="Connection belongs to a different user")
        with database.connect() as connection:
            connection.execute(
                """
                INSERT INTO balsave.pluggy_connections (item_id, user_id)
                VALUES (%s, %s) ON CONFLICT (item_id) DO NOTHING
                """,
                (payload.itemId, owner),
            )
    except (KeyError, psycopg.Error, pluggy.PluggyError):
        raise HTTPException(status_code=503, detail="Could not save Pluggy connection") from None
    return response({"saved": True})


@router.get("/snapshot")
def snapshot() -> JSONResponse:
    global cached_snapshot

    try:
        _, items = owner_and_items()
        if not items:
            return response({"connected": False})
        with snapshot_lock:
            now = monotonic()
            if cached_snapshot and cached_snapshot[0] == items and now < cached_snapshot[1]:
                data = cached_snapshot[2]
            else:
                data = load_snapshot(items, api_key())
                if not data["failedConnections"]:
                    cached_snapshot = (items, monotonic() + 300, data)
    except (KeyError, psycopg.Error, pluggy.PluggyError):
        raise HTTPException(status_code=503, detail="Could not load financial data") from None
    return response({"connected": True, "data": data})
