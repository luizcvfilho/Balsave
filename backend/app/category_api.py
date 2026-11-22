"""Authenticated local category preferences, independent of provider write APIs."""

import re
from time import monotonic
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator

from app import category_rule_store, category_store, database, pluggy
from app import pluggy_preview as preview


router = APIRouter(
    prefix="/_internal/pluggy",
    dependencies=[Depends(preview.require_preview_service)],
    include_in_schema=False,
)


class CategoryInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def valid_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if re.search(r"[\x00-\x1f\x7f]", value) or not value.strip():
            raise ValueError("Category names must contain visible text without control characters.")
        return " ".join(value.split())


class CategoryUpdate(CategoryInput):
    categoryId: UUID
    name: str | None = Field(default=None, min_length=1, max_length=80)
    archived: StrictBool | None = None


class TransactionCategory(BaseModel):
    model_config = ConfigDict(extra="forbid")
    entryId: str = Field(pattern=r"^[0-9a-f-]{36}\.[0-9a-f-]{36}$")
    categoryId: UUID | None

    @field_validator("entryId")
    @classmethod
    def valid_reference(cls, value: str) -> str:
        for part in value.split("."):
            if str(UUID(part)) != part:
                raise ValueError("The transaction reference must use canonical UUIDs.")
        return value


def account_options(owner: UUID, items: tuple[UUID, ...]) -> list[dict]:
    cached = preview.cached_snapshot
    if not cached or cached[0] != (owner, items) or monotonic() >= cached[1]:
        return []
    data = cached[2]
    return [
        {"id": row["id"], "label": " · ".join(filter(None, (
            row.get("bank"), row.get("name"), f"final {row['lastFour']}" if row.get("lastFour") else None,
        )))}
        for row in [*data.get("accounts", []), *data.get("cards", [])]
    ]


def available_expense(data: dict, entry_id: str) -> dict:
    entry = next((row for row in data["transactions"] if row["id"] == entry_id), None)
    if entry is None:
        if data.get("failedConnections"):
            raise HTTPException(status_code=503, detail="Could not verify the transaction's connection")
        raise HTTPException(status_code=404, detail="The transaction is unavailable for this owner")
    if entry["kind"] != "expense":
        raise HTTPException(status_code=409, detail="Only expenses can be categorized")
    return entry


@router.get("/categories")
def categories():
    try:
        owner, items = preview.owner_and_items()
        with preview.snapshot_lock, database.connect() as connection:
            rows = category_store.ensure_default_categories(connection, owner)
            rules = category_rule_store.list_rules(connection, owner)
            options = account_options(owner, items)
    except (KeyError, psycopg.Error):
        raise HTTPException(status_code=503, detail="Could not load categories") from None
    return preview.response({"categories": rows, "categoryRules": rules, "categoryAccounts": options})


@router.post("/category-create")
def create_category(payload: CategoryInput):
    try:
        owner, _ = preview.owner_and_items()
        with preview.snapshot_lock, database.connect() as connection:
            category_store.ensure_default_categories(connection, owner)
            category = category_store.create_category(connection, owner, payload.name)
    except category_store.CategoryConflict:
        raise HTTPException(status_code=409, detail="A category with this name already exists") from None
    except (KeyError, psycopg.Error):
        raise HTTPException(status_code=503, detail="Could not create category") from None
    return preview.response({"category": category})


@router.post("/category-update")
def update_category(payload: CategoryUpdate):
    if payload.name is None and payload.archived is None:
        raise HTTPException(status_code=422, detail="Provide a category name or archive state")
    try:
        owner, _ = preview.owner_and_items()
        with preview.snapshot_lock, database.connect() as connection:
            category = category_store.update_category(
                connection, owner, payload.categoryId, name=payload.name, archived=payload.archived,
            )
    except category_store.CategoryNotFound:
        raise HTTPException(status_code=404, detail="The category is unavailable for this owner") from None
    except category_store.CategoryConflict:
        raise HTTPException(status_code=409, detail="A category with this name already exists") from None
    except (KeyError, psycopg.Error):
        raise HTTPException(status_code=503, detail="Could not update category") from None
    return preview.response({"category": category})


@router.post("/transaction-category")
def transaction_category(payload: TransactionCategory):
    try:
        owner, items = preview.owner_and_items()
        with preview.snapshot_lock, database.connect() as connection:
            if not items:
                raise HTTPException(status_code=404, detail="The transaction is unavailable for this owner")
            data = preview.owner_snapshot(owner, items, connection)
            available_expense(data, payload.entryId)
            category_store.set_assignment(connection, owner, payload.entryId, payload.categoryId)
    except category_store.CategoryNotFound:
        raise HTTPException(status_code=404, detail="The category is unavailable for new assignments") from None
    except (KeyError, psycopg.Error, pluggy.PluggyError):
        raise HTTPException(status_code=503, detail="Could not save transaction category") from None
    return preview.response({"saved": True})
