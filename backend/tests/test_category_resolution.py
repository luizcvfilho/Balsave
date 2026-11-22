"""Category preferences must only redistribute expenses, never financial totals."""

from copy import deepcopy
from datetime import date
from decimal import Decimal
from unittest import TestCase

from app.categorization import DEFAULT_CATEGORIES
from app.category_resolution import apply_categories
from app.financial_snapshot import normalize_transaction
from app.installment_planning import ObservedInstallment, planned_installments
from app.reconciliation import clear_expense_classification


ACCOUNT = "2f5fb14d-49a8-43db-955c-580165f7ea4e"
TRANSACTION = "adc49032-13eb-4b23-82dd-a4963c014956"
CUSTOM_ID = "89e417f7-91e2-431c-a699-56188463763b"


class CategoryResolutionTests(TestCase):
    def setUp(self):
        self.categories = [
            {"id": f"local-{code}", "code": code, "name": name, "archived": False}
            for code, name in DEFAULT_CATEGORIES
        ] + [{"id": CUSTOM_ID, "code": None, "name": "Escritório", "archived": False}]
        self.raw = {
            "id": TRANSACTION, "accountId": ACCOUNT, "date": "2026-11-14", "description": "Loja",
            "amount": Decimal("10.01"), "currencyCode": "BRL", "status": "POSTED", "type": "DEBIT",
            "category": "Electronics", "categoryId": "provider-electronics",
        }
        self.entry = normalize_transaction(self.raw, ACCOUNT, "2026-11-14", True)
        self.data = {"transactions": [self.entry], "cards": [], "accounts": [{"id": ACCOUNT, "balanceCents": 12345}]}

    def test_automatic_category_uses_local_identity_and_renamed_label(self):
        shopping = next(row for row in self.categories if row["code"] == "shopping")
        shopping["name"] = "Compras pessoais"
        result = apply_categories(self.data, self.categories, {})
        self.assertIs(result, self.data)
        self.assertEqual((self.entry["categoryId"], self.entry["categoryKey"], self.entry["category"]),
                         ("local-shopping", "shopping", "Compras pessoais"))
        self.assertEqual(self.entry["categorySource"], "pluggy")
        shopping["name"] = "Consumo"
        apply_categories(self.data, self.categories, {})
        self.assertEqual(self.entry["category"], "Consumo")
        self.assertEqual(self.entry["categoryKey"], "shopping")

    def test_manual_choice_overrides_provider_and_survives_a_fresh_snapshot(self):
        saved = {self.entry["id"]: CUSTOM_ID}
        apply_categories(self.data, self.categories, saved)
        self.assertEqual((self.entry["category"], self.entry["categoryKey"], self.entry["categorySource"]),
                         ("Escritório", f"custom:{CUSTOM_ID}", "manual"))
        refreshed = {"transactions": [normalize_transaction({**self.raw, "category": "Groceries"}, ACCOUNT, "2026-11-14", True)]}
        apply_categories(refreshed, deepcopy(self.categories), dict(saved))
        self.assertEqual(refreshed["transactions"][0]["categoryId"], CUSTOM_ID)
        self.assertEqual(refreshed["transactions"][0]["providerCategoryName"], "Groceries")

    def test_removing_manual_choice_restores_automatic_on_the_same_cached_snapshot(self):
        apply_categories(self.data, self.categories, {self.entry["id"]: CUSTOM_ID})
        apply_categories(self.data, self.categories, {})
        self.assertEqual((self.entry["categoryKey"], self.entry["categorySource"], self.entry["categoryId"]),
                         ("shopping", "pluggy", "local-shopping"))

    def test_archived_manual_target_is_retained_but_automatic_target_is_not_assigned(self):
        custom = self.categories[-1]
        custom["archived"] = True
        apply_categories(self.data, self.categories, {self.entry["id"]: CUSTOM_ID})
        self.assertEqual(self.entry["categoryId"], CUSTOM_ID)
        next(row for row in self.categories if row["code"] == "shopping")["archived"] = True
        apply_categories(self.data, self.categories, {})
        self.assertIsNone(self.entry["categoryId"])
        self.assertEqual(self.entry["categoryKey"], "pluggy:provider-electronics")
        self.assertEqual(self.entry["category"], "Compras")

    def test_missing_archived_target_source_id_goes_to_review(self):
        self.entry.pop("providerCategoryId")
        next(row for row in self.categories if row["code"] == "shopping")["archived"] = True
        apply_categories(self.data, self.categories, {})
        self.assertEqual(self.entry["categoryKey"], "review")
        self.assertTrue(self.entry["categoryNeedsReview"])

    def test_archived_automatic_category_preserves_history_through_local_archive_day(self):
        shopping = next(row for row in self.categories if row["code"] == "shopping")
        shopping.update(archived=True, archivedAt="2026-11-15T01:30:00+00:00", name="Compras pessoais")
        # UTC November 15 is still November 14 in the report timezone.
        apply_categories(self.data, self.categories, {})
        self.assertEqual((self.entry["categoryId"], self.entry["category"]), ("local-shopping", "Compras pessoais"))
        self.entry["date"] = "2026-11-15"
        apply_categories(self.data, self.categories, {})
        self.assertIsNone(self.entry["categoryId"])
        self.assertEqual(self.entry["categoryKey"], "pluggy:provider-electronics")

    def test_bad_or_missing_archive_timestamp_never_creates_automatic_assignments(self):
        shopping = next(row for row in self.categories if row["code"] == "shopping")
        for archived_at in (None, "invalid", "2026-11-15T10:00:00", {}):
            with self.subTest(archived_at=archived_at):
                shopping.update(archived=True, archivedAt=archived_at)
                apply_categories(self.data, self.categories, {})
                self.assertIsNone(self.entry["categoryId"])

    def test_unknown_translated_provider_category_stays_available(self):
        entry = normalize_transaction({**self.raw, "categoryId": "new", "category": "New category"}, ACCOUNT, "2026-11-14", True,
                                      catalog={"new": {"id": "new", "description": "New category", "descriptionTranslated": "Categoria nova"}})
        apply_categories({"transactions": [entry]}, self.categories, {})
        self.assertEqual((entry["category"], entry["categoryKey"], entry["categoryId"]), ("Categoria nova", "pluggy:new", None))

    def test_manual_choice_clears_review_but_preserves_original_source(self):
        entry = normalize_transaction({**self.raw, "category": "New category"}, ACCOUNT, "2026-11-14", True)
        apply_categories({"transactions": [entry]}, self.categories, {entry["id"]: CUSTOM_ID})
        self.assertFalse(entry["categoryNeedsReview"])
        self.assertEqual(entry["categorySource"], "manual")
        self.assertEqual(entry["providerCategoryName"], "New category")

    def test_absent_source_and_missing_assignment_target_do_not_invent_a_category(self):
        entry = normalize_transaction({**self.raw, "category": None, "categoryId": None}, ACCOUNT, "2026-11-14", True)
        apply_categories({"transactions": [entry]}, self.categories, {entry["id"]: "other-owners-category"})
        self.assertEqual((entry["categoryKey"], entry["categorySource"]), ("uncategorized", "unclassified"))

    def test_only_expense_display_fields_change(self):
        transfer = {"id": "transfer", "kind": "transfer", "amountCents": 2000, "direction": "out", "accountId": ACCOUNT}
        self.data["transactions"].append(transfer)
        original = deepcopy(self.data)
        apply_categories(self.data, self.categories, {self.entry["id"]: CUSTOM_ID, "transfer": CUSTOM_ID})
        self.assertEqual(self.data["accounts"], original["accounts"])
        self.assertEqual(self.data["transactions"][1], original["transactions"][1])
        for field in ("id", "date", "kind", "amountCents", "cardId", "paymentMethod"):
            self.assertEqual(self.entry[field], original["transactions"][0][field])
        self.assertEqual(sum(row["amountCents"] for row in self.data["transactions"]),
                         sum(row["amountCents"] for row in original["transactions"]))

    def test_projection_uses_latest_observed_classification_and_remains_consistent(self):
        latest = {**deepcopy(self.entry), "id": "latest"}
        self.data["transactions"].append(latest)
        observed = [
            ObservedInstallment(self.entry["id"], "Store 1/3", "Compras", date(2026, 10, 14), date(2026, 10, 14), 1, 3, 1001),
            ObservedInstallment(latest["id"], "Store 2/3", "Compras", date(2026, 10, 14), date(2026, 11, 14), 2, 3, 1001),
        ]
        plans = planned_installments(observed, None)
        self.data["cards"] = [{"installments": plans}]
        apply_categories(self.data, self.categories, {latest["id"]: CUSTOM_ID})
        self.assertEqual(plans[0]["transactionId"], self.entry["id"])
        self.assertEqual(plans[0]["categoryTransactionId"], latest["id"])
        self.assertEqual((plans[0]["category"], plans[0]["categoryKey"], plans[0]["categorySource"]),
                         ("Escritório", f"custom:{CUSTOM_ID}", "manual"))
        self.assertEqual(plans[0]["amountCents"], 1001)
        apply_categories(self.data, self.categories, {})
        self.assertEqual(plans[0]["category"], "Compras")

    def test_reconciliation_cleanup_preserves_provider_evidence(self):
        apply_categories(self.data, self.categories, {self.entry["id"]: CUSTOM_ID})
        self.entry["categoryRuleId"] = "old-rule"
        clear_expense_classification(self.entry)
        for field in ("category", "categoryId", "categoryKey", "categorySource", "categoryNeedsReview", "categoryRuleId", "_automaticCategory", "paymentMethod"):
            self.assertNotIn(field, self.entry)
        self.assertEqual(self.entry["providerCategoryName"], "Electronics")

    def rule(self, **changes):
        return {
            "id": "test-rule", "categoryId": CUSTOM_ID, "description": "Loja", "matchType": "exact",
            "accountId": None, "priority": 100, "startsOn": None, "enabled": True,
            "createdAt": "2026-11-20T12:00:00+00:00", **changes,
        }

    def test_personal_rule_overrides_provider_but_manual_choice_has_priority(self):
        rule = self.rule()
        original_rule = deepcopy(rule)
        apply_categories(self.data, self.categories, {}, [rule])
        self.assertEqual((self.entry["category"], self.entry["categorySource"], self.entry["categoryRuleId"]),
                         ("Escritório", "rule", rule["id"]))
        self.assertEqual(self.entry["providerCategoryName"], "Electronics")
        self.assertFalse(self.entry["categoryNeedsReview"])
        apply_categories(self.data, self.categories, {self.entry["id"]: "local-food"}, [rule])
        self.assertEqual((self.entry["categoryKey"], self.entry["categorySource"]), ("food", "manual"))
        self.assertNotIn("categoryRuleId", self.entry)
        apply_categories(self.data, self.categories, {}, [rule])
        self.assertEqual(self.entry["categorySource"], "rule")
        self.assertEqual(rule, original_rule)

    def test_disabling_removing_or_unmatching_rule_restores_auto_without_stale_metadata(self):
        rule = self.rule()
        for replacement in ([], [self.rule(enabled=False)], [self.rule(description="Outra loja")]):
            with self.subTest(replacement=replacement):
                apply_categories(self.data, self.categories, {}, [rule])
                self.assertEqual(self.entry["categoryRuleId"], rule["id"])
                apply_categories(self.data, self.categories, {}, replacement)
                self.assertEqual((self.entry["categoryKey"], self.entry["categorySource"]), ("shopping", "pluggy"))
                self.assertNotIn("categoryRuleId", self.entry)

    def test_rule_target_archiving_preserves_history_and_excludes_later_dates(self):
        category = self.categories[-1]
        category.update(archived=True, archivedAt="2026-11-15T01:30:00+00:00")
        rule = self.rule()
        apply_categories(self.data, self.categories, {}, [rule])
        self.assertEqual((self.entry["categoryId"], self.entry["categorySource"]), (CUSTOM_ID, "rule"))
        self.entry["date"] = "2026-11-15"
        apply_categories(self.data, self.categories, {}, [rule])
        self.assertEqual(self.entry["categorySource"], "pluggy")
        self.assertNotIn("categoryRuleId", self.entry)

    def test_rule_scope_ignores_other_accounts_and_dates_before_its_start(self):
        for rule in (self.rule(accountId="other-account"), self.rule(startsOn="2026-11-15")):
            with self.subTest(rule=rule):
                apply_categories(self.data, self.categories, {}, [rule])
                self.assertEqual(self.entry["categorySource"], "pluggy")
                self.assertNotIn("categoryRuleId", self.entry)

    def test_projection_rule_metadata_is_cleared_when_returning_to_auto_or_manual(self):
        plan = {"transactionId": self.entry["id"], "category": "Compras", "amountCents": 1001}
        self.data["cards"] = [{"installments": [plan]}]
        rule = self.rule()
        apply_categories(self.data, self.categories, {}, [rule])
        self.assertEqual((plan["categorySource"], plan["categoryRuleId"]), ("rule", rule["id"]))
        apply_categories(self.data, self.categories, {}, [])
        self.assertEqual(plan["categorySource"], "pluggy")
        self.assertNotIn("categoryRuleId", plan)
        apply_categories(self.data, self.categories, {}, [rule])
        apply_categories(self.data, self.categories, {self.entry["id"]: "local-food"}, [rule])
        self.assertEqual(plan["categorySource"], "manual")
        self.assertNotIn("categoryRuleId", plan)
        self.assertEqual(plan["amountCents"], 1001)
