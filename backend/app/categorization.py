"""Resolve provider categories without changing a movement's financial nature."""

from collections.abc import Mapping
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo


DEFAULT_CATEGORIES = (
    ("food", "Alimentação"),
    ("housing", "Moradia"),
    ("transport", "Transporte"),
    ("health", "Saúde"),
    ("leisure", "Lazer"),
    ("travel", "Viagem"),
    ("shopping", "Compras"),
    ("education", "Educação"),
    ("services", "Serviços"),
    ("subscriptions", "Serviços digitais"),
    ("insurance", "Seguros"),
    ("taxes", "Impostos"),
    ("fees", "Tarifas bancárias"),
    ("donations", "Doações"),
    ("gambling", "Apostas"),
    ("loans", "Empréstimos e financiamentos"),
    ("legal", "Obrigações legais"),
    ("transfers", "Transferências"),
    ("income", "Receitas"),
    ("investments", "Investimentos"),
    ("pets", "Animais de estimação"),
    ("review", "Categoria do Pluggy para revisar"),
    ("uncategorized", "Sem categoria"),
)

CATEGORY_NAMES = dict(DEFAULT_CATEGORIES)

# These names come from Pluggy's documented category tree. The fetched category
# identifier and hierarchy take precedence; names also support old/null-ID data.
GROUPS = {
    "food": ("Groceries", "Food and drinks", "Eating out", "Food delivery"),
    "housing": ("Housing", "Rent", "Houseware", "Urban land and building tax", "Utilities", "Water", "Electricity", "Gas"),
    "transport": (
        "Transportation", "Taxi and ride-hailing", "Public transportation", "Car rental", "Bicycle", "Automotive",
        "Gas stations", "Parking", "Tolls and in-vehicle payment", "Vehicle ownership taxes and fees", "Vehicle maintenance", "Traffic tickets",
    ),
    "health": ("Healthcare", "Dentist", "Pharmacy", "Optometry", "Hospital clinics and labs", "Wellness and fitness", "Gyms and fitness centers", "Sports practice", "Wellness"),
    "leisure": ("Leisure", "Tickets", "Stadiums and arenas", "Landmarks and museums", "Cinema, theater and concerts"),
    "travel": ("Travel", "Airport and airlines", "Accommodation", "Mileage programs", "Bus tickets"),
    "shopping": ("Shopping", "Online shopping", "Electronics", "Clothing", "Kids and toys", "Bookstore", "Sports goods", "Office Supplies", "Cashback"),
    "education": ("Education", "Online Courses", "University", "School", "Kindergarten"),
    "services": ("Services", "Telecommunications", "Internet", "Mobile", "TV"),
    "subscriptions": ("Digital services", "Gaming", "Video streaming", "Music streaming"),
    "insurance": ("Insurance", "Life insurance", "Home Insurance", "Health insurance", "Vehicle insurance"),
    "taxes": ("Taxes", "Income taxes", "Taxes on investments", "Tax on financial operations"),
    "fees": ("Bank fees", "Account fees", "Wire transfer fees and ATM fees", "Credit card fees"),
    "donations": ("Donations",),
    "gambling": ("Gambling", "Lottery", "Online bet"),
    "loans": ("Loans and Financing", "Late payment and overdraft costs", "Interests charged", "Loans", "Financing", "Real estate financing", "Vehicle Financing", "Student loan"),
    "legal": ("Legal obligations", "Blocked balances", "Alimony"),
    "transfers": (
        "Same person transfer", "Same person transfer - Cash", "Same person transfer - PIX", "Same person transfer - TED",
        "Transfers", "Transfer - Bank slip (Boleto)", "Transfer - Cash", "Transfer - Check", "Transfer - DOC", "Transfer - Foreign exchange",
        "Transfer - Internal", "Transfer - PIX", "Transfer - TED", "Credit card payment", "Third-party transfers", "Bank slip", "Debt card", "DOC", "PIX", "TED",
    ),
    "income": ("Income", "Salary", "Salary/pro-labore", "Retirement", "Entrepreneurial activities", "Government aid", "Non-recurring income"),
    "investments": ("Investments", "Automatic investment", "Fixed income", "Mutual funds", "Variable income", "Margin", "Proceeds interests and dividends", "Pension"),
    "pets": ("Pet supplies and vet",),
}
GROUP_BY_NAME = {name.casefold(): code for code, names in GROUPS.items() for name in names}


def category_available(category: Mapping[str, Any], entry_date: str) -> bool:
    """Archived categories remain automatic targets through their local archive day.

    This date policy also preserves late-arriving historical transactions without
    persisting the provider's financial records. New manual choices always require
    an active category and are validated separately by the preference store.
    """
    if not category.get("archived"):
        return True
    archived_at = category.get("archivedAt")
    if not isinstance(archived_at, str):
        return False
    try:
        timestamp = datetime.fromisoformat(archived_at)
        if timestamp.tzinfo is None:
            return False
        archive_day = timestamp.astimezone(ZoneInfo("America/Sao_Paulo")).date()
        return date.fromisoformat(entry_date) <= archive_day
    except (TypeError, ValueError):
        return False


def text(value: object) -> str:
    return value.strip()[:200] if isinstance(value, str) else ""


def resolve_provider_category(
    raw: Mapping[str, Any], catalog: Mapping[str, dict] | None = None,
) -> dict[str, Any]:
    """Use the provider ID and nearest recognized ancestor before name fallbacks."""
    category_id = text(raw.get("categoryId"))
    category_name = text(raw.get("category"))
    records = catalog or {}
    record = records.get(category_id) if category_id else None
    translated = text(record.get("descriptionTranslated")) if record else ""
    group = None
    current = record
    visited: set[str] = set()
    while isinstance(current, dict):
        group = GROUP_BY_NAME.get(text(current.get("description")).casefold())
        if group:
            break
        parent_id = text(current.get("parentId"))
        if not parent_id or parent_id in visited:
            # A root without a recognized name remains its own provider category.
            break
        visited.add(parent_id)
        parent = records.get(parent_id)
        if parent is None:
            group = GROUP_BY_NAME.get(text(current.get("parentDescription")).casefold())
            break
        current = parent

    if record is None:
        group = GROUP_BY_NAME.get(category_name.casefold())
    has_category = bool(category_id or category_name)
    needs_review = has_category and not group and not translated
    key = group or (f"pluggy:{category_id}" if translated and category_id else "review" if has_category else "uncategorized")
    display = CATEGORY_NAMES.get(key) or translated
    return {
        "providerCategoryId": category_id or None,
        "providerCategoryName": category_name or (text(record.get("description")) if record else None) or None,
        "providerCategoryLabel": translated or (CATEGORY_NAMES[group] if group else "Categoria do Pluggy para revisar" if has_category else None),
        "category": display,
        "categoryKey": key,
        "categorySource": "pluggy" if has_category else "unclassified",
        "categoryNeedsReview": needs_review,
    }
