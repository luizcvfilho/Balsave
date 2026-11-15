from decimal import Decimal
from unittest import TestCase
from unittest.mock import patch
from uuid import UUID

from app import pluggy
from app.financial_snapshot import institution_names, load_item, normalize_card, normalize_transaction


ACCOUNT = "2f5fb14d-49a8-43db-955c-580165f7ea4e"
TRANSACTION = "adc49032-13eb-4b23-82dd-a4963c014956"


class FinancialSnapshotTests(TestCase):
    def setUp(self):
        self.entry = {
            "id": TRANSACTION,
            "accountId": ACCOUNT,
            "date": "2026-11-15T01:00:00Z",
            "description": "Mercado",
            "amount": Decimal("15.47"),
            "currencyCode": "BRL",
            "status": "POSTED",
            "type": "DEBIT",
            "category": "Groceries",
        }

    def test_card_debit_is_a_purchase_in_the_reporting_timezone(self):
        entry = normalize_transaction(self.entry, ACCOUNT, "2026-11-14", card=True)
        self.assertEqual(entry, {
            "id": f"{ACCOUNT}.{TRANSACTION}",
            "date": "2026-11-14",
            "name": "Mercado",
            "amountCents": 1547,
            "cardId": ACCOUNT,
            "kind": "expense",
            "category": "Alimentação",
        })

    def test_bill_payments_are_transfers_on_both_sides(self):
        for card, direction in [(True, "CREDIT"), (False, "DEBIT")]:
            with self.subTest(card=card):
                entry = normalize_transaction(
                    {**self.entry, "type": direction, "description": "Pagamento de fatura"},
                    ACCOUNT, "2026-11-14", card,
                )
                self.assertEqual(entry["kind"], "transfer")
                self.assertEqual(entry["direction"], "in" if card else "out")

    def test_pending_and_unconverted_entries_are_excluded(self):
        self.assertIsNone(normalize_transaction(
            {**self.entry, "status": "PENDING"}, ACCOUNT, "2026-11-14", True,
        ))
        foreign = {**self.entry, "currencyCode": "USD"}
        self.assertIsNone(normalize_transaction(foreign, ACCOUNT, "2026-11-14", True))
        converted = normalize_transaction(
            {**foreign, "amountInAccountCurrency": Decimal("81.51")}, ACCOUNT, "2026-11-14", True,
        )
        self.assertEqual(converted["amountCents"], 8151)

    def test_card_limit_usage_uses_only_the_reported_limits(self):
        card = normalize_card({
            "number": "xxxx1234", "balance": Decimal("160.01"),
            "creditData": {"creditLimit": 1000, "availableCreditLimit": Decimal("849.94")},
        }, ACCOUNT, "Meu Pluggy")
        self.assertEqual(card["usedCents"], 15006)
        self.assertEqual(card["lastFour"], "1234")
        self.assertIsNone(normalize_card({"balance": Decimal("160.01")}, ACCOUNT, "Meu Pluggy")["usedCents"])

    def test_compe_identifies_the_bank_for_the_account_and_its_card(self):
        accounts, cards = self.load_accounts("077 / 0001 / 12345-6")
        self.assertEqual(accounts[0]["bank"], "Banco Inter")
        self.assertEqual(cards[0]["bank"], "Banco Inter")
        self.assertEqual(cards[0]["name"], "Mastercard Black")

    def test_agency_only_or_ambiguous_codes_do_not_assign_the_wrong_bank(self):
        accounts, cards = self.load_accounts("077 / 12345-6")
        self.assertEqual(accounts[0]["bank"], "Connection 1")
        self.assertEqual(cards[0]["bank"], "Connection 1")

        accounts, cards = self.load_accounts("077 / 0001 / 12345-6", "341 / 0002 / 12345-6")
        self.assertEqual([account["bank"] for account in accounts], ["Banco Inter", "Itaú"])
        self.assertEqual(cards[0]["bank"], "Connection 1")

    def test_catalog_prefers_the_trade_name_and_tolerates_a_failed_lookup(self):
        with patch.object(pluggy, "institutions", return_value=iter([
            {"compe": "077", "tradeName": "Banco Inter", "name": "Banco Inter S.A."},
            {"compe": "341", "name": "Itaú Unibanco S.A."},
        ])):
            self.assertEqual(institution_names("test"), {"077": "Banco Inter", "341": "Itaú Unibanco S.A."})
        with patch.object(pluggy, "institutions", side_effect=pluggy.PluggyError):
            self.assertEqual(institution_names("test"), {})

    def load_accounts(self, *transfer_numbers):
        records = [
            {
                "id": "2f5fb14d-49a8-43db-955c-580165f7ea4e",
                "type": "BANK", "currencyCode": "BRL",
                "bankData": {"transferNumber": number},
            }
            for number in transfer_numbers
        ]
        records.append({
            "id": TRANSACTION, "type": "CREDIT", "subtype": "CREDIT_CARD", "currencyCode": "BRL",
            "name": "Cartão de crédito", "marketingName": "Mastercard Black",
        })
        with (
            patch.object(pluggy, "meu_pluggy_item"),
            patch.object(pluggy, "accounts", return_value=records),
            patch.object(pluggy, "transactions", return_value=[]),
        ):
            accounts, cards, _ = load_item(
                UUID(ACCOUNT), "test", "2026-11-14", "Connection 1",
                {"077": "Banco Inter", "341": "Itaú"},
            )
        return accounts, cards
