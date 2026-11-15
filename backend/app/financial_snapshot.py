import re
import unicodedata
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from app import pluggy
from app.installment_planning import ObservedInstallment, planned_installments

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

INVESTMENT_CATEGORIES = {
    "investments", "automatic investment", "fixed income", "mutual funds",
    "variable income", "margin", "pension",
}
INVESTMENT_MOVEMENT = re.compile(
    r"^(?:(?:aplic(?:acao)?|resg(?:ate)?|cdb)[.\s-]+)*(?:bb[.\s-]+)?rende?[.\s-]+facil\b"
    r"|^(?:aplic(?:acao)?|aporte|resg(?:ate)?)[.\s-]+(?:(?:em|d[aeo])[.\s-]+)?"
    r"(?:automatic[ao]|financeir[ao]|investimentos?|fundos?|cdb|rdb|lci|lca|tesouro direto)\b"
)
PAYMENT_METHOD_CODES = {
    "PIX": "pix",
    "BOLETO": "boleto",
    "TED": "ted",
    "DOC": "doc",
    "TEF": "bank_transfer",
    "TRANSFERENCIA_MESMA_INSTITUICAO": "bank_transfer",
}
PAYMENT_METHOD_CATEGORIES = {
    "pix": "pix",
    "transfer - pix": "pix",
    "bank slip": "boleto",
    "transfer - bank slip (boleto)": "boleto",
    "ted": "ted",
    "transfer - ted": "ted",
    "doc": "doc",
    "transfer - doc": "doc",
    "transfer - internal": "bank_transfer",
    "debt card": "debit_card",
    "transfer - check": "check",
}
PAYMENT_METHOD_DESCRIPTIONS = {
    "pix": re.compile(r"^(?:(?:pagamento|transferencia)(?: via| por)?\s+)?pix\b"),
    "boleto": re.compile(r"^(?:(?:pagamento|pgto\.?)(?: de)?\s+)?boleto\b"),
    "ted": re.compile(r"^(?:ted(?:$|\s*[-:]|\s+enviad[ao]\b)|transferencia via ted\b)"),
    "doc": re.compile(r"^(?:doc(?:$|\s*[-:]|\s+enviad[ao]\b)|transferencia via doc\b)"),
    "debit_card": re.compile(r"^(?:cartao de debito|compra (?:no|com) (?:cartao de )?debito)\b"),
    "automatic_debit": re.compile(r"^debito automatico\b"),
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


def plain_text(value: object) -> str:
    return "".join(
        char for char in unicodedata.normalize("NFD", label(value).casefold())
        if not unicodedata.combining(char)
    )


def tax_document(value: object) -> str | None:
    if not isinstance(value, str) or not re.fullmatch(r"[0-9./-]+", value.strip()):
        return None
    digits = re.sub(r"[^0-9]", "", value)
    return digits if len(digits) in (11, 14) and len(set(digits)) > 1 else None


def participant_document(participant: object) -> str | None:
    document = participant.get("documentNumber") if isinstance(participant, dict) else None
    return tax_document(document.get("value")) if isinstance(document, dict) else None


def same_owner_transfer(payment: object, direction: str, owner_document: str | None) -> bool:
    if not isinstance(payment, dict):
        return False
    payer = participant_document(payment.get("payer"))
    receiver = participant_document(payment.get("receiver"))
    if direction == "DEBIT":
        payer = payer or owner_document
    else:
        receiver = receiver or owner_document
    return payer is not None and payer == receiver


def transaction_kind(
    raw: dict[str, Any], card: bool, direction: str, owner_document: str | None,
) -> str:
    operation = raw.get("operationType")
    category = label(raw.get("category")).casefold()
    descriptions = [plain_text(raw.get(field)) for field in ("description", "descriptionRaw")]
    if (
        operation == "PAGAMENTO_FATURA" or category == "credit card payment"
        or category == "same person transfer" or category.startswith("same person transfer - ")
        or any(re.search(r"\b(?:pagamento|pagto\.?|pgto\.?) (?:d[ae] )?fatura\b", name) for name in descriptions)
        or (card and direction == "CREDIT" and "pagamento recebido" in descriptions)
    ):
        return "transfer"
    if card:
        return "expense" if direction == "DEBIT" else "credit"
    if (
        same_owner_transfer(raw.get("paymentData"), direction, owner_document)
        or any(re.search(
            r"^(?:transferencia|pix|ted|doc)\b.*\b(?:contas proprias|mesma titularidade)\b", name,
        ) for name in descriptions)
    ):
        return "transfer"
    if direction == "CREDIT" and operation == "RENDIMENTO_APLIC_FINANCEIRA":
        return "income"
    if direction == "DEBIT" and category in ("taxes on investments", "tax on financial operations"):
        return "expense"
    investment_descriptions = [*descriptions, plain_text(raw.get("operationTypeAdditionalInfo"))]
    if (
        operation == "RESGATE_APLIC_FINANCEIRA"
        or category in INVESTMENT_CATEGORIES
        or any(INVESTMENT_MOVEMENT.search(name) for name in investment_descriptions)
    ):
        return "transfer"
    if direction == "DEBIT":
        return "expense"
    return "credit" if operation in ("ESTORNO", "CASHBACK") else "income"


def expense_payment_method(raw: dict[str, Any], card: bool) -> str | None:
    if card:
        return "credit_card"

    payment = raw.get("paymentData")
    payment_code = label(payment.get("paymentMethod")).upper() if isinstance(payment, dict) else ""
    operation = label(raw.get("operationType")).upper()
    method = PAYMENT_METHOD_CODES.get(payment_code) or PAYMENT_METHOD_CODES.get(operation)
    if method:
        return method

    category_method = PAYMENT_METHOD_CATEGORIES.get(label(raw.get("category")).casefold())
    descriptions = [plain_text(raw.get(field)) for field in (
        "operationTypeAdditionalInfo", "descriptionRaw", "description",
    )]
    if operation == "CARTAO":
        debit = PAYMENT_METHOD_DESCRIPTIONS["debit_card"]
        if category_method == "debit_card" or any(debit.match(description) for description in descriptions):
            return "debit_card"
        return "card"

    for description in descriptions:
        for method, pattern in PAYMENT_METHOD_DESCRIPTIONS.items():
            if pattern.match(description):
                return method
    return category_method


def card_installment(metadata: dict[str, Any]) -> dict[str, int] | None:
    count = metadata.get("totalInstallments")
    number = metadata.get("installmentNumber")
    installment = {}
    if type(count) is int and 1 < count < 2**53:
        installment["count"] = count
    if type(number) is int and 1 <= number <= installment.get("count", 2**53 - 1):
        installment["number"] = number
    if "count" in installment or installment.get("number", 0) > 1 or metadata.get("paymentType") == "INSTALLMENT":
        return installment
    return None


def normalize_transaction(
    raw: dict[str, Any], account_id: str, as_of: str, card: bool, owner_document: str | None = None,
) -> dict | None:
    status = raw.get("status")
    if status != "POSTED" and not (card and status == "PENDING"):
        return None
    if raw.get("accountId", account_id) != account_id:
        raise pluggy.PluggyError("Pluggy returned a transaction for another account.")
    value = raw.get("amount") if raw.get("currencyCode") == "BRL" else raw.get("amountInAccountCurrency")
    amount = cents(value)
    occurred_on = calendar_date(raw.get("date"))
    direction = raw.get("type")
    if card and direction is None and amount:
        # Some connectors omit the direction. Card debits increase the balance.
        direction = "DEBIT" if amount > 0 else "CREDIT"
    if amount is None or direction not in ("CREDIT", "DEBIT"):
        return None

    kind = transaction_kind(raw, card, direction, owner_document)
    if status == "PENDING" and kind != "expense":
        return None

    installment = None
    metadata = raw.get("creditCardMetadata")
    if card and kind == "expense" and isinstance(metadata, dict):
        installment = card_installment(metadata)
        if installment is not None:
            bill_post_date = calendar_date(metadata.get("billPostDate"))
            forecast = metadata.get("billForecastDate")
            number = installment.get("number", 0)
            if (
                status == "PENDING" and number > 1 and not bill_post_date and isinstance(forecast, str)
                and re.fullmatch(r"(?!0000)[0-9]{4}-(?:0[1-9]|1[0-2])", forecast) and forecast > as_of[:7]
            ):
                return None
            if number == 1:
                occurred_on = calendar_date(metadata.get("purchaseDate")) or occurred_on or bill_post_date
            else:
                occurred_on = bill_post_date or occurred_on

    if not occurred_on or occurred_on > as_of:
        return None
    entry = {
        "id": f"{account_id}.{identifier(raw.get('id'))}",
        "date": occurred_on,
        "name": label(raw.get("description")) or "Lançamento",
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
        method = expense_payment_method(raw, card)
        if method:
            entry["paymentMethod"] = method
        if installment is not None:
            entry["installment"] = installment
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


def card_sync_date(item: dict, as_of: str) -> date | None:
    details = item.get("statusDetail")
    products = [details.get(key) for key in ("creditCards", "transactions")] if isinstance(details, dict) else []
    if any(isinstance(product, dict) and (product.get("warnings") or product.get("isUpdated") is False) for product in products):
        return None
    if item.get("executionStatus") == "SUCCESS":
        synced = calendar_date(item.get("lastUpdatedAt"))
        return date.fromisoformat(min(synced, as_of)) if synced else None
    if item.get("executionStatus") == "PARTIAL_SUCCESS" and products and all(
        isinstance(product, dict) and product.get("isUpdated") is True for product in products
    ):
        dates = [calendar_date(product.get("lastUpdatedAt")) for product in products]
        if all(dates):
            return date.fromisoformat(min(as_of, *(value for value in dates if value)))
    return None


def load_item(
    item_id: UUID, api_key: str, as_of: str, fallback_bank: str, bank_names: dict[str, str],
) -> tuple[list[dict], list[dict], list[dict]]:
    item = pluggy.meu_pluggy_item(item_id, api_key)
    synced_through = card_sync_date(item, as_of)
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
        if not card and raw.get("type") == "BANK":
            accounts.append({
                "id": account_id,
                "bank": bank,
                "name": label(raw.get("name")) or "Conta bancária",
                "balanceCents": cents(raw.get("balance")),
            })
        elif not card:
            continue

        owner_document = tax_document(raw.get("taxNumber")) if not card else None
        installments: dict[str, ObservedInstallment] = {}
        for transaction in pluggy.transactions(account_id, api_key):
            entry = normalize_transaction(transaction, account_id, as_of, card, owner_document)
            if entry is not None:
                entries.append(entry)
                if installment := entry.get("installment"):
                    number, count = installment.get("number"), installment.get("count")
                    name = label(transaction.get("description")) or label(transaction.get("descriptionRaw"))
                    if name and number and count:
                        purchase = calendar_date(transaction["creditCardMetadata"].get("purchaseDate"))
                        installments[entry["id"]] = ObservedInstallment(
                            entry["id"], name, entry.get("category", "Sem categoria"),
                            date.fromisoformat(purchase) if purchase else None, date.fromisoformat(entry["date"]),
                            number, count, entry["amountCents"],
                        )
        if card:
            card_data = normalize_card(raw, account_id, bank)
            card_data["installments"] = planned_installments(installments.values(), synced_through)
            cards.append(card_data)
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
    total_planned = sum(plan["amountCents"] for card in cards.values() for plan in card["installments"])
    if max(total_balances, total_entries, total_limits, total_planned) > MAX_CENTS:
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
