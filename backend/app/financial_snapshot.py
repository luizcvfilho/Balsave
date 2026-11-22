import re
import unicodedata
from collections.abc import Iterable
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from app import pluggy
from app.categorization import resolve_provider_category
from app.installment_planning import ObservedInstallment, planned_installments
from app.reconciliation import reconcile

REPORT_TIMEZONE = ZoneInfo("America/Sao_Paulo")
MAX_CENTS = 10**14

INVESTMENT_CATEGORIES = {
    "investments", "automatic investment", "fixed income", "mutual funds",
    "variable income", "margin", "pension",
}
FUND_MOVEMENT_TYPES = {"APLICACAO_FINANCEIRA": "BUY", "RESGATE_APLIC_FINANCEIRA": "SELL"}
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


def same_owner_transfer(payment: object, direction: str, owner_document: str | None) -> bool | None:
    if not isinstance(payment, dict):
        return None
    payer = participant_document(payment.get("payer"))
    receiver = participant_document(payment.get("receiver"))
    if direction == "DEBIT":
        payer = payer or owner_document
    else:
        receiver = receiver or owner_document
    return payer == receiver if payer is not None and receiver is not None else None


def own_account_transfer(raw: dict[str, Any], direction: str, owner_document: str | None) -> bool:
    if label(raw.get("operationType")) in FUND_MOVEMENT_TYPES:
        return False
    same_owner = same_owner_transfer(raw.get("paymentData"), direction, owner_document)
    if same_owner is not None:
        return same_owner
    category = label(raw.get("category")).casefold()
    return category == "same person transfer" or category.startswith("same person transfer - ")


def investment_transfer(raw: dict[str, Any]) -> bool:
    return label(raw.get("operationType")) in FUND_MOVEMENT_TYPES or label(raw.get("category")).casefold() in INVESTMENT_CATEGORIES


def transaction_kind(
    raw: dict[str, Any], card: bool, direction: str, own_transfer: bool, fund_transfer: bool,
) -> str:
    operation = label(raw.get("operationType"))
    category = label(raw.get("category")).casefold()
    descriptions = [plain_text(raw.get(field)) for field in ("description", "descriptionRaw")]
    if (
        operation == "PAGAMENTO_FATURA" or category == "credit card payment"
        or own_transfer or (card and (category == "same person transfer" or category.startswith("same person transfer - ")))
        or any(re.search(r"\b(?:pagamento|pagto\.?|pgto\.?) (?:d[ae] )?fatura\b", name) for name in descriptions)
        or (card and direction == "CREDIT" and "pagamento recebido" in descriptions)
    ):
        return "transfer"
    if card:
        return "expense" if direction == "DEBIT" else "credit"
    if direction == "CREDIT" and operation == "RENDIMENTO_APLIC_FINANCEIRA":
        return "income"
    if direction == "DEBIT" and category in ("taxes on investments", "tax on financial operations"):
        return "expense"
    if fund_transfer or category in INVESTMENT_CATEGORIES:
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
    *, catalog: dict[str, dict] | None = None,
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

    own_transfer = not card and own_account_transfer(raw, direction, owner_document)
    fund_transfer = not card and investment_transfer(raw)
    kind = transaction_kind(raw, card, direction, own_transfer, fund_transfer)
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
    classification = resolve_provider_category(raw, catalog)
    entry.update({key: value for key, value in classification.items() if key.startswith("providerCategory")})
    if kind == "transfer":
        entry["direction"] = "in" if direction == "CREDIT" else "out"
        if fund_transfer:
            entry["internalTransfer"] = "investment"
        elif own_transfer:
            entry["internalTransfer"] = "account"
    if kind == "expense":
        entry.update(classification)
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


