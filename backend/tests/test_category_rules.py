from copy import deepcopy
from datetime import date
from unittest import TestCase
from uuid import UUID

from app.category_rules import first_matching_rule, normalize_draft, preview_rule, rule_matches
from app.category_store import CategoryNotFound


CATEGORY = str(UUID(int=1))
OTHER_CATEGORY = str(UUID(int=2))
ACCOUNT = str(UUID(int=3))
RULE = str(UUID(int=4))
TODAY = date(2026, 11, 20)


def rule(**fields):
    return {"id": RULE, "categoryId": CATEGORY, "description": "Loja", "matchType": "contains",
            "accountId": None, "priority": 100, "startsOn": None, "enabled": True,
            "createdAt": "2026-11-01T12:00:00+00:00", **fields}


class PersonalCategoryRuleTests(TestCase):
    def setUp(self):
        self.categories = [
            {"id": CATEGORY, "code": None, "name": "Escritório", "archived": False, "archivedAt": None},
            {"id": OTHER_CATEGORY, "code": "shopping", "name": "Compras", "archived": False, "archivedAt": None},
        ]
        self.draft = {"categoryId": CATEGORY, "description": "Loja", "matchType": "contains",
                      "accountId": None, "priority": 100, "applyToHistory": True}
        self.entry = {"id": f"{ACCOUNT}.{UUID(int=5)}", "name": "Loja de informática", "date": "2026-11-20",
                      "kind": "expense", "cardId": ACCOUNT, "amountCents": 1001,
                      "category": "Compras", "categoryKey": "shopping", "categorySource": "pluggy",
                      "categoryNeedsReview": False}
        self.data = {"transactions": [self.entry], "cards": [], "accounts": []}

    def test_all_literal_matching_modes_ignore_case_and_extra_whitespace(self):
        entry = {**self.entry, "name": "  LOJA   de Informática  "}
        for mode, pattern in (("exact", "loja de informática"), ("contains", "DE Informática"),
                              ("starts_with", "loja de"), ("ends_with", "Informática")):
            with self.subTest(mode=mode):
                self.assertTrue(rule_matches(entry, rule(matchType=mode, description=pattern)))
                self.assertFalse(rule_matches(entry, rule(matchType=mode, description="Outra loja")))
        self.assertFalse(rule_matches(entry, rule(description=".*")))
        self.assertFalse(rule_matches(entry, rule(description="")))

    def test_rules_only_match_expenses_within_the_selected_account_and_date_scope(self):
        scoped = rule(accountId=ACCOUNT, startsOn="2026-11-20")
        self.assertTrue(rule_matches(self.entry, scoped))
        self.assertTrue(rule_matches({**self.entry, "cardId": None, "accountId": ACCOUNT}, scoped))
        self.assertFalse(rule_matches({**self.entry, "date": "2026-11-19"}, scoped))
        self.assertFalse(rule_matches({**self.entry, "cardId": str(UUID(int=99))}, scoped))
        for kind in ("income", "transfer", "refund", "credit"):
            self.assertFalse(rule_matches({**self.entry, "kind": kind}, scoped))
        self.assertFalse(rule_matches(self.entry, {**scoped, "enabled": False}))

    def test_priority_creation_time_and_identifier_produce_deterministic_winners(self):
        first = rule(id=str(UUID(int=8)), priority=50)
        second = rule(id=str(UUID(int=7)), priority=50)
        newer = rule(id=str(UUID(int=6)), priority=50, createdAt="2026-11-02T12:00:00+00:00")
        later_priority = rule(id=str(UUID(int=5)), priority=100)
        self.assertEqual(first_matching_rule(self.entry, [newer, later_priority, first, second], {CATEGORY})["id"], second["id"])
        self.assertIsNone(first_matching_rule(self.entry, [first], {OTHER_CATEGORY}))

    def test_normalization_binds_scope_and_preserves_creation_order_for_edits(self):
        candidate = normalize_draft({**self.draft, "description": "  Loja   pessoal ", "applyToHistory": False}, [], TODAY)
        self.assertEqual(candidate["description"], "Loja pessoal")
        self.assertEqual(candidate["startsOn"], "2026-11-20")
        self.assertEqual(candidate["id"], "__draft__")
        existing = rule()
        edit = normalize_draft({**self.draft, "ruleId": RULE}, [existing], TODAY)
        self.assertEqual((edit["id"], edit["createdAt"], edit["startsOn"]), (RULE, existing["createdAt"], None))
        with self.assertRaises(CategoryNotFound):
            normalize_draft({**self.draft, "ruleId": str(UUID(int=999))}, [existing], TODAY)

    def test_invalid_drafts_are_rejected(self):
        for fields in ({"description": ""}, {"description": "x" * 201}, {"description": "line\nbreak"},
                       {"priority": True}, {"priority": 0}, {"priority": 1001}, {"matchType": []},
                       {"matchType": "regex"}, {"accountId": "other"}, {"categoryId": "other"},
                       {"applyToHistory": "yes"}, {"enabled": 1}):
            with self.subTest(fields=fields), self.assertRaises(ValueError):
                normalize_draft({**self.draft, **fields}, [], TODAY)

    def test_preview_counts_actual_changes_and_preserves_manual_choices(self):
        other = {**self.entry, "id": f"{ACCOUNT}.{UUID(int=6)}"}
        self.data["transactions"].append(other)
        original = deepcopy(self.data)
        result = preview_rule(self.data, self.categories, {self.entry["id"]: CATEGORY}, [], self.draft, TODAY)
        self.assertEqual((result["affectedCount"], result["manualCount"]), (1, 1))
        self.assertEqual(self.data, original)
        already = preview_rule(self.data, self.categories, {}, [rule()], self.draft, TODAY)
        self.assertEqual(already["affectedCount"], 0)

    def test_future_scope_excludes_old_transactions_and_same_category_is_not_a_change(self):
        self.entry["date"] = "2026-11-19"
        result = preview_rule(self.data, self.categories, {}, [], {**self.draft, "applyToHistory": False}, TODAY)
        self.assertEqual(result["affectedCount"], 0)
        same = preview_rule(self.data, self.categories, {}, [], {**self.draft, "categoryId": OTHER_CATEGORY}, TODAY)
        self.assertEqual(same["affectedCount"], 0)

    def test_preview_rejects_archived_or_foreign_category_targets(self):
        self.categories[0]["archived"] = True
        with self.assertRaises(CategoryNotFound):
            preview_rule(self.data, self.categories, {}, [], self.draft, TODAY)
        with self.assertRaises(CategoryNotFound):
            preview_rule(self.data, self.categories, {}, [], {**self.draft, "categoryId": str(UUID(int=999))}, TODAY)

    def test_fingerprint_is_stable_and_invalidates_on_financial_or_preference_changes(self):
        baseline = preview_rule(self.data, self.categories, {}, [], self.draft, TODAY)["fingerprint"]
        repeated = preview_rule(deepcopy(self.data), list(reversed(self.categories)), {}, [], dict(self.draft), TODAY)
        self.assertEqual(repeated["fingerprint"], baseline)
        for data, categories, assignments, rules, draft in (
            ({**self.data, "transactions": [{**self.entry, "amountCents": 1002}]}, self.categories, {}, [], self.draft),
            (self.data, [{**self.categories[0], "name": "Novo nome"}, self.categories[1]], {}, [], self.draft),
            (self.data, self.categories, {self.entry["id"]: CATEGORY}, [], self.draft),
            (self.data, self.categories, {}, [rule()], self.draft),
            (self.data, self.categories, {}, [], {**self.draft, "priority": 20}),
        ):
            with self.subTest(draft=draft):
                changed = preview_rule(data, categories, assignments, rules, draft, TODAY)["fingerprint"]
                self.assertNotEqual(changed, baseline)
