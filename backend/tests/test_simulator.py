from datetime import date
from unittest import TestCase

from app.simulator import BreakEven, Scenario, simulate


class PurchaseSimulatorTests(TestCase):
    def simulate(self, **overrides):
        inputs = {
            "purchase_on": date(2027, 1, 1), "first_due_on": date(2027, 1, 31),
            "cash_price_cents": 100_000, "down_payment_cents": 10_000,
            "installment_cents": 32_000, "installment_count": 3, "rate_bps": 0,
        }
        return simulate(**(inputs | overrides))

    def test_zero_yield_with_down_payment_and_cash_left_over(self):
        result = self.simulate(initial_cash_cents=120_000)
        self.assertEqual(result.cash, Scenario(100_000, 20_000, 0))
        self.assertEqual(result.installments, Scenario(106_000, 14_000, 0))
        self.assertEqual(result.advantage_cents, -6_000)

    def test_default_cash_and_shortfall_are_reported_without_negative_balances(self):
        result = self.simulate()
        self.assertEqual(result.cash, Scenario(100_000, 0, 0))
        self.assertEqual(result.installments, Scenario(106_000, 0, 6_000))
        self.assertEqual(result.advantage_cents, -6_000)

    def test_extra_cash_contributed_earlier_includes_lost_yield(self):
        result = self.simulate(
            first_due_on=date(2028, 1, 1), installment_count=1,
            installment_cents=95_000, initial_cash_cents=0, rate_bps=1_000,
        )
        self.assertEqual(result.cash, Scenario(100_000, 0, 100_000))
        self.assertEqual(result.installments, Scenario(105_000, 0, 105_000))
        self.assertEqual(result.advantage_cents, 4_000)

    def test_compounds_over_actual_dates_and_preserves_the_original_due_day(self):
        with self.subTest("short February"):
            result = self.simulate(installment_count=2, rate_bps=1_200)
            self.assertEqual(result.ends_on, date(2027, 2, 28))
            self.assertEqual(result.installments.balance_cents, 27_356)
        with self.subTest("leap February"):
            result = self.simulate(
                purchase_on=date(2028, 1, 1), first_due_on=date(2028, 1, 31), installment_count=2,
            )
            self.assertEqual(result.ends_on, date(2028, 2, 29))
        self.assertEqual(self.simulate().ends_on, date(2027, 3, 31))

    def test_exact_break_even_and_half_cent_rounding(self):
        result = self.simulate(
            first_due_on=date(2028, 1, 1), cash_price_cents=10_000, down_payment_cents=0,
            installment_count=1, installment_cents=11_000, rate_bps=1_000, initial_cash_cents=10_005,
        )
        self.assertEqual(result.break_even, BreakEven("unique", 1_000))
        self.assertEqual(result.advantage_cents, 0)
        self.assertEqual(result.cash.balance_cents, 6)
        self.assertEqual(result.installments.balance_cents, 6)

    def test_break_even_distinguishes_no_unique_rate_and_out_of_range_rates(self):
        same_day = self.simulate(first_due_on=date(2027, 1, 1), installment_count=1, installment_cents=90_000)
        self.assertEqual(same_day.break_even, BreakEven("any"))
        expensive_down_payment = self.simulate(down_payment_cents=100_000)
        self.assertEqual(expensive_down_payment.break_even, BreakEven("none"))
        outside = self.simulate(first_due_on=date(2027, 1, 2), installment_count=1, installment_cents=100_000)
        self.assertEqual(outside.break_even, BreakEven("outside_range"))

    def test_break_even_includes_the_exact_endpoints(self):
        for amount, rate in ((10, -9_999), (200_000, 10_000)):
            with self.subTest(rate=rate):
                result = self.simulate(
                    first_due_on=date(2028, 1, 1), down_payment_cents=0,
                    installment_count=1, installment_cents=amount, rate_bps=rate,
                )
                self.assertEqual(result.break_even, BreakEven("unique", rate))
                self.assertEqual(result.advantage_cents, 0)
