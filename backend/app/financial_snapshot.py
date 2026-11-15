import re
import unicodedata
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from app import pluggy

REPORT_TIMEZONE = ZoneInfo("America/Sao_Paulo")
MAX_CENTS = 10**14

CATEGORIES = {
    "accommodation": "Viagem",
    "cinema, theater and concerts": "Lazer",
    "food delivery": "Alimentação",
    "eating out": "Alimentação",
    "gas stations": "Transporte",
    "groceries": "Alimentação",
    "healthcare": "Saúde",
    "housing": "Moradia",
    "pharmacy": "Saúde",
    "rent": "Moradia",
    "shopping": "Compras",
    "taxi and ride-hailing": "Transporte",
    "transportation": "Transporte",
    "travel": "Viagem",
}


def cents(value: object) -> int | None:
    if type(value) not in (int, Decimal):
        return None
    amount = Decimal(value)
    if not amount.is_finite() or abs(amount) > MAX_CENTS // 100:
        return None
    return int((amount * 100).to_integral_value(rounding=ROUND_HALF_UP))


def calendar_date(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    try:
        if len(value) == 10:
            return date.fromisoformat(value).isoformat()
        timestamp = datetime.fromisoformat(value)
        if timestamp.tzinfo is not None:
            return timestamp.astimezone(REPORT_TIMEZONE).date().isoformat()
    except ValueError:
        pass
    return None


def label(value: object) -> str:
    return value.strip()[:200] if isinstance(value, str) else ""


def bank_code(account: dict[str, Any]) -> str | None:
    bank_data = account.get("bankData")
    number = bank_data.get("transferNumber") if isinstance(bank_data, dict) else None
    if not isinstance(number, str):
        return None
    parts = [part.strip() for part in number.split("/")]
    if len(parts) == 3 and re.fullmatch(r"[0-9]{3}", parts[0]) and all(parts[1:]):
        return parts[0]
    return None


def institution_names(api_key: str) -> dict[str, str]:
    names: dict[str, str] = {}
    conflicts: set[str] = set()
    try:
        for institution in pluggy.institutions(api_key):
            code = institution.get("compe")
            name = label(institution.get("tradeName")) or label(institution.get("name"))
            if isinstance(code, str) and re.fullmatch(r"[0-9]{3}", code) and name:
                if code in names and names[code] != name:
                    conflicts.add(code)
                names[code] = name
    except pluggy.PluggyError:
        return {}
    return {code: name for code, name in names.items() if code not in conflicts}


def identifier(value: object) -> str:
    try:
        return str(UUID(str(value)))
    except ValueError:
        raise pluggy.PluggyError("Pluggy returned an invalid record ID.") from None


def transaction_kind(raw: dict[str, Any], name: str, card: bool, direction: str) -> str:
    operation = raw.get("operationType")
    category = label(raw.get("category")).casefold()
    plain_name = "".join(
        char for char in unicodedata.normalize("NFD", name.casefold())
        if not unicodedata.combining(char)
    )
    if (operation in ("PAGAMENTO_FATURA", "TRANSFERENCIA_MESMA_INSTITUICAO")
        or category == "credit card payment" or category.startswith("same person transfer")
        or re.search(r"\bpagamento (?:d[ae] )?fatura\b", plain_name)):
        return "transfer"
    if direction == "DEBIT":
        return "expense"
    return "credit" if card or operation in ("ESTORNO", "CASHBACK") else "income"


def normalize_transaction(raw: dict[str, Any], account_id: str, as_of: str, card: bool) -> dict | None:
    if raw.get("status") != "POSTED":
        return None
    if raw.get("accountId", account_id) != account_id:
        raise pluggy.PluggyError("Pluggy returned a transaction for another account.")
    value = raw.get("amount") if raw.get("currencyCode") == "BRL" else raw.get("amountInAccountCurrency")
    amount = cents(value)
    occurred_on = calendar_date(raw.get("date"))
    direction = raw.get("type")
    if amount is None or not occurred_on or occurred_on > as_of or direction not in ("CREDIT", "DEBIT"):
        return None

    name = label(raw.get("description")) or "Lançamento"
    kind = transaction_kind(raw, name, card, direction)
    entry = {
        "id": f"{account_id}.{identifier(raw.get('id'))}",
        "date": occurred_on,
        "name": name,
        "amountCents": abs(amount),
        "cardId" if card else "accountId": account_id,
        "kind": kind,
    }
    if kind == "transfer":
        entry["direction"] = "in" if direction == "CREDIT" else "out"
    if kind == "expense":
        category = CATEGORIES.get(label(raw.get("category")).casefold())
        if category:
            entry["category"] = category
    return entry


def normalize_card(raw: dict[str, Any], account_id: str, bank: str) -> dict:
    credit = raw.get("creditData")
    if not isinstance(credit, dict):
        credit = {}
    flexible = credit.get("isLimitFlexible") is True
    limit = None if flexible else cents(credit.get("creditLimit"))
    available = None if flexible else cents(credit.get("availableCreditLimit"))
    last_four = re.search(r"[0-9]{4}$", label(raw.get("number")))
    name = label(raw.get("marketingName")) or label(raw.get("name"))
    return {
        "id": account_id,
        "bank": bank,
        "name": name,
        "lastFour": last_four.group() if last_four else "",
        "limitCents": limit,
        "availableCents": available,
        "usedCents": limit - available if limit is not None and available is not None else None,
        "openInvoice": None,
        "installments": [],
    }


def load_item(
    item_id: UUID, api_key: str, as_of: str, fallback_bank: str, bank_names: dict[str, str],
) -> tuple[list[dict], list[dict], list[dict]]:
    pluggy.meu_pluggy_item(item_id, api_key)
    records = pluggy.accounts(item_id, api_key)
    codes = {code for raw in records if raw.get("type") == "BANK" and (code := bank_code(raw))}
    connection_bank = bank_names.get(next(iter(codes)), fallback_bank) if len(codes) == 1 else fallback_bank
    accounts, cards, entries = [], [], []
    for raw in records:
        if raw.get("currencyCode") != "BRL":
            continue
        account_id = identifier(raw.get("id"))
        if raw.get("itemId", str(item_id)) != str(item_id):
            raise pluggy.PluggyError("Pluggy returned an account for another connection.")
        code = bank_code(raw)
        bank = bank_names.get(code, fallback_bank) if code else connection_bank
        card = raw.get("type") == "CREDIT" and raw.get("subtype") == "CREDIT_CARD"
        if card:
            cards.append(normalize_card(raw, account_id, bank))
        elif raw.get("type") == "BANK":
            accounts.append({
                "id": account_id,
                "bank": bank,
                "name": label(raw.get("name")) or "Conta bancária",
                "balanceCents": cents(raw.get("balance")),
            })
        else:
            continue

        for transaction in pluggy.transactions(account_id, api_key):
            entry = normalize_transaction(transaction, account_id, as_of, card)
            if entry is not None:
                entries.append(entry)
    return accounts, cards, entries


def load_snapshot(item_ids: tuple[UUID, ...], api_key: str) -> dict:
    as_of = datetime.now(REPORT_TIMEZONE).date().isoformat()
    bank_names = institution_names(api_key)
    accounts, cards, entries = {}, {}, {}
    failed = 0
    for index, item_id in enumerate(item_ids, start=1):
        bank = f"Meu Pluggy · conexão {index}"
        try:
            item_accounts, item_cards, item_entries = load_item(item_id, api_key, as_of, bank, bank_names)
        except pluggy.PluggyError:
            failed += 1
            continue

        for account in item_accounts:
            accounts.setdefault(account["id"], account)
        for card in item_cards:
            cards.setdefault(card["id"], card)
        for entry in item_entries:
            entries[entry["id"]] = entry

    total_balances = sum(abs(account["balanceCents"] or 0) for account in accounts.values())
    total_entries = sum(entry["amountCents"] for entry in entries.values())
    total_limits = sum(
        abs(card["usedCents"] or 0) + abs(card["limitCents"] or 0) for card in cards.values()
    )
    if max(total_balances, total_entries, total_limits) > MAX_CENTS:
        raise pluggy.PluggyError("The reporting amount exceeds the supported range.")

    return {
        "asOf": as_of,
        "accounts": list(accounts.values()),
        "cards": list(cards.values()),
        "transactions": sorted(entries.values(), key=lambda entry: entry["date"]),
        "balanceSnapshots": [],
        "connectionCount": len(item_ids),
        "failedConnections": failed,
    }
