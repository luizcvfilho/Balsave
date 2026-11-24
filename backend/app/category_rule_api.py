"""Preview and save user rules without changing the upstream classifications."""

import re
from datetime import datetime
from hmac import compare_digest
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator

from app import auth, category_rule_store, category_rules, category_store, database, pluggy
from app import pluggy_preview as preview


router = APIRouter(prefix="/_internal/pluggy", include_in_schema=False)


class RuleDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ruleId: UUID | None = None
    categoryId: UUID
    description: str = Field(min_length=1, max_length=200)
    matchType: Literal["exact", "contains", "starts_with", "ends_with"] = "exact"
    accountId: UUID | None = None
    priority: int = Field(default=100, ge=1, le=1000, strict=True)
    applyToHistory: StrictBool = False
    enabled: StrictBool = True

    @field_validator("description")
    @classmethod
    def valid_description(cls, value: str) -> str:
        if not value.strip() or re.search(r"[\x00-\x1f\x7f]", value):
            raise ValueError("Rule descriptions require visible text without control characters.")
        return " ".join(value.split())


class RuleSave(RuleDraft):
    previewFingerprint: str = Field(pattern=r"^[0-9a-f]{64}$")


class RuleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ruleId: UUID
    enabled: StrictBool | None = None
    remove: StrictBool = False


def _context(connection, owner: UUID, items: tuple[UUID, ...], draft: dict):
    # Serialize the full read/preview/write transaction with other preference
    # writers, including other backend processes.
    category_store._lock_owner(connection, owner)
    categories = category_store.ensure_default_categories(connection, owner)
    rules = category_rule_store.list_rules(connection, owner)
    assignments = category_store.assignments(connection, owner)
    if draft.get("ruleId") and not any(row["id"] == draft["ruleId"] for row in rules):
        raise HTTPException(status_code=404, detail="The rule is unavailable for this owner")
    if not any(row["id"] == draft["categoryId"] and not row["archived"] for row in categories):
        raise HTTPException(status_code=404, detail="The category is unavailable for new rules")
    data = preview.owner_snapshot(owner, items, connection) if items else {"transactions": [], "cards": [], "accounts": []}
    if data.get("failedConnections") or data.get("failedInvestments"):
        raise HTTPException(status_code=503, detail="Rule preview requires all connected data to be available")
    if draft.get("accountId") and not any(
        row["id"] == draft["accountId"] for row in [*data.get("accounts", []), *data.get("cards", [])]
    ):
        raise HTTPException(status_code=404, detail="The account is unavailable for this owner")
    return data, categories, assignments, rules


def _today():
    return datetime.now(ZoneInfo("America/Sao_Paulo")).date()


@router.post("/category-rule-preview")
def preview_rule(payload: RuleDraft, owner: UUID = Depends(auth.require_user)):
    try:
        items = preview.owner_items(owner)
        draft = payload.model_dump(mode="json")
        with preview.owner_snapshot_lock(owner), database.connect() as connection:
            data, categories, assignments, rules = _context(connection, owner, items, draft)
            result = category_rules.preview_rule(data, categories, assignments, rules, draft, _today())
    except category_store.CategoryNotFound:
        raise HTTPException(status_code=404, detail="The rule or category is unavailable for this owner") from None
    except ValueError:
        raise HTTPException(status_code=422, detail="The rule criteria are invalid") from None
    except (KeyError, psycopg.Error, pluggy.PluggyError):
        raise HTTPException(status_code=503, detail="Could not preview classification rule") from None
    return preview.response({"preview": result})


@router.post("/category-rule-save")
def save_rule(payload: RuleSave, owner: UUID = Depends(auth.require_user)):
    try:
        items = preview.owner_items(owner)
        draft = payload.model_dump(mode="json", exclude={"previewFingerprint"})
        with preview.owner_snapshot_lock(owner), database.connect() as connection:
            data, categories, assignments, rules = _context(connection, owner, items, draft)
            today = _today()
            result = category_rules.preview_rule(data, categories, assignments, rules, draft, today)
            if not compare_digest(payload.previewFingerprint, result["fingerprint"]):
                raise HTTPException(status_code=409, detail="The rule preview changed; preview again before saving")
            candidate = category_rules.normalize_draft(draft, rules, today)
            rule = category_rule_store.save_rule(connection, owner, candidate)
    except category_store.CategoryNotFound:
        raise HTTPException(status_code=404, detail="The rule or category is unavailable for this owner") from None
    except ValueError:
        raise HTTPException(status_code=422, detail="The rule criteria are invalid") from None
    except (KeyError, psycopg.Error, pluggy.PluggyError):
        raise HTTPException(status_code=503, detail="Could not save classification rule") from None
    return preview.response({"rule": rule})


@router.post("/category-rule-update")
def update_rule(payload: RuleUpdate, owner: UUID = Depends(auth.require_user)):
    if (payload.remove and payload.enabled is not None) or (not payload.remove and payload.enabled is not False):
        raise HTTPException(status_code=422, detail="Disable or remove the rule; enabling requires a new preview")
    try:
        with preview.owner_snapshot_lock(owner), database.connect() as connection:
            if payload.remove:
                category_rule_store.delete_rule(connection, owner, payload.ruleId)
            else:
                category_rule_store.disable_rule(connection, owner, payload.ruleId)
    except category_store.CategoryNotFound:
        raise HTTPException(status_code=404, detail="The rule is unavailable for this owner") from None
    except (KeyError, psycopg.Error):
        raise HTTPException(status_code=503, detail="Could not update classification rule") from None
    return preview.response({"saved": True})
