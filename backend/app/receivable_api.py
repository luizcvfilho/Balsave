"""Authenticated reimbursement plans and links to imported transactions."""
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app import auth, database, pluggy, pluggy_preview as preview, receivable_store, tag_store
from app.category_api import CategoryInput, TransactionCategory

router = APIRouter(prefix="/_internal/pluggy", include_in_schema=False)
REFERENCE = r"^[0-9a-f-]{36}\.[0-9a-f-]{36}$"


class Expectation(CategoryInput):
    id: UUID
    amountCents: int = Field(strict=True, gt=0, lt=2**53)


class Plan(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expenseId: str = Field(pattern=REFERENCE)
    expectations: list[Expectation] = Field(max_length=100)

    @field_validator("expenseId")
    @classmethod
    def valid_reference(cls, value: str) -> str:
        return TransactionCategory.valid_reference(value)

    @field_validator("expectations")
    @classmethod
    def unique_ids(cls, value: list[Expectation]) -> list[Expectation]:
        if len({item.id for item in value}) != len(value):
            raise ValueError("Expectation IDs must be unique.")
        return value


class Link(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expenseId: str = Field(pattern=REFERENCE)
    creditId: str = Field(pattern=REFERENCE)
    expectationId: UUID | None
    amountCents: int = Field(strict=True, ge=0, lt=2**53)
    previousExpenseId: str | None = Field(default=None, pattern=REFERENCE)

    @field_validator("expenseId", "creditId", "previousExpenseId")
    @classmethod
    def valid_reference(cls, value: str | None) -> str | None:
        return TransactionCategory.valid_reference(value) if value is not None else None


def available(data: dict, entry_id: str, kinds: tuple[str, ...]) -> dict:
    entry = next((entry for entry in data["transactions"] if entry["id"] == entry_id), None)
    if entry is None:
        if data.get("failedConnections") or data.get("failedInvestments"):
            raise HTTPException(status_code=503, detail="Could not verify the transaction's connection")
        raise HTTPException(status_code=404, detail="The transaction is unavailable or ineligible")
    if (not tag_store.imported_entry(entry) or not (entry.get("accountId") or entry.get("cardId"))
            or entry.get("kind") not in kinds or not entry.get("receivableEligible") or entry.get("internalTransfer")):
        raise HTTPException(status_code=404, detail="The transaction is unavailable or ineligible")
    return entry


def snapshot(owner: UUID, connection) -> dict:
    items = preview.owner_items(owner)
    if not items:
        raise HTTPException(status_code=404, detail="The transaction is unavailable or ineligible")
    preview.lock_reconciliation(connection, owner)
    # Fresh reconciliation state prevents a different worker's confirmed transfer
    # from being accepted based on an older cached snapshot.
    return preview.load_owner_snapshot(owner, items, connection)


@router.post("/receivable-plan")
def save_plan(payload: Plan, owner: UUID = Depends(auth.require_user)):
    try:
        with preview.owner_snapshot_lock(owner), database.connect() as connection:
            receivable_store.lock(connection, owner)
            if payload.expectations:
                expense = available(snapshot(owner, connection), payload.expenseId, ("expense",))
                if sum(item.amountCents for item in payload.expectations) > expense["amountCents"]:
                    raise HTTPException(status_code=422, detail="Expected amounts exceed the expense")
            receivable_store.replace_plan(connection, owner, payload.expenseId, payload.expectations)
    except ValueError:
        raise HTTPException(status_code=409, detail="Expectation belongs to another expense") from None
    except (KeyError, psycopg.Error, pluggy.PluggyError):
        raise HTTPException(status_code=503, detail="Could not save reimbursement plan") from None
    return preview.response({"saved": True})


@router.post("/receivable-link")
def save_link(payload: Link, owner: UUID = Depends(auth.require_user)):
    try:
        with preview.owner_snapshot_lock(owner), database.connect() as connection:
            receivable_store.lock(connection, owner)
            existing = connection.execute(
                "SELECT expense_id FROM balsave.receivable_receipts WHERE user_id = %s AND credit_id = %s",
                (owner, payload.creditId),
            ).fetchone()
            current_expense = existing[0] if existing else None
            if payload.amountCents == 0:
                if current_expense and current_expense != payload.expenseId:
                    raise HTTPException(status_code=409, detail="The existing link has changed")
                connection.execute(
                    "DELETE FROM balsave.receivable_receipts WHERE user_id = %s AND credit_id = %s AND expense_id = %s",
                    (owner, payload.creditId, payload.expenseId),
                )
            else:
                if current_expense and current_expense not in (payload.expenseId, payload.previousExpenseId):
                    raise HTTPException(status_code=409, detail="Credit is already linked to another expense")
                if payload.previousExpenseId and not current_expense:
                    raise HTTPException(status_code=409, detail="The existing link has changed")
                data = snapshot(owner, connection)
                expense = available(data, payload.expenseId, ("expense",))
                credit = available(data, payload.creditId, ("income", "credit"))
                if credit["date"] < expense["date"] or payload.amountCents > credit["amountCents"]:
                    raise HTTPException(status_code=422, detail="Invalid credit date or amount")
                if payload.expectationId and not connection.execute(
                    "SELECT 1 FROM balsave.receivable_expectations WHERE user_id = %s AND expense_id = %s AND id = %s",
                    (owner, payload.expenseId, payload.expectationId),
                ).fetchone():
                    raise HTTPException(status_code=404, detail="Expectation is unavailable")
                connection.execute("""
                    INSERT INTO balsave.receivable_receipts (user_id, expense_id, credit_id, expectation_id, amount_cents)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (user_id, credit_id) DO UPDATE SET expense_id = EXCLUDED.expense_id,
                        expectation_id = EXCLUDED.expectation_id, amount_cents = EXCLUDED.amount_cents
                    """, (owner, payload.expenseId, payload.creditId, payload.expectationId, payload.amountCents))
    except (KeyError, psycopg.Error, pluggy.PluggyError):
        raise HTTPException(status_code=503, detail="Could not save reimbursement link") from None
    return preview.response({"saved": True})
