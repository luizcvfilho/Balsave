"""Match personal category rules and preview changes without altering financial facts."""

import json
import re
from copy import deepcopy
from datetime import UTC, date, datetime
from hashlib import sha256
from uuid import UUID

from app.category_store import CategoryNotFound


MATCH_TYPES = frozenset(("exact", "contains", "starts_with", "ends_with"))
DRAFT_ID = "__draft__"
DRAFT_CREATED_AT = "9999-12-31T23:59:59.999999+00:00"


def _uuid(value: object, field: str) -> str:
    try:
        if not isinstance(value, str):
            raise ValueError
        return str(UUID(value))
    except ValueError:
        raise ValueError(f"The rule {field} is invalid.") from None


def normalize_draft(draft: dict, rules: list[dict], today: date) -> dict:
    """Create the same candidate for preview/save without a volatile timestamp."""
    category_id = _uuid(draft.get("categoryId"), "category")
    description = draft.get("description")
    if not isinstance(description, str) or re.search(r"[\x00-\x1f\x7f]", description):
        raise ValueError("Rule descriptions cannot contain control characters.")
    description = " ".join(description.split())
    if not 1 <= len(description) <= 200:
        raise ValueError("Rule descriptions must contain between 1 and 200 characters.")
    match_type = draft.get("matchType", "exact")
    if not isinstance(match_type, str) or match_type not in MATCH_TYPES:
        raise ValueError("The rule match type is invalid.")
    priority = draft.get("priority", 100)
    if type(priority) is not int or not 1 <= priority <= 1000:
        raise ValueError("Rule priorities must be integers between 1 and 1000.")
    account_id = draft.get("accountId")
    if account_id is not None:
        account_id = _uuid(account_id, "account")
    history = draft.get("applyToHistory", False)
    enabled = draft.get("enabled", True)
    if type(history) is not bool or type(enabled) is not bool:
        raise ValueError("The rule scope and enabled state must be booleans.")
    existing = None
    if draft.get("ruleId") is not None:
        identifier = _uuid(draft["ruleId"], "identifier")
        existing = next((rule for rule in rules if rule["id"] == identifier), None)
        if existing is None:
            raise CategoryNotFound("The rule is unavailable for this owner.")
    return {
        "id": existing["id"] if existing else DRAFT_ID,
        "categoryId": category_id,
        "description": description,
        "matchType": match_type,
        "accountId": account_id,
        "priority": priority,
        "startsOn": None if history else today.isoformat(),
        "enabled": enabled,
        "createdAt": existing["createdAt"] if existing else DRAFT_CREATED_AT,
    }


def rule_matches(entry: dict, rule: dict) -> bool:
    """Use literal text comparisons, normalized for case and extra whitespace."""
    if entry.get("kind") != "expense" or not rule.get("enabled"):
        return False
    account_id = rule.get("accountId")
    if account_id is not None and account_id != (entry.get("accountId") or entry.get("cardId")):
        return False
    starts_on = rule.get("startsOn")
    if starts_on is not None:
        try:
            if date.fromisoformat(entry.get("date", "")) < date.fromisoformat(starts_on):
                return False
        except (TypeError, ValueError):
            return False
    name = entry.get("name")
    description = rule.get("description")
    if not isinstance(name, str) or not isinstance(description, str):
        return False
    text = " ".join(name.split()).casefold()
    pattern = " ".join(description.split()).casefold()
    if not pattern:
        return False
    match_type = rule.get("matchType")
    if match_type == "exact":
        return text == pattern
    if match_type == "contains":
        return pattern in text
    if match_type == "starts_with":
        return text.startswith(pattern)
    if match_type == "ends_with":
        return text.endswith(pattern)
    return False


def _sort_key(rule: dict) -> tuple:
    created = datetime.fromisoformat(rule["createdAt"])
    if created.tzinfo is None:
        created = created.replace(tzinfo=UTC)
    return rule["priority"], created.astimezone(UTC), rule["id"]


def first_matching_rule(entry: dict, rules: list[dict], eligible_category_ids: set[str]) -> dict | None:
    """Choose the earliest highest-priority rule targeting an eligible category."""
    return next((rule for rule in sorted(rules, key=_sort_key)
                 if rule.get("categoryId") in eligible_category_ids and rule_matches(entry, rule)), None)


def preview_rule(
    data: dict, categories: list[dict], assignments: dict[str, str],
    rules: list[dict], draft: dict, today: date,
) -> dict:
    """Count actual category changes and bind confirmation to the reviewed state."""
    # Resolution imports the small matching helper above; delaying this import
    # keeps previews and normal snapshots on exactly the same resolution path.
    from app.category_resolution import apply_categories

    candidate = normalize_draft(draft, rules, today)
    target = next((category for category in categories if category["id"] == candidate["categoryId"]), None)
    if target is None or target.get("archived"):
        raise CategoryNotFound("The category is unavailable for new rules.")
    after_rules = [rule for rule in rules if rule["id"] != candidate["id"]] + [candidate]
    before, after = deepcopy(data), deepcopy(data)
    apply_categories(before, categories, assignments, rules=rules)
    apply_categories(after, categories, assignments, rules=after_rules)
    previous = {entry["id"]: entry for entry in before.get("transactions", [])}
    changed = []
    manual = []
    for entry in after.get("transactions", []):
        if entry.get("kind") != "expense":
            continue
        original = previous[entry["id"]]
        if entry.get("categoryKey") != original.get("categoryKey"):
            changed.append(entry["id"])
        if original.get("categorySource") == "manual" and rule_matches(entry, candidate):
            manual.append(entry["id"])
    fields = ("id", "date", "kind", "name", "accountId", "cardId", "amountCents", "categoryKey",
              "providerCategoryId", "providerCategoryName", "providerCategoryLabel", "_automaticCategory")
    state = {
        "candidate": candidate,
        "categories": sorted(categories, key=lambda category: category["id"]),
        "assignments": assignments,
        "rules": sorted(rules, key=lambda rule: rule["id"]),
        "transactions": sorted(({field: entry[field] for field in fields if field in entry}
                                for entry in before.get("transactions", [])), key=lambda entry: entry["id"]),
        "affectedIds": sorted(changed),
        "manualIds": sorted(manual),
    }
    fingerprint = sha256(json.dumps(state, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()
    return {"affectedCount": len(changed), "manualCount": len(manual), "fingerprint": fingerprint}
