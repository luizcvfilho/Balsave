from copy import deepcopy
from unittest import TestCase

from app.reconciliation import fingerprint, reconcile


def entry(identifier, position, amount, *, investment=False, operation="PIX", owner="12345678901", same_owner=False, item="connection", reference=""):
    return {
        "id": identifier, "investmentId" if investment else "accountId": position,
        "date": "2026-10-26", "amountCents": abs(amount), "balanceImpactCents": amount, "kind": "income" if amount > 0 else "expense",
        "_evidence": {
            "cash": amount, "dates": ["2026-10-26"], "owner": owner, "counterparty": None,
            "reference": reference, "operation": operation, "selfTransfer": same_owner,
            "fundOperation": operation in ("BUY", "SELL", "RESGATE_APLIC_FINANCEIRA", "APLICACAO_FINANCEIRA"),
            "eligible": True, "itemId": item,
        },
    }


class ReconciliationTests(TestCase):
    def test_redemption_and_external_pix_keep_the_external_payment(self):
        withdrawal = entry("withdrawal", "fund", -100000, investment=True, operation="SELL")
        credit = entry("credit", "bank", 100000, operation="RESGATE_APLIC_FINANCEIRA")
        pix = entry("pix", "bank", -100000)
        entries = [withdrawal, credit, pix]
        candidates = reconcile(entries, [{"id": "bank"}, {"id": "fund"}], {})
        self.assertEqual(candidates, [])
        self.assertEqual(credit["counterpartId"], "withdrawal")
        self.assertNotIn("reconciliation", pix)
        self.assertEqual(sum(item["balanceImpactCents"] for item in entries), -100000)

    def test_equal_salary_and_payment_in_the_same_account_are_not_internal(self):
        salary, payment = entry("salary", "bank", 50000), entry("payment", "bank", -50000)
        self.assertEqual(reconcile([salary, payment], [{"id": "bank"}], {}), [])
        self.assertNotIn("counterpartId", salary)

    def test_ambiguous_equal_redemptions_require_a_saved_decision(self):
        entries = [entry("a", "fund-a", -50000, investment=True, operation="SELL"),
                   entry("b", "fund-b", -50000, investment=True, operation="SELL"),
                   entry("c", "bank", 50000, operation="RESGATE_APLIC_FINANCEIRA")]
        original = deepcopy(entries)
        positions = [{"id": "bank"}, {"id": "fund-a"}, {"id": "fund-b"}]
        self.assertEqual(len(reconcile(entries, positions, {})), 2)
        self.assertTrue(all("reconciliation" not in item for item in entries))
        decisions = {"a": {"counterpartId": "c", "fingerprint": fingerprint(original[0])},
                     "c": {"counterpartId": "a", "fingerprint": fingerprint(original[2])}}
        self.assertEqual(reconcile(original, positions, decisions), [])
        self.assertEqual(original[0]["reconciliation"], "confirmed")
        self.assertNotIn("reconciliation", original[1])

    def test_explicit_third_party_documents_prevent_automatic_matching(self):
        first = entry("a", "bank-a", -10000, same_owner=True)
        second = entry("b", "bank-b", 10000, same_owner=True)
        first["_evidence"]["counterparty"] = "98765432100"
        self.assertEqual(reconcile([first, second], [], {}), [])

    def test_tax_difference_is_preserved_and_overlap_does_not_duplicate_the_balance(self):
        fund = entry("sell", "fund", -10200, investment=True, operation="SELL")
        fund["_evidence"]["cash"] = -10000
        bank = entry("credit", "bank", 10000, operation="RESGATE_APLIC_FINANCEIRA")
        positions = [{"id": "bank"}, {"id": "fund"}]
        reconcile([fund, bank], positions, {})
        self.assertEqual(fund["balanceImpactCents"] + bank["balanceImpactCents"], -200)
        self.assertEqual(fund["transferCashCents"] + bank["transferCashCents"], 0)
        fund = entry("sell", "fund", -10200, investment=True, operation="SELL")
        fund["_evidence"]["cash"] = -10000
        bank = entry("credit", "bank", 10000, operation="RESGATE_APLIC_FINANCEIRA")
        reconcile([fund, bank], [{"id": "bank"}, {"id": "fund", "includedInAccountId": "bank"}], {})
        self.assertEqual(bank["balanceImpactCents"], -200)
        self.assertEqual(bank["reconciliationCostCents"], 200)

    def test_changed_posting_invalidates_a_saved_inclusion(self):
        bank = entry("a", "bank", 50000, operation="RESGATE_APLIC_FINANCEIRA")
        decision = {"a": {"counterpartId": None, "fingerprint": fingerprint(bank)}}
        bank["balanceImpactCents"] = 49999
        bank["amountCents"] = 49999
        reconcile([bank], [{"id": "bank", "automaticBalanceCents": 100000}], decision)
        self.assertNotIn("reconciliation", bank)

    def test_verified_past_internal_posting_remains_internal_when_the_current_balance_is_zero(self):
        bank = entry("a", "bank", 50000, operation="RESGATE_APLIC_FINANCEIRA")
        decision = {"a": {"counterpartId": None, "fingerprint": fingerprint(bank)}}
        reconcile([bank], [{"id": "bank", "automaticBalanceCents": 0}], decision)
        self.assertEqual(bank["balanceImpactCents"], 0)
        self.assertEqual(bank["reconciliation"], "confirmed")
