"""Catalog refreshes must not make financial snapshots unavailable."""

from datetime import UTC, datetime, timedelta
from unittest import TestCase
from unittest.mock import MagicMock, patch

from app import category_catalog, category_store, database, pluggy


class CatalogCacheTests(TestCase):
    def setUp(self):
        connection = self.enterContext(patch.object(database, "connect", return_value=MagicMock()))
        self.db = connection.return_value.__enter__.return_value
        self.addCleanup(setattr, category_catalog, "_retry_after", 0.0)
        category_catalog._retry_after = 0.0

    def test_fresh_empty_catalog_is_not_fetched_again(self):
        with (
            patch.object(category_store, "load_catalog", return_value=({}, datetime.now(UTC))),
            patch.object(pluggy, "categories") as fetch,
        ):
            self.assertEqual(category_catalog.load_catalog("test"), ({}, False))
            fetch.assert_not_called()

    def test_failed_refresh_keeps_cached_catalog_and_throttles_retries(self):
        cached = {"test": {"id": "test", "descriptionTranslated": "Categoria"}}
        with (
            patch.object(category_store, "load_catalog", return_value=(cached, datetime.now(UTC) - timedelta(days=2))),
            patch.object(category_store, "replace_catalog") as save,
            patch.object(pluggy, "categories", side_effect=pluggy.PluggyError) as fetch,
        ):
            self.assertEqual(category_catalog.load_catalog("test"), (cached, True))
            self.assertEqual(category_catalog.load_catalog("test"), (cached, True))
            fetch.assert_called_once()
            save.assert_not_called()

    def test_successful_refresh_persists_only_the_public_catalog(self):
        fetched = [{"id": "test", "description": "Category", "descriptionTranslated": "Categoria"}]
        with (
            patch.object(category_store, "load_catalog", return_value=({}, None)),
            patch.object(category_store, "replace_catalog") as save,
            patch.object(pluggy, "categories", return_value=fetched),
        ):
            self.assertEqual(category_catalog.load_catalog("test"), ({"test": fetched[0]}, False))
            save.assert_called_once_with(self.db, fetched)
            self.db.commit.assert_called_once()

    def test_concurrent_refresh_can_use_the_previous_catalog(self):
        cached = {"test": {"id": "test"}}
        with (
            category_catalog._refresh_lock,
            patch.object(category_store, "load_catalog", return_value=(cached, None)),
            patch.object(pluggy, "categories") as fetch,
        ):
            self.assertEqual(category_catalog.load_catalog("test"), (cached, True))
            fetch.assert_not_called()
