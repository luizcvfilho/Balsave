import os
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from unittest import TestCase, skipUnless
from uuid import UUID

import psycopg
from psycopg.errors import CheckViolation, SerializationFailure


DATABASE_URL = os.getenv("BALSAVE_TEST_DATABASE_URL")


@skipUnless(DATABASE_URL, "Set BALSAVE_TEST_DATABASE_URL to a migrated test database.")
class RefundTests(TestCase):
    def setUp(self) -> None:
        self.db = psycopg.connect(DATABASE_URL)
        self.addCleanup(self.db.close)
        self.user = self.db.execute("INSERT INTO balsave.users DEFAULT VALUES RETURNING id").fetchone()[0]
        self.account = self.db.execute(
            """
            INSERT INTO balsave.accounts (user_id, name, kind, currency)
            VALUES (%s, 'Test account', 'credit_card', 'BRL') RETURNING id
            """,
            (self.user,),
        ).fetchone()[0]

    def transaction(
        self,
        amount: str,
        direction: str = "credit",
        kind: str = "refund",
        currency: str = "BRL",
        status: str = "posted",
    ) -> UUID:
        return self.db.execute(
            """
            INSERT INTO balsave.transactions
                (user_id, account_id, occurred_on, description, amount, currency, direction, status, kind)
            VALUES (%s, %s, '2026-11-01', 'Test entry', %s, %s, %s, %s, %s) RETURNING id
            """,
            (self.user, self.account, amount, currency, direction, status, kind),
        ).fetchone()[0]

    def link(self, db: psycopg.Connection, credit: UUID, expense: UUID) -> None:
        db.execute(
            """
            INSERT INTO balsave.refunds (refund_transaction_id, user_id, expense_transaction_id)
            VALUES (%s, %s, %s)
            """,
            (credit, self.user, expense),
        )

    def test_partial_refunds_use_exact_amounts(self) -> None:
        expense = self.transaction("0.300001", "debit", "expense")
        self.link(self.db, self.transaction("0.100001"), expense)
        self.link(self.db, self.transaction("0.20"), expense)

        total = self.db.execute(
            """
            SELECT sum(transactions.amount)
            FROM balsave.refunds
            JOIN balsave.transactions ON transactions.id = refunds.refund_transaction_id
            WHERE refunds.expense_transaction_id = %s
            """,
            (expense,),
        ).fetchone()[0]
        self.assertEqual(total, Decimal("0.300001"))

        with self.assertRaises(CheckViolation), self.db.transaction():
            self.link(self.db, self.transaction("0.000001"), expense)

        with self.assertRaises(CheckViolation), self.db.transaction():
            self.db.execute("UPDATE balsave.transactions SET amount = 0.30 WHERE id = %s", (expense,))

    def test_refund_must_be_a_posted_credit_in_the_expense_currency(self) -> None:
        expense = self.transaction("100", "debit", "expense")
        for credit in (
            self.transaction("10", direction="debit"),
            self.transaction("10", kind="income"),
            self.transaction("10", currency="USD"),
            self.transaction("10", status="pending"),
        ):
            with self.subTest(credit=credit), self.assertRaises(CheckViolation), self.db.transaction():
                self.link(self.db, credit, expense)

        credit = self.transaction("10")
        self.link(self.db, credit, expense)
        with self.assertRaises(CheckViolation), self.db.transaction():
            self.db.execute("UPDATE balsave.transactions SET currency = 'USD' WHERE id = %s", (credit,))

    def test_concurrent_refunds_cannot_exceed_the_expense(self) -> None:
        self.addCleanup(self.delete_committed_owner)
        for isolation in (psycopg.IsolationLevel.READ_COMMITTED, psycopg.IsolationLevel.REPEATABLE_READ):
            with self.subTest(isolation=isolation):
                self.assert_concurrent_refund_rejected(isolation)

    def assert_concurrent_refund_rejected(self, isolation: psycopg.IsolationLevel) -> None:
        expense = self.transaction("100", "debit", "expense")
        first_credit = self.transaction("60")
        second_credit = self.transaction("60")
        self.db.commit()

        with psycopg.connect(DATABASE_URL) as second, ThreadPoolExecutor(max_workers=1) as executor:
            second.isolation_level = isolation
            second.execute("SET LOCAL statement_timeout = '5s'")
            second.execute("SELECT id FROM balsave.transactions WHERE id = %s", (expense,))
            with self.db.transaction():
                self.link(self.db, first_credit, expense)
                attempt = executor.submit(self.link, second, second_credit, expense)

            with self.assertRaises((CheckViolation, SerializationFailure)):
                attempt.result(timeout=6)
            second.rollback()

    def delete_committed_owner(self) -> None:
        self.db.rollback()
        with self.db.transaction():
            for query in (
                "DELETE FROM balsave.refunds WHERE user_id = %s",
                "DELETE FROM balsave.transactions WHERE user_id = %s",
                "DELETE FROM balsave.accounts WHERE user_id = %s",
                "DELETE FROM balsave.users WHERE id = %s",
            ):
                self.db.execute(query, (self.user,))