def estimate_month_end_balances(balance: int, as_of: str, entries: Iterable[tuple[str, int]]) -> dict[str, int]:
    movements: dict[str, int] = {}
    for posted_on, signed_amount in entries:
        month = posted_on[:7]
        movements[month] = movements.get(month, 0) + signed_amount
    if not movements:
        return {}

    estimates: dict[str, int] = {}
    first_month = min(movements)
    month_start = date.fromisoformat(as_of).replace(day=1)
    while (month := month_start.isoformat()[:7]) > first_month:
        balance -= movements.get(month, 0)
        month_start = (month_start - timedelta(days=1)).replace(day=1)
        estimates[month_start.isoformat()[:7]] = balance
    return estimates


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
    *, catalog: dict[str, dict] | None = None,
) -> tuple[list[dict], list[dict], list[dict], dict[str, dict[str, int]], dict[str, str]]:
    item = pluggy.meu_pluggy_item(item_id, api_key)
    synced_through = card_sync_date(item, as_of)
    records = pluggy.accounts(item_id, api_key)
    codes = {code for raw in records if raw.get("type") == "BANK" and (code := bank_code(raw))}
    connection_bank = bank_names.get(next(iter(codes)), fallback_bank) if len(codes) == 1 else fallback_bank
    accounts, cards, entries = [], [], []
    estimates: dict[str, dict[str, int]] = {}
    owners: dict[str, str] = {}
    for raw in records:
        if raw.get("currencyCode") != "BRL":
            continue
        account_id = identifier(raw.get("id"))
        if raw.get("itemId", str(item_id)) != str(item_id):
            raise pluggy.PluggyError("Pluggy returned an account for another connection.")
        code = bank_code(raw)
        bank = bank_names.get(code, fallback_bank) if code else connection_bank
        card = raw.get("type") == "CREDIT" and raw.get("subtype") == "CREDIT_CARD"
        balance = None
        if not card and raw.get("type") == "BANK":
            balance = cents(raw.get("balance"))
            bank_data = raw.get("bankData")
            bank_data = bank_data if isinstance(bank_data, dict) else {}
            accounts.append({
                "id": account_id,
                "bank": bank,
                "name": label(raw.get("name")) or "Conta bancária",
                "balanceCents": balance,
                "asOf": calendar_date(raw.get("updatedAt")) or as_of,
                "automaticBalanceCents": cents(bank_data.get("automaticallyInvestedBalance")),
                "_owner": tax_document(raw.get("taxNumber")),
                "_itemId": str(item_id),
            })
        elif not card:
            continue

        owner_document = tax_document(raw.get("taxNumber")) if not card else None
        if owner_document:
            owners[account_id] = owner_document
        account_entries = {}
        installments: dict[str, ObservedInstallment] = {}
        usable_statement = True
        for transaction in pluggy.transactions(account_id, api_key):
            entry = normalize_transaction(transaction, account_id, as_of, card, owner_document, catalog=catalog)
            if entry is not None:
                account_entries[entry["id"]] = entry
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
                if not card:
                    movement = entry["amountCents"] if transaction["type"] == "CREDIT" else -entry["amountCents"]
                    entry["balanceImpactCents"] = movement
                    if entry["date"] > accounts[-1]["asOf"]:
                        usable_statement = False
                    payment = transaction.get("paymentData")
                    payment = payment if isinstance(payment, dict) else {}
                    participant = payment.get("payer" if movement > 0 else "receiver")
                    entry["_evidence"] = {
                        "cash": movement, "dates": [entry["date"]], "owner": owner_document,
                        "counterparty": participant_document(participant),
                        "reference": label(payment.get("referenceNumber")),
                        "operation": label(transaction.get("operationType")),
                        "selfTransfer": entry.get("internalTransfer") == "account",
                        "fundOperation": entry.get("internalTransfer") == "investment",
                        "eligible": label(transaction.get("operationType")) not in ("RENDIMENTO_APLIC_FINANCEIRA", "PAGAMENTO_FATURA")
                            and label(transaction.get("category")).casefold() not in ("taxes on investments", "tax on financial operations", "credit card payment"),
                        "itemId": str(item_id),
                    }
            elif not card and transaction.get("status") == "POSTED":
                posted_on = calendar_date(transaction.get("date"))
                if not posted_on or posted_on <= as_of:
                    usable_statement = False
        entries.extend(account_entries.values())
        if card:
            card_data = normalize_card(raw, account_id, bank)
            card_data["installments"] = planned_installments(installments.values(), synced_through)
            cards.append(card_data)
        if not card:
            accounts[-1]["_usableStatement"] = usable_statement
        if balance is not None and usable_statement:
            estimates[account_id] = estimate_month_end_balances(
                balance, as_of, ((entry["date"], entry["balanceImpactCents"]) for entry in account_entries.values()),
            )
    return accounts, cards, entries, estimates, owners


