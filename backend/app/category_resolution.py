"""Apply owner preferences to display categories, leaving financial facts intact."""

from app.categorization import CATEGORY_NAMES, category_available
from app.category_rules import first_matching_rule


CATEGORY_FIELDS = ("category", "categoryKey", "categorySource", "categoryNeedsReview")


def _automatic(entry: dict, by_code: dict[str, dict]) -> dict:
    baseline = entry["_automaticCategory"]
    key = baseline.get("categoryKey", "uncategorized")
    local = by_code.get(key)
    if local and category_available(local, entry["date"]):
        return {**baseline, "category": local["name"], "categoryId": local["id"]}
    if key.startswith("pluggy:"):
        return {**baseline, "categoryId": None}

    # A later movement cannot inherit an archived default, but its provider's
    # Portuguese category remains usable without linking to the archived row.
    provider_id = entry.get("providerCategoryId")
    provider_label = entry.get("providerCategoryLabel")
    if provider_id and provider_label and provider_label != CATEGORY_NAMES["review"]:
        return {
            "category": provider_label, "categoryKey": f"pluggy:{provider_id}",
            "categoryId": None, "categorySource": "pluggy", "categoryNeedsReview": False,
        }
    has_source = bool(provider_id or entry.get("providerCategoryName"))
    return {
        "category": CATEGORY_NAMES["review" if has_source else "uncategorized"],
        "categoryKey": "review" if has_source else "uncategorized", "categoryId": None,
        "categorySource": "pluggy" if has_source else "unclassified", "categoryNeedsReview": has_source,
    }


def apply_categories(
    data: dict, categories: list[dict], assignments: dict[str, str | None], rules: list[dict] | None = None,
) -> dict:
    """Mutate snapshot display fields; a private baseline makes reapplication safe.

    Preferences must already be scoped to the authenticated owner. Existing manual
    choices retain archived categories. Rules and automatic choices respect the
    archive day. Manual choices take precedence over every personal rule.
    """
    by_id = {category["id"]: category for category in categories}
    by_code = {category["code"]: category for category in categories if category.get("code")}
    expenses = {}
    for entry in data.get("transactions", []):
        if entry["kind"] != "expense":
            continue
        entry.setdefault("_automaticCategory", {field: entry[field] for field in CATEGORY_FIELDS if field in entry})
        entry.pop("categoryRuleId", None)
        entry_id = entry["id"]
        assigned_id = assignments.get(entry_id)
        manual = by_id.get(assigned_id) if assigned_id is not None else None
        if entry_id in assignments and assigned_id is None:
            entry.update({
                "category": CATEGORY_NAMES["uncategorized"], "categoryId": None, "categoryKey": "uncategorized",
                "categorySource": "manual", "categoryNeedsReview": False,
            })
        elif manual:
            entry.update({
                "category": manual["name"], "categoryId": manual["id"],
                "categoryKey": manual.get("code") or f"custom:{manual['id']}",
                "categorySource": "manual", "categoryNeedsReview": False,
            })
        elif rules:
            eligible = {category["id"] for category in categories if category_available(category, entry["date"])}
            rule = first_matching_rule(entry, rules, eligible)
            if rule:
                category = by_id[rule["categoryId"]]
                entry.update({
                    "category": category["name"], "categoryId": category["id"],
                    "categoryKey": category.get("code") or f"custom:{category['id']}",
                    "categorySource": "rule", "categoryNeedsReview": False, "categoryRuleId": rule["id"],
                })
            else:
                entry.update(_automatic(entry, by_code))
        else:
            entry.update(_automatic(entry, by_code))
        expenses[entry_id] = entry

    for card in data.get("cards", []):
        for plan in card.get("installments", []):
            plan.pop("categoryRuleId", None)
            source = expenses.get(plan.get("categoryTransactionId") or plan.get("transactionId"))
            if source:
                for field in (*CATEGORY_FIELDS, "categoryId", "categoryRuleId"):
                    if field in source:
                        plan[field] = source[field]
    return data
