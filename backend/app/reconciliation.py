"""Reconcile structured movements without interpreting transaction descriptions."""

from collections import Counter, defaultdict
from datetime import date
from hashlib import sha256
import json


def position_id(entry: dict) -> str | None:
    return entry.get("accountId") or entry.get("investmentId")


def clear_expense_classification(entry: dict) -> None:
    for field in ("category", "categoryId", "categoryKey", "categorySource", "categoryNeedsReview", "categoryRuleId", "_automaticCategory", "paymentMethod"):
        entry.pop(field, None)


def fingerprint(entry: dict) -> str:
    values = [entry["id"], entry["date"], entry["amountCents"], position_id(entry), entry.get("balanceImpactCents"), entry.get("_evidence")]
    return sha256(json.dumps(values, separators=(",", ":")).encode()).hexdigest()


def candidate_pair(first: dict, second: dict) -> tuple[bool, bool]:
    a, b = first["_evidence"], second["_evidence"]
    if position_id(first) == position_id(second) or a["cash"] == 0 or a["cash"] != -b["cash"]:
        return False, False
    if not a["eligible"] or not b["eligible"]:
        return False, False
    if not any(abs((date.fromisoformat(x) - date.fromisoformat(y)).days) <= 3 for x in a["dates"] for y in b["dates"]):
        return False, False
    both_banks = bool(first.get("accountId") and second.get("accountId"))
    same_owner = bool(a["owner"] and a["owner"] == b["owner"])
    same_reference = bool(a["reference"] and a["reference"] == b["reference"])
    if a["owner"] and b["owner"] and not same_owner:
        return False, False
    for local, other in ((a, b), (b, a)):
        if local["counterparty"] and other["owner"] and local["counterparty"] not in (other["owner"], other.get("fundCode")):
            return False, False
    if both_banks:
        return True, same_reference or (a["selfTransfer"] and b["selfTransfer"])
    if first.get("investmentId") and second.get("investmentId"):
        return True, same_reference or (same_owner and a["operation"] == b["operation"] == "TRANSFER")
    fund_side = b if second.get("investmentId") else a
    bank_side = a if first.get("accountId") else b
    fund_document_matches = bool(fund_side.get("fundCode") and bank_side["counterparty"] == fund_side["fundCode"])
    same_connection = a["itemId"] == b["itemId"]
    return True, same_reference or fund_document_matches or (
        same_connection and bank_side["fundOperation"] and (same_owner or fund_side.get("singleAccount", False))
    )


def reconcile(entries: list[dict], positions: list[dict], decisions: dict[str, dict]) -> list[dict]:
    by_id = {entry["id"]: entry for entry in entries}
    by_position = {position["id"]: position for position in positions}
    available = [entry for entry in entries if "_evidence" in entry]
    groups = defaultdict(list)
    for entry in available:
        entry["_fingerprint"] = fingerprint(entry)
        groups[abs(entry["_evidence"]["cash"])].append(entry)
    edges = {}
    for group in groups.values():
        for index, first in enumerate(group):
            for second in group[index + 1:]:
                compatible, strong = candidate_pair(first, second)
                if compatible:
                    edges[tuple(sorted((first["id"], second["id"])))] = strong
    occupied = set()

    def link(first: dict, second: dict, method: str) -> None:
        combined_impact = first["balanceImpactCents"] + second["balanceImpactCents"]
        for current, other in ((first, second), (second, first)):
            current["kind"] = "transfer"
            clear_expense_classification(current)
            current["direction"] = "in" if current["balanceImpactCents"] > 0 else "out"
            current["internalTransfer"] = "investment" if first.get("investmentId") or second.get("investmentId") else "account"
            current["reconciliation"] = method
            current["counterpartId"] = other["id"]
            current["transferAccountId"] = position_id(other)
            current["transferCashCents"] = current["_evidence"]["cash"]
            own_position = by_position.get(position_id(current), {})
            other_position = by_position.get(position_id(other), {})
            if current.get("accountId") and other_position.get("includedInAccountId") == current["accountId"]:
                current["balanceImpactCents"] = combined_impact
                current["transferCashCents"] = 0
            elif current.get("investmentId") and own_position.get("includedInAccountId"):
                current["transferCashCents"] = 0
            if current.get("accountId") and combined_impact < 0 and other.get("investmentId"):
                current["reconciliationCostCents"] = -combined_impact
            occupied.add(current["id"])

    for entry in available:
        decision = decisions.get(entry["id"])
        if not decision or decision["fingerprint"] != entry["_fingerprint"] or entry["id"] in occupied:
            continue
        other_id = decision.get("counterpartId")
        if other_id is None:
            if entry.get("accountId") and entry["_evidence"]["fundOperation"]:
                entry.update(kind="transfer", direction="in" if entry["balanceImpactCents"] > 0 else "out",
                             internalTransfer="investment", balanceImpactCents=0, reconciliation="confirmed")
                clear_expense_classification(entry)
                occupied.add(entry["id"])
            continue
        other = by_id.get(other_id)
        reverse = decisions.get(other_id, {})
        edge = tuple(sorted((entry["id"], other_id)))
        if other and edge in edges and reverse.get("counterpartId") == entry["id"] and reverse.get("fingerprint") == other.get("_fingerprint"):
            link(entry, other, "confirmed")

    for entry in available:
        if entry.get("_includedAutomaticInvestment") and entry["id"] not in occupied:
            # Keep the original posting in the account statement and exclude it from the consolidated history.
            entry.update(reconciliation="automatic", _portfolioBalanceImpactCents=0)
            occupied.add(entry["id"])

    counts = Counter(entry_id for edge, strong in edges.items() if strong and not occupied.intersection(edge) for entry_id in edge)
    for edge, strong in edges.items():
        if strong and not occupied.intersection(edge) and all(counts[entry_id] == 1 for entry_id in edge):
            link(by_id[edge[0]], by_id[edge[1]], "automatic")

    candidates = []
    for edge in edges:
        if not occupied.intersection(edge):
            candidates.append({"entryId": edge[0], "counterpartId": edge[1]})
    for entry in available:
        position = by_position.get(position_id(entry), {})
        if entry["id"] not in occupied and entry.get("accountId") and entry["_evidence"]["fundOperation"] and (position.get("automaticBalanceCents") or 0) > 0:
            candidates.append({"entryId": entry["id"], "counterpartId": None})
    return candidates