def load_investments(item_id: UUID, api_key: str, as_of: str, bank_accounts: list[dict], fallback_bank: str) -> tuple[list[dict], list[dict]]:
    positions, entries = {}, {}
    bank_names = {account["bank"] for account in bank_accounts}
    bank = next(iter(bank_names)) if len(bank_names) == 1 else fallback_bank
    documents = {account["_owner"] for account in bank_accounts if account.get("_owner")}
    owner = next(iter(documents)) if len(documents) == 1 else None
    for raw in pluggy.investments(item_id, api_key):
        if raw.get("itemId") != str(item_id):
            raise pluggy.PluggyError("Pluggy returned an investment for another connection.")
        if raw.get("currencyCode") != "BRL":
            continue
        investment_id = identifier(raw.get("id"))
        reference_date = calendar_date(raw.get("date"))
        balance = cents(raw.get("balance"))
        if not reference_date or reference_date > as_of:
            balance = None
        position = {
            "id": investment_id, "name": label(raw.get("name")) or "Investimento", "bank": bank,
            "balanceCents": balance, "asOf": reference_date or as_of,
            "_code": tax_document(raw.get("code")), "_itemId": str(item_id), "_usableStatement": True,
        }
        position_entries = {}
        try:
            for movement in pluggy.investment_transactions(investment_id, api_key):
                posted_on = calendar_date(movement.get("tradeDate")) or calendar_date(movement.get("date"))
                if posted_on and posted_on > position["asOf"]:
                    continue
                kind = label(movement.get("type"))
                gross = cents(movement.get("amount"))
                if not posted_on or gross is None or kind not in ("BUY", "SELL", "TRANSFER", "TAX", "INTEREST", "AMORTIZATION"):
                    position["_usableStatement"] = False
                    continue
                direction = movement.get("movementType") or ("CREDIT" if kind == "BUY" else "DEBIT")
                if direction not in ("CREDIT", "DEBIT"):
                    position["_usableStatement"] = False
                    continue
                amount = abs(gross)
                impact = amount if direction == "CREDIT" else -amount
                net = cents(movement.get("netAmount"))
                entry = {
                    "id": f"{investment_id}.{identifier(movement.get('id'))}", "investmentId": investment_id,
                    "date": posted_on, "name": label(movement.get("description")) or {
                        "BUY": "Aplicação", "SELL": "Resgate", "TRANSFER": "Transferência entre investimentos",
                        "TAX": "Imposto sobre investimento", "INTEREST": "Rendimento distribuído", "AMORTIZATION": "Amortização",
                    }[kind],
                    "amountCents": amount, "balanceImpactCents": impact,
                    "kind": "expense" if kind == "TAX" else "transfer", "direction": "in" if impact > 0 else "out",
                    "_evidence": {
                        "cash": (abs(net) if net is not None else amount) * (1 if impact > 0 else -1),
                        "dates": sorted({posted_on, calendar_date(movement.get("date")) or posted_on}),
                        "owner": owner, "counterparty": None, "fundCode": position["_code"], "reference": "",
                        "operation": kind, "eligible": kind in ("BUY", "SELL", "TRANSFER"),
                        "selfTransfer": False, "fundOperation": True, "itemId": str(item_id),
                        "singleAccount": len(bank_accounts) == 1,
                    },
                }
                if kind in ("BUY", "SELL", "TRANSFER"):
                    entry["internalTransfer"] = "investment"
                position_entries[entry["id"]] = entry
        except pluggy.PluggyError:
            position["_usableStatement"] = False
        positions[investment_id] = position
        entries.update(position_entries)
    return list(positions.values()), list(entries.values())


