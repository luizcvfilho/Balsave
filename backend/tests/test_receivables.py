"""Validate reimbursement input, eligibility, and saved-group projection."""
import os
from concurrent.futures import ThreadPoolExecutor
from contextlib import nullcontext
from threading import Barrier
from unittest import TestCase, skipUnless
from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

import psycopg
from fastapi import HTTPException
from pydantic import ValidationError

from app import receivable_api, receivable_store
from app.financial_snapshot import normalize_transaction
from app.receivable_api import Expectation, Link, Plan, available
from app.receivable_store import apply

OWNER = UUID(int=1)
ACCOUNT = str(UUID(int=2))
EXPENSE = f"{ACCOUNT}.{UUID(int=3)}"
CREDIT = f"{ACCOUNT}.{UUID(int=4)}"
OTHER_EXPENSE = f"{ACCOUNT}.{UUID(int=8)}"


class Results:
    def __init__(self, rows):
        self.rows = rows

    def fetchall(self):
        return self.rows


class Connection:
    def __init__(self, *rows):
        self.rows = iter(rows)

    def execute(self, *_args):
        return Results(next(self.rows))


class ReceivableTests(TestCase):
    def test_projection_preserves_unavailable_entries(self):
        expectation = UUID(int=5)
        data = {"transactions": []}
        apply(Connection([
            (EXPENSE, expectation, "Ana", 100, None, None),
            (EXPENSE, None, None, 150, CREDIT, expectation),
        ]), OWNER, data)
        self.assertEqual(data["receivableGroups"], [{"expenseId": EXPENSE, "expectations": [{"id": str(expectation), "name": "Ana", "amountCents": 100}], "receipts": [{"creditId": CREDIT, "expectationId": str(expectation), "amountCents": 150}]}])

    def test_input_rejects_duplicate_ids_and_non_integer_amounts(self):
        item = {"id": str(UUID(int=5)), "name": "Ana", "amountCents": 100}
        with self.assertRaises(ValidationError):
            Plan.model_validate({"expenseId": EXPENSE, "expectations": [item, item]})
        with self.assertRaises(ValidationError):
            Link.model_validate({"expenseId": EXPENSE, "creditId": CREDIT, "expectationId": None, "amountCents": 1.5})

    def test_credit_eligibility_excludes_investment_yield_and_pending(self):
        raw = {"id": str(UUID(int=4)), "accountId": ACCOUNT, "date": "2026-11-01", "description": "PIX", "amount": 100, "currencyCode": "BRL", "status": "POSTED", "type": "CREDIT"}
        entry = normalize_transaction(raw, ACCOUNT, "2026-11-02", False)
        self.assertTrue(entry["receivableEligible"])
        self.assertIs(available({"transactions": [entry]}, CREDIT, ("income", "credit")), entry)
        yield_entry = normalize_transaction({**raw, "operationType": "RENDIMENTO_APLIC_FINANCEIRA"}, ACCOUNT, "2026-11-02", False)
        with self.assertRaises(HTTPException):
            available({"transactions": [yield_entry]}, CREDIT, ("income", "credit"))
        self.assertIsNone(normalize_transaction({**raw, "status": "PENDING"}, ACCOUNT, "2026-11-02", False))
        converted = normalize_transaction({**raw, "currencyCode": "USD", "amountInAccountCurrency": 500}, ACCOUNT, "2026-11-02", False)
        self.assertNotIn("receivableEligible", converted)


