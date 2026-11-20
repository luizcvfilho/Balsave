from datetime import datetime
from decimal import Decimal
from unittest import TestCase
from unittest.mock import patch
from uuid import UUID

from app import pluggy
from app.financial_snapshot import institution_names, load_item, load_snapshot, normalize_card, normalize_transaction


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
            "paymentMethod": "credit_card",
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
                self.assertNotIn("paymentMethod", entry)

    def test_bank_expense_payment_methods_use_reported_fields_and_explicit_descriptions(self):
        for fields, expected in (
            ({"operationType": "OUTROS", "paymentData": {"paymentMethod": "PIX"}}, "pix"),
            ({"operationType": "BOLETO", "description": "Pix enviado"}, "boleto"),
            ({"operationType": "TED"}, "ted"),
            ({"operationType": "DOC"}, "doc"),
            ({"operationType": "TRANSFERENCIA_MESMA_INSTITUICAO"}, "bank_transfer"),
            ({"operationType": "CARTAO"}, "card"),
            ({"operationType": "CARTAO", "operationTypeAdditionalInfo": "Cartão de débito"}, "debit_card"),
            ({"operationType": "CARTAO", "category": "Debt card"}, "debit_card"),
            ({"descriptionRaw": "Pix - Enviado"}, "pix"),
            ({"description": "Débito automático"}, "automatic_debit"),
            ({"category": "Transfer - Check"}, "check"),
            ({"paymentData": [], "operationType": "OUTROS", "description": "Cobrança de serviço"}, None),
        ):
            with self.subTest(expected=expected, fields=fields):
                entry = normalize_transaction({**self.entry, **fields}, ACCOUNT, "2026-11-14", card=False)
                self.assertEqual(entry["kind"], "expense")
                self.assertEqual(entry.get("paymentMethod"), expected)

    def test_pending_card_purchases_count_through_the_reporting_date(self):
        pending = {**self.entry, "status": "PENDING"}
        entry = normalize_transaction(pending, ACCOUNT, "2026-11-14", card=True)
        self.assertEqual((entry["kind"], entry["category"], entry["amountCents"]), ("expense", "Alimentação", 1547))
        self.assertIsNone(normalize_transaction(pending, ACCOUNT, "2026-11-14", card=False))
        self.assertIsNone(normalize_transaction(
            {**pending, "date": "2026-11-15T03:00:00Z"}, ACCOUNT, "2026-11-14", card=True,
        ))
        self.assertIsNone(normalize_transaction(
            {**pending, "type": "CREDIT"}, ACCOUNT, "2026-11-14", card=True,
        ))

    def test_installments_use_calendar_dates_even_when_the_bill_is_due_another_month(self):
        for number, purchase, posting, forecast, expected in (
            (1, "2026-10-31", "2026-11-01", "2026-11", "2026-10-31"),
            (6, "2026-05-01", "2026-10-05", "2026-11", "2026-10-05"),
            (2, "2026-10-31", "2026-11-10", "2026-12", "2026-11-10"),
        ):
            with self.subTest(number=number):
                entry = normalize_transaction({
                    **self.entry,
                    "creditCardMetadata": {
                        "installmentNumber": number, "totalInstallments": 6, "totalAmount": Decimal("92.82"),
                        "purchaseDate": purchase, "billPostDate": posting, "billForecastDate": forecast,
                    },
                }, ACCOUNT, "2026-11-14", card=True)
                self.assertEqual(entry["date"], expected)
                self.assertEqual(entry["amountCents"], 1547)
                self.assertEqual(entry["category"], "Alimentação")
                self.assertEqual(entry["installment"], {"number": number, "count": 6})

    def test_pending_installments_with_an_explicit_future_period_are_excluded(self):
        pending = {**self.entry, "status": "PENDING"}
        metadata = {"installmentNumber": 2, "totalInstallments": 3, "billForecastDate": "2026-12"}
        self.assertIsNone(normalize_transaction(
            {**pending, "creditCardMetadata": metadata}, ACCOUNT, "2026-11-14", card=True,
        ))
        entry = normalize_transaction(
            {**pending, "creditCardMetadata": {**metadata, "billForecastDate": "2026-11"}},
            ACCOUNT, "2026-11-14", card=True,
        )
        self.assertEqual(entry["date"], "2026-11-14")
        self.assertEqual(entry["installment"], {"number": 2, "count": 3})
        first = normalize_transaction(
            {**pending, "creditCardMetadata": {**metadata, "installmentNumber": 1}},
            ACCOUNT, "2026-11-14", card=True,
        )
        self.assertEqual(first["date"], "2026-11-14")

    def test_installment_classification_uses_only_reported_card_purchase_metadata(self):
        for metadata, expected in (
            ({"paymentType": "SINGLE", "totalInstallments": 1, "installmentNumber": 1}, None),
            ({"paymentType": "INSTALLMENT"}, {}),
            ({"installmentNumber": 2}, {"number": 2}),
            ({"installmentNumber": 2, "billForecastDate": "2026-13"}, {"number": 2}),
            ({"installmentNumber": True, "totalInstallments": "6"}, None),
        ):
            with self.subTest(metadata=metadata):
                raw = {**self.entry, "creditCardMetadata": metadata}
                entry = normalize_transaction(raw, ACCOUNT, "2026-11-14", card=True)
                self.assertEqual(entry.get("installment"), expected)
                bank_entry = normalize_transaction(raw, ACCOUNT, "2026-11-14", card=False)
                self.assertNotIn("installment", bank_entry)
        transfer = {
            **self.entry, "description": "Pagamento de fatura",
            "creditCardMetadata": {"installmentNumber": 1, "totalInstallments": 3},
        }
        self.assertNotIn("installment", normalize_transaction(transfer, ACCOUNT, "2026-11-14", card=True))

    def test_card_snapshot_keeps_projections_out_of_transactions_and_expires_them_after_sync(self):
        card = {"id": ACCOUNT, "type": "CREDIT", "subtype": "CREDIT_CARD", "currencyCode": "BRL"}
        first = {
            **self.entry, "date": "2026-10-16", "description": "Store PARC 01/03 City",
            "creditCardMetadata": {"installmentNumber": 1, "totalInstallments": 3, "purchaseDate": "2026-10-16"},
        }
        for item, expected in (
            ({"executionStatus": "SUCCESS", "lastUpdatedAt": "2026-12-15"}, [2, 3]),
            ({"executionStatus": "SUCCESS", "lastUpdatedAt": "2026-12-16"}, []),
            ({
                "executionStatus": "PARTIAL_SUCCESS", "lastUpdatedAt": "2026-12-17",
                "statusDetail": {"transactions": {"isUpdated": False}},
            }, [2, 3]),
        ):
            with (
                self.subTest(item=item),
                patch.object(pluggy, "meu_pluggy_item", return_value=item),
                patch.object(pluggy, "accounts", return_value=[card]),
                patch.object(pluggy, "transactions", return_value=[first]),
            ):
                _, cards, entries, _, _ = load_item(UUID(ACCOUNT), "test", "2026-12-17", "Mock Bank", {})
                self.assertEqual([row["installment"]["number"] for row in entries], [1])
                self.assertEqual([row["number"] for row in cards[0]["installments"]], expected)

    def test_card_direction_falls_back_to_the_signed_amount_if_absent(self):
        purchase = {**self.entry, "type": None}
        entry = normalize_transaction(purchase, ACCOUNT, "2026-11-14", card=True)
        self.assertEqual(entry["kind"], "expense")
        entry = normalize_transaction(
            {**purchase, "amount": Decimal("-15.47"), "description": "Pagamento recebido"},
            ACCOUNT, "2026-11-14", card=True,
        )
        self.assertEqual((entry["kind"], entry["direction"]), ("transfer", "in"))

    def test_transfers_compare_full_documents_and_keep_third_party_debits(self):
        payer = {"documentNumber": {"type": "CPF", "value": "123.450.789-00"}}
        receiver = {"documentNumber": {"type": "CPF", "value": "12345078900"}}
        for operation in ("PIX", "TED", "TRANSFERENCIA_MESMA_INSTITUICAO"):
            with self.subTest(operation=operation):
                transfer = {**self.entry, "operationType": operation, "category": None}
                entry = normalize_transaction(
                    {**transfer, "paymentData": {"payer": payer, "receiver": receiver}},
                    ACCOUNT, "2026-11-14", card=False,
                )
                self.assertEqual((entry["kind"], entry["direction"]), ("transfer", "out"))
                for document in ("980.450.789-00", "***.450.789-**"):
                    entry = normalize_transaction(
                        {**transfer, "paymentData": {
                            "payer": payer, "receiver": {"documentNumber": {"type": "CPF", "value": document}},
                        }},
                        ACCOUNT, "2026-11-14", card=False,
                    )
                    self.assertEqual(entry["kind"], "expense")

    def test_load_item_uses_the_account_owner_when_a_transfer_omits_its_local_participant(self):
        record = {"id": ACCOUNT, "type": "BANK", "currencyCode": "BRL", "taxNumber": "123.450.789-00"}
        receiver = {"documentNumber": {"type": "CPF", "value": "12345078900"}}
        transaction = {**self.entry, "operationType": "PIX", "paymentData": {"receiver": receiver}}
        with (
            patch.object(pluggy, "meu_pluggy_item"),
            patch.object(pluggy, "accounts", return_value=[record]),
            patch.object(pluggy, "transactions", return_value=[transaction]),
        ):
            accounts, _, entries, _, _ = load_item(UUID(ACCOUNT), "test", "2026-11-14", "Connection 1", {})
        self.assertEqual((entries[0]["kind"], entries[0]["direction"]), ("transfer", "out"))
        self.assertNotIn("taxNumber", accounts[0])
        self.assertNotIn("paymentData", entries[0])

    def test_investments_and_explicit_same_owner_movements_are_transfers(self):
        for fields in (
            {"category": "Same person transfer - PIX"},
            {"category": "Same person transfer - TED"},
            {"category": "Mutual funds"},
            {"operationType": "APLICACAO_FINANCEIRA"},
            {"category": "Automatic investment"},
            {"type": "CREDIT", "operationType": "RESGATE_APLIC_FINANCEIRA"},
            {"type": "CREDIT", "operationType": "RESGATE_APLIC_FINANCEIRA"},
        ):
            with self.subTest(fields=fields):
                entry = normalize_transaction(
                    {**self.entry, "category": None, **fields}, ACCOUNT, "2026-11-14", card=False,
                )
                self.assertEqual(entry["kind"], "transfer")
                self.assertEqual(entry["direction"], "in" if fields.get("type") == "CREDIT" else "out")
                self.assertNotIn("category", entry)

    def test_investment_taxes_are_expenses_and_booked_yield_is_income(self):
        tax = {**self.entry, "description": "BB Rende Fácil - IOF", "category": "Taxes on investments"}
        yield_credit = {
            **self.entry, "description": "BB Rende Fácil", "type": "CREDIT",
            "operationType": "RENDIMENTO_APLIC_FINANCEIRA",
        }
        self.assertEqual(normalize_transaction(tax, ACCOUNT, "2026-11-14", False)["kind"], "expense")
        self.assertEqual(normalize_transaction(yield_credit, ACCOUNT, "2026-11-14", False)["kind"], "income")

    def test_card_purchases_require_a_brl_amount(self):
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

    def test_monthly_balances_reverse_booked_bank_movements_within_statement_coverage(self):
        second_account = "21b60fa8-4738-4882-b341-edb1d7989529"
        card = "3de43b4b-74cb-4a79-a978-dd6555b77328"
        records = [
            {"id": ACCOUNT, "type": "BANK", "currencyCode": "BRL", "balance": Decimal("100.23")},
            {"id": second_account, "type": "BANK", "currencyCode": "BRL", "balance": 0},
            {"id": card, "type": "CREDIT", "subtype": "CREDIT_CARD", "currencyCode": "BRL", "balance": 90},
        ]
        transfer = {
            **self.entry, "date": "2026-11-12", "amount": Decimal("-25.25"), "category": "Same person transfer",
        }
        inflow = {
            **self.entry, "id": "cbea60b5-7d9f-4da3-986b-9c92e2b174f4",
            "date": "2026-11-01T03:00:00Z", "amount": Decimal("10.12"), "type": "CREDIT",
        }
        before_midnight = {
            **transfer, "id": "8564aec7-cf8b-454c-b26f-3d0c4c95a16a",
            "date": "2026-11-01T02:59:59Z", "amount": Decimal("-11.11"),
        }
        oldest = {**inflow, "id": "07e5c706-6f58-4edd-bca0-181a6fd48f92", "date": "2026-08-09"}
        transactions = {
            ACCOUNT: [transfer, {**transfer, "status": "PENDING"}, inflow, before_midnight, transfer, oldest],
            second_account: [
                {**oldest, "accountId": second_account},
                {**inflow, "accountId": second_account, "amount": None},
            ],
            card: [{**inflow, "accountId": card, "type": "DEBIT", "amount": 90}],
        }
        with (
            patch("app.financial_snapshot.datetime", wraps=datetime) as clock,
            patch.object(pluggy, "meu_pluggy_item"),
            patch.object(pluggy, "institutions", return_value=[]),
            patch.object(pluggy, "investments", return_value=[]),
            patch.object(pluggy, "accounts", return_value=records),
            patch.object(pluggy, "transactions", side_effect=lambda account_id, _: transactions[account_id]),
        ):
            clock.now.return_value = datetime(2026, 11, 14)
            snapshot = load_snapshot((UUID(ACCOUNT),), "test")

        self.assertEqual([
            (point["month"], {account["id"]: account["balanceCents"] for account in point["accounts"]})
            for point in snapshot["balanceSnapshots"]
        ], [
            ("2026-08", {ACCOUNT: 12647}),
            ("2026-09", {ACCOUNT: 12647}),
            ("2026-10", {ACCOUNT: 11536}),
        ])
        self.assertEqual([account["balanceCents"] for account in snapshot["accounts"]], [10023, 0])

    def test_snapshot_links_unique_same_owner_transfers_across_connected_accounts(self):
        first_item, second_item = UUID(int=1), UUID(int=2)
        first_account, second_account = str(UUID(int=3)), str(UUID(int=4))
        accounts = {
            first_item: [{"id": first_account, "type": "BANK", "currencyCode": "BRL", "balance": 2500}],
            second_item: [{"id": second_account, "type": "BANK", "currencyCode": "BRL", "balance": 500}],
        }
        transfer = {**self.entry, "category": "Same person transfer - PIX", "amount": 500}
        transactions = {
            first_account: [
                {**transfer, "id": str(UUID(int=5)), "accountId": first_account, "date": "2026-10-31"},
                {**transfer, "id": str(UUID(int=6)), "accountId": first_account, "date": "2026-11-04", "amount": 700},
            ],
            second_account: [
                {**transfer, "id": str(UUID(int=7)), "accountId": second_account, "date": "2026-11-01", "type": "CREDIT"},
                {**transfer, "id": str(UUID(int=8)), "accountId": second_account, "date": "2026-11-04", "amount": 700,
                 "type": "CREDIT", "category": None, "operationType": "PIX"},
            ],
        }
        with (
            patch("app.financial_snapshot.datetime", wraps=datetime) as clock,
            patch.object(pluggy, "meu_pluggy_item"),
            patch.object(pluggy, "institutions", return_value=[]),
            patch.object(pluggy, "investments", return_value=[]),
            patch.object(pluggy, "accounts", side_effect=lambda item_id, _: accounts[item_id]),
            patch.object(pluggy, "transactions", side_effect=lambda account_id, _: transactions[account_id]),
        ):
            clock.now.return_value = datetime(2026, 11, 14)
            entries = load_snapshot((first_item, second_item), "test")["transactions"]
        self.assertEqual([entry.get("transferAccountId") for entry in entries], [second_account, first_account, None, None])
        self.assertEqual([entry.get("internalTransfer") for entry in entries], ["account", "account", "account", None])
        self.assertEqual([entry["balanceImpactCents"] for entry in entries], [-50000, 50000, -70000, 70000])

    def test_snapshot_loads_generic_fund_positions_and_preserves_tax_in_a_matched_redemption(self):
        investment_id = str(UUID(int=10))
        bank = {"id": ACCOUNT, "type": "BANK", "currencyCode": "BRL", "balance": 1100, "updatedAt": "2026-11-14"}
        position = {
            "id": investment_id, "itemId": ACCOUNT, "currencyCode": "BRL", "name": "Unrelated fund name",
            "balance": 900, "date": "2026-11-14", "code": "12.345.678/0001-95", "type": "MUTUAL_FUND",
        }
        bank_entries = [
            {**self.entry, "id": str(UUID(int=11)), "date": "2026-10-01", "amount": 10, "type": "CREDIT"},
            {**self.entry, "id": str(UUID(int=12)), "date": "2026-11-07", "amount": 100, "type": "CREDIT",
             "operationType": "RESGATE_APLIC_FINANCEIRA"},
        ]
        fund_entries = [
            {"id": str(UUID(int=13)), "date": "2026-10-01", "amount": 1000, "netAmount": 1000, "type": "BUY"},
            {"id": str(UUID(int=14)), "date": "2026-11-07", "amount": 102, "netAmount": 100, "type": "SELL"},
        ]
        with (
            patch("app.financial_snapshot.datetime", wraps=datetime) as clock,
            patch.object(pluggy, "meu_pluggy_item"),
            patch.object(pluggy, "institutions", return_value=[]),
            patch.object(pluggy, "accounts", return_value=[bank]),
            patch.object(pluggy, "transactions", return_value=bank_entries),
            patch.object(pluggy, "investments", return_value=[position]),
            patch.object(pluggy, "investment_transactions", return_value=fund_entries),
        ):
            clock.now.return_value = datetime(2026, 11, 14)
            snapshot = load_snapshot((UUID(ACCOUNT),), "test")
            included = load_snapshot((UUID(ACCOUNT),), "test", position_links={investment_id: ACCOUNT})
        self.assertEqual(snapshot["investments"][0]["balanceCents"], 90000)
        self.assertEqual(sum(point["balanceCents"] for point in snapshot["balanceSnapshots"][0]["accounts"]), 200200)
        matched = [entry for entry in snapshot["transactions"] if entry.get("reconciliation") == "automatic"]
        self.assertEqual(len(matched), 2)
        self.assertEqual(sum(entry["balanceImpactCents"] for entry in matched), -200)
        self.assertEqual(included["balanceSnapshots"][0]["accounts"], [{"id": ACCOUNT, "bank": "Meu Pluggy · conexão 1", "balanceCents": 110200}])
        self.assertTrue(all(not any(key.startswith("_") for key in entry) for entry in snapshot["transactions"]))

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
            accounts, cards, _, _, _ = load_item(
                UUID(ACCOUNT), "test", "2026-11-14", "Connection 1",
                {"077": "Banco Inter", "341": "Itaú"},
            )
        return accounts, cards