def portfolio_snapshots(positions: list[dict], entries: list[dict], as_of: str) -> list[dict]:
    snapshots: dict[str, list[dict]] = {}
    for position in positions:
        if position["balanceCents"] is None or not position.get("_usableStatement") or position.get("includedInAccountId"):
            continue
        movements = [entry for entry in entries if (entry.get("accountId") or entry.get("investmentId")) == position["id"]]
        # Investment valuations before their reference date require historical quotes. Reverse reported cash movements as an estimate.
        balances = estimate_month_end_balances(
            position["balanceCents"], min(as_of, position["asOf"]),
            ((entry["date"], entry["balanceImpactCents"]) for entry in movements),
        )
        for month, balance in balances.items():
            snapshots.setdefault(month, []).append({"id": position["id"], "bank": position["bank"], "balanceCents": balance})
    return [{"month": month, "accounts": snapshots[month]} for month in sorted(snapshots)]


def load_snapshot(
    item_ids: tuple[UUID, ...], api_key: str,
    *, decisions: dict[str, dict] | None = None, position_links: dict[str, str | None] | None = None,
    include_evidence: bool = False,
    catalog: dict[str, dict] | None = None,
) -> dict:
    as_of = datetime.now(REPORT_TIMEZONE).date().isoformat()
    bank_names = institution_names(api_key)
    accounts, cards, entries, investments = {}, {}, {}, {}
    failed = 0
    failed_investments = 0
    for index, item_id in enumerate(item_ids, start=1):
        bank = f"Meu Pluggy · conexão {index}"
        try:
            item_accounts, item_cards, item_entries, _, _ = load_item(
                item_id, api_key, as_of, bank, bank_names, catalog=catalog,
            )
        except pluggy.PluggyError:
            failed += 1
            continue

        try:
            item_investments, investment_entries = load_investments(item_id, api_key, as_of, item_accounts, bank)
            for position in item_investments:
                investments.setdefault(position["id"], position)
                if not position["_usableStatement"]:
                    failed_investments += 1
            for entry in investment_entries:
                entries[entry["id"]] = entry
        except pluggy.PluggyError:
            failed_investments += 1
        for account in item_accounts:
            account_id = account["id"]
            if account_id in accounts:
                continue
            accounts[account_id] = account
        for card in item_cards:
            cards.setdefault(card["id"], card)
        for entry in item_entries:
            entries[entry["id"]] = entry

    total_balances = sum(abs(account["balanceCents"] or 0) for account in accounts.values())
    total_entries = sum(entry["amountCents"] for entry in entries.values())
    total_investments = sum(abs(position["balanceCents"] or 0) for position in investments.values())
    total_limits = sum(
        abs(card["usedCents"] or 0) + abs(card["limitCents"] or 0) for card in cards.values()
    )
    total_planned = sum(plan["amountCents"] for card in cards.values() for plan in card["installments"])
    if max(total_balances, total_entries, total_limits, total_planned, total_investments) > MAX_CENTS:
        raise pluggy.PluggyError("The reporting amount exceeds the supported range.")

    for position in investments.values():
        if position["id"] in (position_links or {}):
            account_id = position_links[position["id"]]
            if account_id in accounts:
                position["includedInAccountId"] = account_id
    all_positions = [*accounts.values(), *investments.values()]
    all_entries = list(entries.values())
    candidates = reconcile(all_entries, all_positions, decisions or {})
    data = {
        "asOf": as_of,
        "accounts": list(accounts.values()),
        "investments": list(investments.values()),
        "cards": list(cards.values()),
        "transactions": sorted(all_entries, key=lambda entry: entry["date"]),
        "balanceSnapshots": portfolio_snapshots(all_positions, all_entries, as_of),
        "reconciliationCandidates": candidates,
        "connectionCount": len(item_ids),
        "failedConnections": failed,
        "failedInvestments": failed_investments,
    }
    if not include_evidence:
        for record in [*all_positions, *all_entries]:
            for key in [key for key in record if key.startswith("_")]:
                del record[key]
    return data
