"""Project two purchase strategies using equal starting cash and dated payments."""

from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal, localcontext
from typing import Literal

from app.installment_planning import month_after

MIN_RATE_BPS = -9_999
MAX_RATE_BPS = 10_000


@dataclass(frozen=True)
class Scenario:
    cost_cents: int
    balance_cents: int
    extra_cents: int


@dataclass(frozen=True)
class BreakEven:
    status: Literal["unique", "any", "none", "outside_range"]
    rate_bps: int | None = None


@dataclass(frozen=True)
class Simulation:
    ends_on: date
    cash: Scenario
    installments: Scenario
    advantage_cents: int
    break_even: BreakEven


def growth(annual_factor: Decimal, days: int) -> Decimal:
    return annual_factor ** (Decimal(days) / 365)


def rounded(value: Decimal) -> int:
    # Drop residual Decimal power error well below one cent before rounding ties.
    return int(value.quantize(Decimal("1e-20")).to_integral_value(rounding=ROUND_HALF_UP))


def project(initial: int, payments: list[tuple[int, int]], end: int, annual_factor: Decimal) -> Scenario:
    balance = Decimal(initial)
    extra = Decimal(0)
    last_day = 0
    for day, amount in payments:
        balance = balance * growth(annual_factor, day - last_day) - amount
        if balance < 0:
            extra -= balance
            balance = Decimal(0)
        last_day = day
    return Scenario(sum(amount for _, amount in payments), rounded(balance * growth(annual_factor, end - last_day)), rounded(extra))


def net_advantage(cash_price: int, payments: list[tuple[int, int]], end: int, annual_factor: Decimal) -> Decimal:
    # Value both strategies on the final date, including the opportunity cost of extra cash.
    return cash_price * growth(annual_factor, end) - sum(amount * growth(annual_factor, end - day) for day, amount in payments)


def break_even(cash_price: int, payments: list[tuple[int, int]], end: int) -> BreakEven:
    immediate_cost = sum(amount for day, amount in payments if day == 0)
    if end == 0 and immediate_cost == cash_price:
        return BreakEven("any")
    if end == 0 or immediate_cost >= cash_price:
        return BreakEven("none")

    # The present value of future installments strictly decreases as the rate increases.
    def advantage_at(rate_bps: Decimal) -> Decimal:
        return net_advantage(cash_price, payments, end, 1 + rate_bps / 10_000)

    low, high = Decimal(MIN_RATE_BPS), Decimal(MAX_RATE_BPS)
    tolerance = Decimal("1e-25")
    lower_advantage, upper_advantage = advantage_at(low), advantage_at(high)
    if abs(lower_advantage) < tolerance:
        return BreakEven("unique", MIN_RATE_BPS)
    if abs(upper_advantage) < tolerance:
        return BreakEven("unique", MAX_RATE_BPS)
    if lower_advantage > 0 or upper_advantage < 0:
        return BreakEven("outside_range")
    for _ in range(40):
        midpoint = (low + high) / 2
        advantage = advantage_at(midpoint)
        if abs(advantage) < tolerance:
            return BreakEven("unique", rounded(midpoint))
        if advantage > 0:
            high = midpoint
        else:
            low = midpoint
    return BreakEven("unique", rounded((low + high) / 2))


def simulate(
    *, purchase_on: date, first_due_on: date, cash_price_cents: int, down_payment_cents: int,
    installment_cents: int, installment_count: int, rate_bps: int, initial_cash_cents: int | None = None,
) -> Simulation:
    dates = [month_after(first_due_on, month, first_due_on.day) for month in range(installment_count)]
    end = (dates[-1] - purchase_on).days
    payments = [(0, down_payment_cents)] + [((due - purchase_on).days, installment_cents) for due in dates]
    initial = cash_price_cents if initial_cash_cents is None else initial_cash_cents
    with localcontext(prec=45):
        annual_factor = 1 + Decimal(rate_bps) / 10_000
        return Simulation(
            dates[-1], project(initial, [(0, cash_price_cents)], end, annual_factor),
            project(initial, payments, end, annual_factor),
            rounded(net_advantage(cash_price_cents, payments, end, annual_factor)),
            break_even(cash_price_cents, payments, end),
        )