@skipUnless(os.getenv("BALSAVE_TEST_DATABASE_URL"), "Set BALSAVE_TEST_DATABASE_URL to a migrated test database.")
class ReceivableDatabaseTests(TestCase):
    def setUp(self):
        self.db = psycopg.connect(os.environ["BALSAVE_TEST_DATABASE_URL"])
        self.addCleanup(self.db.close)
        self.owner = self.db.execute("INSERT INTO balsave.users DEFAULT VALUES RETURNING id").fetchone()[0]
        self.other = self.db.execute("INSERT INTO balsave.users DEFAULT VALUES RETURNING id").fetchone()[0]

    def test_replacing_plan_unassigns_receipts_and_preserves_owner_isolation(self):
        first = Expectation(id=uuid4(), name="Ana", amountCents=100)
        second = Expectation(id=uuid4(), name="Bia", amountCents=200)
        receivable_store.replace_plan(self.db, self.owner, EXPENSE, [first, second])
        self.db.execute("INSERT INTO balsave.receivable_receipts (user_id, expense_id, credit_id, expectation_id, amount_cents) VALUES (%s, %s, %s, %s, %s)", (self.owner, EXPENSE, CREDIT, first.id, 150))
        receivable_store.replace_plan(self.db, self.owner, EXPENSE, [second])
        data = receivable_store.apply(self.db, self.owner, {})
        self.assertEqual(data["receivableGroups"][0]["receipts"][0]["expectationId"], None)
        self.assertEqual(receivable_store.apply(self.db, self.other, {})["receivableGroups"], [])
        receivable_store.replace_plan(self.db, self.owner, EXPENSE, [])
        self.assertEqual(receivable_store.apply(self.db, self.owner, {})["receivableGroups"][0]["expectations"], [])

    def test_expectation_id_cannot_move_between_expenses(self):
        item = Expectation(id=uuid4(), name="Ana", amountCents=100)
        receivable_store.replace_plan(self.db, self.owner, EXPENSE, [item])
        with self.assertRaises(ValueError):
            receivable_store.replace_plan(self.db, self.owner, CREDIT, [item])

    def test_workers_cannot_allocate_the_same_credit_to_two_expenses(self):
        self.db.commit()

        def remove_test_owners():
            self.db.execute("DELETE FROM balsave.receivable_receipts WHERE user_id = %s", (self.owner,))
            self.db.execute("DELETE FROM balsave.users WHERE id IN (%s, %s)", (self.owner, self.other))
            self.db.commit()

        self.addCleanup(remove_test_owners)
        entries = [
            {"id": expense, "accountId": ACCOUNT, "kind": "expense", "receivableEligible": True,
             "amountCents": 1000, "date": "2026-01-02"}
            for expense in (EXPENSE, OTHER_EXPENSE)
        ]
        entries.append({"id": CREDIT, "accountId": ACCOUNT, "kind": "credit", "receivableEligible": True,
                        "amountCents": 1000, "date": "2026-01-03"})
        start = Barrier(2, timeout=5)

        def connect_as_app():
            return psycopg.connect(os.environ["BALSAVE_TEST_DATABASE_URL"], options="-c role=balsave_app")

        def attempt(expense):
            start.wait()
            payload = Link(expenseId=expense, creditId=CREDIT, expectationId=None, amountCents=1000)
            try:
                return receivable_api.save_link(payload, self.owner).status_code
            except HTTPException as error:
                return error.status_code

        with (patch.object(receivable_api.database, "connect", side_effect=connect_as_app),
              patch.object(receivable_api.preview, "owner_snapshot_lock", side_effect=lambda owner: nullcontext()),
              patch.object(receivable_api, "snapshot", return_value={"transactions": entries}),
              ThreadPoolExecutor(max_workers=2) as workers):
            self.assertCountEqual(workers.map(attempt, (EXPENSE, OTHER_EXPENSE)), [200, 409])
        groups = receivable_store.apply(self.db, self.owner, {})["receivableGroups"]
        self.assertEqual(len(groups), 1)
        self.assertEqual(groups[0]["receipts"][0]["creditId"], CREDIT)


class ReceivableEndpointTests(TestCase):
    def setUp(self):
        self.connection = MagicMock()
        self.connection.__enter__.return_value = self.connection
        self.connection.execute.return_value.fetchone.return_value = None
        self.data = {"transactions": [
            {"id": EXPENSE, "accountId": ACCOUNT, "kind": "expense", "receivableEligible": True, "amountCents": 1000, "date": "2026-01-02"},
            {"id": CREDIT, "accountId": ACCOUNT, "kind": "income", "receivableEligible": True, "amountCents": 1200, "date": "2026-01-03"},
        ]}
        patches = [patch.object(receivable_api.database, "connect", return_value=self.connection),
                   patch.object(receivable_api.receivable_store, "lock"),
                   patch.object(receivable_api, "snapshot", return_value=self.data)]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)

    def test_plan_rejects_excess_expectations(self):
        payload = Plan.model_validate({"expenseId": EXPENSE, "expectations": [{"id": str(UUID(int=9)), "name": "Ana", "amountCents": 1001}]})
        with self.assertRaises(HTTPException) as error:
            receivable_api.save_plan(payload, OWNER)
        self.assertEqual(error.exception.status_code, 422)

    def test_link_validates_date_and_credit_amount_but_allows_surplus(self):
        payload = Link(expenseId=EXPENSE, creditId=CREDIT, expectationId=None, amountCents=1200)
        self.assertEqual(receivable_api.save_link(payload, OWNER).status_code, 200)
        self.data["transactions"][1]["date"] = "2026-01-01"
        with self.assertRaises(HTTPException) as error:
            receivable_api.save_link(payload, OWNER)
        self.assertEqual(error.exception.status_code, 422)
        self.data["transactions"][1]["date"] = "2026-01-03"
        payload.amountCents = 1201
        with self.assertRaises(HTTPException):
            receivable_api.save_link(payload, OWNER)

    def test_move_requires_current_expense_guard_and_remove_needs_no_snapshot(self):
        self.connection.execute.return_value.fetchone.return_value = (OTHER_EXPENSE,)
        payload = Link(expenseId=EXPENSE, creditId=CREDIT, expectationId=None, amountCents=500)
        with self.assertRaises(HTTPException) as error:
            receivable_api.save_link(payload, OWNER)
        self.assertEqual(error.exception.status_code, 409)
        payload.previousExpenseId = OTHER_EXPENSE
        self.assertEqual(receivable_api.save_link(payload, OWNER).status_code, 200)
        self.connection.execute.return_value.fetchone.return_value = (EXPENSE,)
        self.assertEqual(receivable_api.save_link(payload, OWNER).status_code, 200)
        payload.amountCents = 0
        with patch.object(receivable_api, "snapshot", side_effect=AssertionError("Removal must work offline")):
            self.assertEqual(receivable_api.save_link(payload, OWNER).status_code, 200)
