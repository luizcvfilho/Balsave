import re
from calendar import monthrange
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date


MAX_INSTALLMENTS = 120
INSTALLMENT_LABEL = re.compile(
    r"\bparc(?:ela)?\.?\s+(\d{1,3})\s*/\s*(\d{1,3})\b|\s+\(?(\d{1,3})\s*/\s*(\d{1,3})\)?$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class ObservedInstallment:
    transaction_id: str
    name: str
    category: str
    purchase_date: date | None
    posted_on: date
    number: int
    count: int
    amount_cents: int


def purchase_name(installment: ObservedInstallment) -> str:
    def remove_number(match: re.Match[str]) -> str:
        number = int(match[1] or match[3])
        count = int(match[2] or match[4])
        return "" if (number, count) == (installment.number, installment.count) else match[0]

    return " ".join(INSTALLMENT_LABEL.sub(remove_number, installment.name).split())


def month_after(day: date, months: int, preferred_day: int) -> date:
    year, month_index = divmod(day.year * 12 + day.month - 1 + months, 12)
    month = month_index + 1
    return date(year, month, min(preferred_day, monthrange(year, month)[1]))


def planned_installments(
    observed: Iterable[ObservedInstallment], synced_through: date | None,
) -> list[dict]:
    groups: dict[tuple[str, int, date], list[ObservedInstallment]] = defaultdict(list)
    undated: set[tuple[str, int]] = set()
    for installment in observed:
        name = purchase_name(installment).casefold()
        if not name or not 1 <= installment.number <= installment.count <= MAX_INSTALLMENTS:
            continue
        purchase = installment.purchase_date
        if purchase is None and installment.number == 1:
            purchase = installment.posted_on
        if purchase is None:
            undated.add((name, installment.count))
        else:
            groups[name, installment.count, purchase].append(installment)

    plans = []
    for (name, count, purchase), installments in groups.items():
        # Pluggy provides no purchase group ID. Repeated numbers or an undated match make the group ambiguous.
        if (name, count) in undated or len({row.number for row in installments}) != len(installments):
            continue
        latest = max(installments, key=lambda row: row.number)
        if latest.number == count or latest.amount_cents <= 0:
            continue
        expected = month_after(purchase, latest.number - 1, purchase.day)
        day = purchase.day if expected == latest.posted_on else latest.posted_on.day
        if synced_through and synced_through >= month_after(latest.posted_on, 2, day):
            continue

        source = min(installments, key=lambda row: row.number)
        for number in range(latest.number + 1, count + 1):
            plans.append({
                "id": f"{source.transaction_id}:{number}",
                "transactionId": source.transaction_id,
                "name": purchase_name(latest),
                "category": latest.category,
                "date": month_after(latest.posted_on, number - latest.number, day).isoformat(),
                "number": number,
                "count": count,
                "amountCents": latest.amount_cents,
            })
    return sorted(plans, key=lambda plan: (plan["date"], plan["id"]))
