from datetime import date
from unittest import TestCase

from app.installment_planning import ObservedInstallment, planned_installments


class InstallmentPlanningTests(TestCase):
    def installment(
        self, number: int, posted_on: str, *, amount_cents: int = 80901,
        purchase: str | None = "2026-10-16", transaction_id: str | None = None,
    ) -> ObservedInstallment:
        return ObservedInstallment(
            transaction_id or f"purchase-{number}", f"Store PARC {number:02}/10 City", "Compras",
            date.fromisoformat(purchase) if purchase else None, date.fromisoformat(posted_on),
            number, 10, amount_cents,
        )

    def test_projects_the_remaining_installments_using_the_previous_amount(self):
        first = self.installment(1, "2026-10-16")
        plans = planned_installments([first], date(2026, 11, 15))
        self.assertEqual([row["number"] for row in plans], list(range(2, 11)))
        self.assertEqual(plans[0], {
            "id": "purchase-1:2", "transactionId": "purchase-1", "name": "Store City",
            "categoryTransactionId": "purchase-1",
            "category": "Compras", "date": "2026-11-16", "number": 2, "count": 10, "amountCents": 80901,
        })
        self.assertEqual(plans[1]["date"], "2026-12-16")
        self.assertEqual(plans[-1]["date"], "2027-07-16")

    def test_waits_for_a_sync_through_the_second_missing_date(self):
        first = self.installment(1, "2026-10-16")
        for through in (None, date(2026, 11, 20), date(2026, 12, 15)):
            with self.subTest(through=through):
                self.assertEqual(planned_installments([first], through)[0]["date"], "2026-11-16")
        self.assertEqual(planned_installments([first], date(2026, 12, 16)), [])

    def test_reconciles_new_records_and_restarts_planning_after_a_late_installment(self):
        first = self.installment(1, "2026-10-16")
        third = self.installment(3, "2026-12-17", amount_cents=80899)
        plans = planned_installments([third, first], date(2026, 12, 18))
        self.assertEqual([row["number"] for row in plans], list(range(4, 11)))
        self.assertEqual(plans[0]["date"], "2027-01-17")
        self.assertEqual(plans[0]["amountCents"], 80899)
        self.assertEqual(plans[0]["transactionId"], "purchase-1")
        self.assertEqual(plans[0]["categoryTransactionId"], "purchase-3")

    def test_handles_end_of_month_without_drifting_to_an_earlier_day(self):
        first = self.installment(1, "2027-01-31", purchase="2027-01-31")
        second = self.installment(2, "2027-02-28", purchase="2027-01-31")
        self.assertEqual(planned_installments([first], None)[0]["date"], "2027-02-28")
        self.assertEqual(planned_installments([first, second], None)[0]["date"], "2027-03-31")

    def test_skips_completed_and_ambiguous_plans(self):
        first = self.installment(1, "2026-10-16")
        final = self.installment(10, "2027-07-16")
        self.assertEqual(planned_installments([first, final], None), [])
        duplicate = self.installment(1, "2026-10-16", transaction_id="other-purchase")
        self.assertEqual(planned_installments([first, duplicate], None), [])
        missing_date = self.installment(2, "2026-11-16", purchase=None)
        self.assertEqual(planned_installments([first, missing_date], None), [])
