import os
from collections import OrderedDict
from copy import deepcopy
from hmac import digest
from threading import Lock
from time import monotonic
from uuid import UUID
from weakref import WeakValueDictionary

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from app import auth, category_catalog, category_rule_store, category_store, database, pluggy, tag_store
from app.category_resolution import apply_categories
from app.financial_snapshot import load_snapshot


router = APIRouter(prefix="/_internal/pluggy", include_in_schema=False)

snapshot_state_lock = Lock()
owner_snapshot_locks: WeakValueDictionary[UUID, Lock] = WeakValueDictionary()
snapshot_cache: OrderedDict[UUID, tuple[tuple[UUID, ...], float, dict]] = OrderedDict()
MAX_CACHED_SNAPSHOTS = 16
SNAPSHOT_TTL_SECONDS = 300
CONNECT_TOKENS_PER_WINDOW = 8


class Connection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    itemId: UUID


class ReconciliationDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    entryId: str = Field(pattern=r"^[0-9a-f-]{36}\.[0-9a-f-]{36}$")
    counterpartId: str | None = Field(default=None, pattern=r"^[0-9a-f-]{36}\.[0-9a-f-]{36}$")
    remove: bool = False


class PositionLink(BaseModel):
    model_config = ConfigDict(extra="forbid")
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
    catalog, stale = category_catalog.load_catalog(key)
    data = load_snapshot(items, key, decisions=decisions, position_links=links, include_evidence=True, catalog=catalog)
    data["categoryCatalogStale"] = stale
    return apply_owner_preferences(connection, owner, data)


def apply_owner_preferences(connection, owner: UUID, data: dict) -> dict:
    # Re-read preferences even for cached financial data so changes made by
    # another backend worker become visible without another provider fetch.
    categories = category_store.ensure_default_categories(connection, owner)
    rules = category_rule_store.list_rules(connection, owner)
    apply_categories(data, categories, category_store.assignments(connection, owner), rules)
    data["categories"] = categories
    data["categoryRules"] = rules
    return tag_store.apply_tags(connection, owner, data)


def owner_snapshot_lock(owner: UUID) -> Lock:
    with snapshot_state_lock:
        lock = owner_snapshot_locks.get(owner)
        if lock is None:
            lock = Lock()
            owner_snapshot_locks[owner] = lock
        return lock


def cached_owner_snapshot(owner: UUID, items: tuple[UUID, ...]) -> dict | None:
    """Read only the current owner's snapshot while holding its lock."""
    with snapshot_state_lock:
        cached = snapshot_cache.get(owner)
        if cached is None:
            return None
        cached_items, expiry, data = cached
        if cached_items != items or monotonic() >= expiry:
            snapshot_cache.pop(owner)
            return None
        snapshot_cache.move_to_end(owner)
        return data


def owner_snapshot(owner: UUID, items: tuple[UUID, ...], connection) -> dict:
    """Read owned financial facts while holding the owner's lock."""
    cached = cached_owner_snapshot(owner, items)
    if cached is not None:
        return apply_owner_preferences(connection, owner, cached)
    data = load_owner_snapshot(owner, items, connection)
    if not data["failedConnections"] and not data["failedInvestments"]:
        with snapshot_state_lock:
            now = monotonic()
            for user_id, (_, expiry, _) in list(snapshot_cache.items()):
                if expiry <= now:
                    snapshot_cache.pop(user_id)
            snapshot_cache[owner] = (items, now + SNAPSHOT_TTL_SECONDS, data)
            if len(snapshot_cache) > MAX_CACHED_SNAPSHOTS:
                snapshot_cache.popitem(last=False)
    return data


def invalidate_owner_snapshot(owner: UUID) -> None:
    with snapshot_state_lock:
        snapshot_cache.pop(owner, None)


def owner_items(owner: UUID) -> tuple[UUID, ...]:
    with database.connect() as connection:
        items = connection.execute(
            "SELECT item_id FROM balsave.pluggy_connections WHERE user_id = %s ORDER BY created_at, item_id",
            (owner,),
        ).fetchall()
    return tuple(item[0] for item in items)


