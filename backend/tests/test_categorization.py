"""Provider categorization contracts use fabricated records, never live data."""

from decimal import Decimal
from unittest import TestCase
from unittest.mock import patch

from app import pluggy
from app.categorization import DEFAULT_CATEGORIES, resolve_provider_category
from app.financial_snapshot import normalize_transaction


class ProviderCategoryTests(TestCase):
    def test_id_and_nearest_ancestor_take_precedence_over_stale_names(self):
        catalog = {
            "root": {"id": "root", "description": "Services", "descriptionTranslated": "Serviços"},
            "parent": {"id": "parent", "description": "Education", "descriptionTranslated": "Educação", "parentId": "root"},
            "leaf": {"id": "leaf", "description": "New education category", "descriptionTranslated": "Aulas particulares", "parentId": "parent"},
        }
        result = resolve_provider_category({"categoryId": "leaf", "category": "Groceries"}, catalog)
        self.assertEqual((result["categoryKey"], result["category"]), ("education", "Educação"))
        self.assertEqual(result["providerCategoryName"], "Groceries")
        self.assertEqual(result["providerCategoryLabel"], "Aulas particulares")
        self.assertFalse(result["categoryNeedsReview"])

    def test_previously_discarded_names_have_categories(self):
        for name, expected in (("Electronics", "shopping"), ("Online shopping", "shopping"), ("Education", "education"), ("Internet", "services")):
            with self.subTest(name=name):
                result = resolve_provider_category({"category": name})
                self.assertEqual(result["categoryKey"], expected)
                self.assertEqual(result["categorySource"], "pluggy")

    def test_unknown_translated_category_remains_available(self):
        catalog = {"new": {"id": "new", "description": "New category", "descriptionTranslated": "Nova categoria"}}
        result = resolve_provider_category({"categoryId": "new", "category": "New category"}, catalog)
        self.assertEqual((result["categoryKey"], result["category"]), ("pluggy:new", "Nova categoria"))
        self.assertFalse(result["categoryNeedsReview"])

    def test_untranslated_category_is_distinct_from_missing_category(self):
        unknown = resolve_provider_category({"categoryId": "future", "category": "Future category"})
        missing = resolve_provider_category({"category": None})
        self.assertEqual(unknown["categoryKey"], "review")
        self.assertTrue(unknown["categoryNeedsReview"])
        self.assertEqual(unknown["providerCategoryName"], "Future category")
        self.assertEqual(missing["categoryKey"], "uncategorized")
        self.assertEqual(missing["categorySource"], "unclassified")
        self.assertFalse(missing["categoryNeedsReview"])

    def test_catalog_parent_description_supports_missing_parent_record(self):
        catalog = {"leaf": {"id": "leaf", "description": "New category", "parentId": "missing", "parentDescription": "Shopping"}}
        self.assertEqual(resolve_provider_category({"categoryId": "leaf"}, catalog)["categoryKey"], "shopping")

    def test_cycles_and_invalid_source_values_do_not_break_reports(self):
        catalog = {"a": {"id": "a", "parentId": "b"}, "b": {"id": "b", "parentId": "a"}}
        self.assertTrue(resolve_provider_category({"categoryId": "a"}, catalog)["categoryNeedsReview"])
        self.assertEqual(resolve_provider_category({"categoryId": [], "category": {}})["categoryKey"], "uncategorized")
        self.assertEqual(len(DEFAULT_CATEGORIES), len(dict(DEFAULT_CATEGORIES)))

    def test_display_category_does_not_change_transfer_nature_or_amount(self):
        raw = {
            "id": "adc49032-13eb-4b23-82dd-a4963c014956", "accountId": "2f5fb14d-49a8-43db-955c-580165f7ea4e",
            "date": "2026-11-14", "amount": Decimal("10.01"), "currencyCode": "BRL", "status": "POSTED",
            "type": "DEBIT", "category": "Same person transfer - PIX", "categoryId": "transfer",
        }
        entry = normalize_transaction(raw, raw["accountId"], "2026-11-14", False, catalog={
            "transfer": {"id": "transfer", "description": "Education", "descriptionTranslated": "Educação"},
        })
        self.assertEqual((entry["kind"], entry["amountCents"], entry["internalTransfer"]), ("transfer", 1001, "account"))
        self.assertNotIn("category", entry)
        self.assertEqual(entry["providerCategoryName"], "Same person transfer - PIX")


class CategoryCatalogTests(TestCase):
    def test_fetches_documented_catalog_fields(self):
        records = [{"id": "01000000", "description": "Income", "descriptionTranslated": "Renda"}]
        with patch.object(pluggy, "request", return_value={"results": records, "page": 1, "totalPages": 1, "total": 1}) as request:
            self.assertEqual(pluggy.categories("test-key"), records)
            request.assert_called_once_with("/categories", api_key="test-key")

    def test_rejects_partial_duplicate_or_malformed_catalogs(self):
        cases = (
            {"results": [], "page": 1, "totalPages": 2, "total": 4},
            {"results": [], "page": 1, "totalPages": 1, "total": 1},
            {"results": [{"id": "same"}, {"id": "same"}], "page": 1, "totalPages": 1, "total": 2},
            {"results": [{"id": None}], "page": 1, "totalPages": 1, "total": 1},
            {"results": [{"id": "valid", "description": ""}], "page": 1, "totalPages": 1, "total": 1},
            {"results": [{"id": "valid", "description": "Shopping", "descriptionTranslated": {}}], "page": 1, "totalPages": 1, "total": 1},
            {"results": [{"id": "valid", "description": "Shopping", "parentId": []}], "page": 1, "totalPages": 1, "total": 1},
            {"results": [{"id": "valid", "description": "Shopping", "descriptionTranslated": "x" * 201}], "page": 1, "totalPages": 1, "total": 1},
            {"results": "invalid", "page": 1, "totalPages": 1, "total": 1},
        )
        for data in cases:
            with self.subTest(data=data), patch.object(pluggy, "request", return_value=data):
                with self.assertRaises(pluggy.PluggyError):
                    pluggy.categories("test-key")
