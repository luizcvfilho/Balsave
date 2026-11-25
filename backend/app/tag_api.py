"""Authenticated local tags for imported transactions."""

from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator

from app import auth, database, pluggy, pluggy_preview as preview, tag_store
from app.category_api import CategoryInput, TransactionCategory

router = APIRouter(prefix="/_internal/pluggy", include_in_schema=False)


class TagUpdate(CategoryInput):
    tagId: UUID


class TagDelete(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tagId: UUID


class TransactionReference(BaseModel):
    model_config = ConfigDict(extra="forbid")
    entryId: str = Field(pattern=r"^[0-9a-f-]{36}\.[0-9a-f-]{36}$")

    @field_validator("entryId")
    @classmethod
    def valid_reference(cls, value: str) -> str:
        return TransactionCategory.valid_reference(value)


class TransactionTags(TransactionReference):
    tagIds: list[UUID] = Field(max_length=tag_store.MAX_TRANSACTION_TAGS)

    @field_validator("tagIds")
    @classmethod
    def unique_tags(cls, value: list[UUID]) -> list[UUID]:
        if len(value) != len(set(value)):
            raise ValueError("Tag IDs must be unique.")
        return value


class TransactionTagChange(TransactionReference):
    tagId: UUID
    assigned: StrictBool


@router.get("/tags")
def catalog(owner: UUID = Depends(auth.require_user)):
    try:
        with database.connect() as connection:
            data = tag_store.catalog(connection, owner)
    except (KeyError, psycopg.Error):
        raise HTTPException(status_code=503, detail="Could not load tags") from None
    return preview.response(data)


@router.post("/tag-create")
def create(payload: CategoryInput, owner: UUID = Depends(auth.require_user)):
    try:
        with database.connect() as connection:
            tag = tag_store.create(connection, owner, payload.name)
    except tag_store.TagConflict:
        raise HTTPException(status_code=409, detail="A tag with this name already exists") from None
    except (KeyError, psycopg.Error):
        raise HTTPException(status_code=503, detail="Could not create tag") from None
    return preview.response({"tag": tag})


@router.post("/tag-update")
def update(payload: TagUpdate, owner: UUID = Depends(auth.require_user)):
    try:
        with database.connect() as connection:
            tag = tag_store.update(connection, owner, payload.tagId, payload.name)
    except tag_store.TagNotFound:
        raise HTTPException(status_code=404, detail="The tag is unavailable for this owner") from None
    except tag_store.TagConflict:
        raise HTTPException(status_code=409, detail="A tag with this name already exists") from None
    except (KeyError, psycopg.Error):
        raise HTTPException(status_code=503, detail="Could not update tag") from None
    return preview.response({"tag": tag})


@router.post("/tag-delete")
def delete(payload: TagDelete, owner: UUID = Depends(auth.require_user)):
    try:
        with database.connect() as connection:
            tag_store.delete(connection, owner, payload.tagId)
    except tag_store.TagNotFound:
        raise HTTPException(status_code=404, detail="The tag is unavailable for this owner") from None
    except (KeyError, psycopg.Error):
        raise HTTPException(status_code=503, detail="Could not delete tag") from None
    return preview.response({"deleted": True})


@router.post("/transaction-tags")
def assign(payload: TransactionTags | TransactionTagChange, owner: UUID = Depends(auth.require_user)):
    try:
        items = preview.owner_items(owner)
        with preview.owner_snapshot_lock(owner), database.connect() as connection:
            if not items:
                raise HTTPException(status_code=404, detail="The transaction is unavailable for this owner")
            data = preview.owner_snapshot(owner, items, connection)
            entry = next((entry for entry in data["transactions"] if entry["id"] == payload.entryId), None)
            if entry is None:
                if data.get("failedConnections") or data.get("failedInvestments"):
                    raise HTTPException(status_code=503, detail="Could not verify the transaction's connection")
                raise HTTPException(status_code=404, detail="The transaction is unavailable for this owner")
            # Provider transaction IDs are composed of the position ID and provider record ID.
            if not tag_store.imported_entry(entry):
                raise HTTPException(status_code=404, detail="The transaction is unavailable for this owner")
            if isinstance(payload, TransactionTagChange):
                tag_store.set_assignment(connection, owner, payload.entryId, payload.tagId, payload.assigned)
            else:
                tag_store.assign(connection, owner, payload.entryId, payload.tagIds)
    except tag_store.TagNotFound:
        raise HTTPException(status_code=404, detail="The tag is unavailable for this owner") from None
    except tag_store.TagLimitReached:
        raise HTTPException(status_code=409, detail="The transaction has reached the tag limit") from None
    except (KeyError, psycopg.Error, pluggy.PluggyError):
        raise HTTPException(status_code=503, detail="Could not save transaction tags") from None
    return preview.response({"saved": True})