def api_key() -> str:
    client_id = os.getenv("PLUGGY_CLIENT_ID", "").strip()
    client_secret = os.getenv("PLUGGY_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        raise pluggy.PluggyError("Pluggy application credentials are missing.")
    return pluggy.application_api_key(client_id, client_secret)


@router.post("/token")
def create_token(secret: auth.InternalSecret, owner: UUID = Depends(auth.require_user)) -> JSONResponse:
    try:
        limit_key = digest(secret, f"pluggy/connect-token/{owner}".encode(), "sha256")
        auth.enforce_rate_limits((limit_key, CONNECT_TOKENS_PER_WINDOW), detail="Too many Connect token requests")
        token = pluggy.request(
            "/connect_token", api_key=api_key(), body={"options": {"clientUserId": str(owner)}},
        ).get("accessToken")
        if not isinstance(token, str) or not token:
            raise pluggy.PluggyError("Pluggy returned an invalid Connect token.")
    except (KeyError, psycopg.Error, pluggy.PluggyError):
        raise HTTPException(status_code=503, detail="Could not start Pluggy Connect") from None
    return response({"accessToken": token, "connectorId": pluggy.MEU_PLUGGY_CONNECTOR_ID})


@router.post("/connections")
def save_connection(payload: Connection, owner: UUID = Depends(auth.require_user)) -> JSONResponse:
    try:
        if payload.itemId in owner_items(owner):
            return response({"saved": True})
        pluggy.meu_pluggy_item(payload.itemId, api_key(), owner=owner)
        with database.connect() as connection:
            connection.execute(
                """
                INSERT INTO balsave.pluggy_connections (item_id, user_id)
                VALUES (%s, %s) ON CONFLICT (item_id) DO NOTHING
                """,
                (payload.itemId, owner),
            )
            saved = connection.execute(
                "SELECT 1 FROM balsave.pluggy_connections WHERE item_id = %s AND user_id = %s",
                (payload.itemId, owner),
            ).fetchone()
            if saved is None:
                raise HTTPException(status_code=404, detail="Connection unavailable")
    except pluggy.PluggyItemUnavailable:
        raise HTTPException(status_code=404, detail="Connection unavailable") from None
    except (KeyError, psycopg.Error, pluggy.PluggyError):
        raise HTTPException(status_code=503, detail="Could not save Pluggy connection") from None
    return response({"saved": True})


@router.get("/snapshot")
def snapshot(owner: UUID = Depends(auth.require_user)) -> JSONResponse:
    try:
        items = owner_items(owner)
        if not items:
            return response({"connected": False})
        with owner_snapshot_lock(owner):
            with database.connect() as connection:
                data = owner_snapshot(owner, items, connection)
            return response({"connected": True, "data": public_snapshot(data)})
    except (KeyError, psycopg.Error, pluggy.PluggyError):
        raise HTTPException(status_code=503, detail="Could not load financial data") from None


@router.post("/reconciliation")
def reconcile_transfer(payload: ReconciliationDecision, owner: UUID = Depends(auth.require_user)) -> JSONResponse:
    try:
        with owner_snapshot_lock(owner), database.connect() as connection:
            lock_reconciliation(connection, owner)
            if payload.remove:
                connection.execute(
                    "DELETE FROM balsave.reconciliation_decisions WHERE user_id = %s AND (entry_id = %s OR counterpart_id = %s)",
                    (owner, payload.entryId, payload.entryId),
                )
            else:
                items = owner_items(owner)
                if not items:
                    raise HTTPException(status_code=409, detail="The reconciliation candidate is no longer available")
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
            invalidate_owner_snapshot(owner)
    except (KeyError, psycopg.Error, pluggy.PluggyError):
        raise HTTPException(status_code=503, detail="Could not save reconciliation") from None
    return response({"saved": True})


@router.post("/position-links")
def link_position(payload: PositionLink, owner: UUID = Depends(auth.require_user)) -> JSONResponse:
    try:
        items = owner_items(owner)
        if not items:
            raise HTTPException(status_code=403, detail="The position is not available for this connection")
        with owner_snapshot_lock(owner), database.connect() as connection:
            lock_reconciliation(connection, owner)
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
            invalidate_owner_snapshot(owner)
    except (KeyError, psycopg.Error, pluggy.PluggyError):
        raise HTTPException(status_code=503, detail="Could not save investment balance settings") from None
    return response({"saved": True})


def lock_reconciliation(connection, owner: UUID) -> None:
    connection.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (f"balsave:reconciliation:{owner}",),
    )
