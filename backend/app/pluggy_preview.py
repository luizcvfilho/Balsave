import os
from copy import deepcopy
from hashlib import sha256
from hmac import compare_digest, digest
from threading import Lock
from time import monotonic
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app import category_catalog, category_rule_store, category_store, database, pluggy
from app.category_resolution import apply_categories
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
cached_snapshot: tuple[tuple[UUID, tuple[UUID, ...]], float, dict] | None = None


class Connection(BaseModel):
    itemId: UUID


class ReconciliationDecision(BaseModel):
    entryId: str = Field(pattern=r"^[0-9a-f-]{36}\.[0-9a-f-]{36}$")
    counterpartId: str | None = Field(default=None, pattern=r"^[0-9a-f-]{36}\.[0-9a-f-]{36}$")
    remove: bool = False


class PositionLink(BaseModel):
    investmentId: UUID
    accountId: UUID | None = None


def response(content: dict) -> JSONResponse:
    return JSONResponse(content, headers={"Cache-Control": "no-store"})


def public_snapshot(data: dict) -> dict:
    result = deepcopy(data)
    for record in [*result["accounts"], *result.get("investments", []), *result["transactions"]]:
        for key in [key for key in record if key.startswith("_")]:
            del record[key]
    return result


def load_owner_snapshot(owner: UUID, items: tuple[UUID, ...], connection) -> dict:
    decisions = {row[0]: {"counterpartId": row[1], "fingerprint": row[2]} for row in connection.execute(
        "SELECT entry_id, counterpart_id, fingerprint FROM balsave.reconciliation_decisions WHERE user_id = %s", (owner,),
    ).fetchall()}
    links = {str(row[0]): str(row[1]) if row[1] else None for row in connection.execute(
        "SELECT investment_id, account_id FROM balsave.investment_account_links WHERE user_id = %s", (owner,),
    ).fetchall()}
    key = api_key()
    catalog, stale = category_catalog.load_catalog(connection, key)
    data = load_snapshot(items, key, decisions=decisions, position_links=links, include_evidence=True, catalog=catalog)
    data["categoryCatalogStale"] = stale
    return apply_owner_categories(connection, owner, data)


def apply_owner_categories(connection, owner: UUID, data: dict) -> dict:
    # Re-read preferences even for cached financial data so changes made by
    # another backend worker become visible without another provider fetch.
    categories = category_store.ensure_default_categories(connection, owner)
    rules = category_rule_store.list_rules(connection, owner)
    apply_categories(data, categories, category_store.assignments(connection, owner), rules)
    data["categories"] = categories
    data["categoryRules"] = rules
    return data


def owner_snapshot(owner: UUID, items: tuple[UUID, ...], connection) -> dict:
    """Read owned financial facts; callers hold snapshot_lock while using them."""
    global cached_snapshot
    now = monotonic()
    if cached_snapshot and cached_snapshot[0] == (owner, items) and now < cached_snapshot[1]:
        return apply_owner_categories(connection, owner, cached_snapshot[2])
    data = load_owner_snapshot(owner, items, connection)
    if not data["failedConnections"] and not data["failedInvestments"]:
        cached_snapshot = ((owner, items), monotonic() + 300, data)
    return data


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
    try:
        owner, items = owner_and_items()
        if not items:
            return response({"connected": False})
        with snapshot_lock:
            with database.connect() as connection:
                data = owner_snapshot(owner, items, connection)
    except (KeyError, psycopg.Error, pluggy.PluggyError):
        raise HTTPException(status_code=503, detail="Could not load financial data") from None
    return response({"connected": True, "data": public_snapshot(data)})


@router.post("/reconciliation")
def reconcile_transfer(payload: ReconciliationDecision) -> JSONResponse:
    global cached_snapshot
    try:
        owner, items = owner_and_items()
        with snapshot_lock, database.connect() as connection:
            connection.execute("SELECT user_id FROM balsave.preview_owner WHERE user_id = %s FOR UPDATE", (owner,)).fetchone()
            if payload.remove:
                connection.execute(
                    "DELETE FROM balsave.reconciliation_decisions WHERE user_id = %s AND (entry_id = %s OR counterpart_id = %s)",
                    (owner, payload.entryId, payload.entryId),
                )
            else:
                data = load_owner_snapshot(owner, items, connection)
                chosen = {"entryId": payload.entryId, "counterpartId": payload.counterpartId}
                reverse = {"entryId": payload.counterpartId, "counterpartId": payload.entryId}
                entries = {entry["id"]: entry for entry in data["transactions"]}
                existing = entries.get(payload.entryId, {})
                if existing.get("reconciliation") == "confirmed" and existing.get("counterpartId") == payload.counterpartId:
                    return response({"saved": True})
                if chosen not in data["reconciliationCandidates"] and reverse not in data["reconciliationCandidates"]:
                    raise HTTPException(status_code=409, detail="The reconciliation candidate is no longer available")
                selected = [payload.entryId] + ([payload.counterpartId] if payload.counterpartId else [])
                for entry_id in selected:
                    counterpart = payload.counterpartId if entry_id == payload.entryId else payload.entryId
                    connection.execute(
                        "INSERT INTO balsave.reconciliation_decisions (user_id, entry_id, counterpart_id, fingerprint) VALUES (%s, %s, %s, %s)",
                        (owner, entry_id, counterpart, entries[entry_id]["_fingerprint"]),
                    )
            cached_snapshot = None
    except (KeyError, psycopg.Error, pluggy.PluggyError):
        raise HTTPException(status_code=503, detail="Could not save reconciliation") from None
    return response({"saved": True})


@router.post("/position-links")
def link_position(payload: PositionLink) -> JSONResponse:
    global cached_snapshot
    try:
        owner, items = owner_and_items()
        with snapshot_lock, database.connect() as connection:
            connection.execute("SELECT user_id FROM balsave.preview_owner WHERE user_id = %s FOR UPDATE", (owner,)).fetchone()
            data = load_owner_snapshot(owner, items, connection)
            investments = {position["id"]: position for position in data["investments"]}
            accounts = {account["id"]: account for account in data["accounts"]}
            investment = investments.get(str(payload.investmentId))
            account = accounts.get(str(payload.accountId)) if payload.accountId else None
            if investment is None or (payload.accountId and account is None):
                raise HTTPException(status_code=403, detail="The position is not available for this connection")
            connection.execute(
                """INSERT INTO balsave.investment_account_links (user_id, investment_id, account_id) VALUES (%s, %s, %s)
                ON CONFLICT (user_id, investment_id) DO UPDATE SET account_id = EXCLUDED.account_id""",
                (owner, payload.investmentId, payload.accountId),
            )
            cached_snapshot = None
    except (KeyError, psycopg.Error, pluggy.PluggyError):
        raise HTTPException(status_code=503, detail="Could not save investment balance settings") from None
    return response({"saved": True})
