import os
from unittest import TestCase, skipUnless
from uuid import UUID, uuid4

import psycopg
from psycopg.errors import ForeignKeyViolation

from app import category_store
from app.categorization import DEFAULT_CATEGORIES


DATABASE_URL = os.getenv("BALSAVE_TEST_DATABASE_URL")


@skipUnless(DATABASE_URL, "Set BALSAVE_TEST_DATABASE_URL to a migrated test database.")
class CategoryStoreTests(TestCase):
    def setUp(self):
        self.db = psycopg.connect(DATABASE_URL)
        self.addCleanup(self.db.close)
        self.owner = self.db.execute("INSERT INTO balsave.users DEFAULT VALUES RETURNING id").fetchone()[0]
        self.other = self.db.execute("INSERT INTO balsave.users DEFAULT VALUES RETURNING id").fetchone()[0]
        self.entry_id = f"{uuid4()}.{uuid4()}"

    def test_default_seeds_are_idempotent_and_preserve_renames_and_archiving(self):
        categories = category_store.ensure_default_categories(self.db, self.owner)
        self.assertEqual(len(categories), len(DEFAULT_CATEGORIES))
        selected = categories[0]
        category_store.update_category(self.db, self.owner, UUID(selected["id"]), name="Categoria pessoal", archived=True)
        again = category_store.ensure_default_categories(self.db, self.owner)
        self.assertEqual({row["id"] for row in categories}, {row["id"] for row in again})
        self.assertEqual(next(row for row in again if row["id"] == selected["id"])["name"], "Categoria pessoal")
        self.assertTrue(next(row for row in again if row["id"] == selected["id"])["archived"])
        archived = next(row for row in again if row["id"] == selected["id"])
        self.assertIsInstance(archived["archivedAt"], str)
        self.assertIn("+", archived["archivedAt"])
        self.assertEqual(category_store.list_categories(self.db, self.other), [])

    def test_seeding_adopts_matching_legacy_category_without_deleting_duplicate_rows(self):
        ids = [self.db.execute(
            "INSERT INTO balsave.categories (user_id, name) VALUES (%s, 'Alimentação') RETURNING id", (self.owner,),
        ).fetchone()[0] for _ in range(2)]
        categories = category_store.ensure_default_categories(self.db, self.owner)
        self.assertEqual(len(categories), len(DEFAULT_CATEGORIES) + 1)
        self.assertTrue({str(identifier) for identifier in ids}.issubset({row["id"] for row in categories}))
        self.assertEqual(len([row for row in categories if row["code"] == "food"]), 1)

    def test_names_are_normalized_and_owner_scoped(self):
        category = category_store.create_category(self.db, self.owner, "  Escritório   pessoal  ")
        self.assertEqual(category["name"], "Escritório pessoal")
        with self.assertRaises(category_store.CategoryConflict):
            category_store.create_category(self.db, self.owner, "escritório pessoal")
        other = category_store.create_category(self.db, self.other, "Escritório pessoal")
        self.assertNotEqual(other["id"], category["id"])
        for invalid in ("", " " * 3, "A" * 81, "Text\x00", "Line\nbreak"):
            with self.subTest(name=invalid), self.assertRaises(ValueError):
                category_store.create_category(self.db, self.owner, invalid)

    def test_rename_conflicts_and_cross_owner_updates_are_rejected(self):
        first = category_store.create_category(self.db, self.owner, "Trabalho")
        second = category_store.create_category(self.db, self.owner, "Casa")
        with self.assertRaises(category_store.CategoryConflict):
            category_store.update_category(self.db, self.owner, UUID(second["id"]), name=" trabalho ")
        with self.assertRaises(category_store.CategoryNotFound):
            category_store.update_category(self.db, self.other, UUID(first["id"]), name="Alterada")

    def test_assignment_removal_restores_automatic_and_archiving_preserves_history(self):
        category = category_store.create_category(self.db, self.owner, "Trabalho")
        identifier = UUID(category["id"])
        category_store.set_assignment(self.db, self.owner, self.entry_id, identifier)
        self.assertEqual(category_store.assignments(self.db, self.owner), {self.entry_id: category["id"]})
        self.assertEqual(category_store.assignments(self.db, self.other), {})
        category_store.update_category(self.db, self.owner, identifier, archived=True)
        self.assertEqual(category_store.assignments(self.db, self.owner), {self.entry_id: category["id"]})
        with self.assertRaises(category_store.CategoryNotFound):
            category_store.set_assignment(self.db, self.owner, f"{uuid4()}.{uuid4()}", identifier)
        category_store.set_assignment(self.db, self.owner, self.entry_id, None)
        self.assertEqual(category_store.assignments(self.db, self.owner), {})

    def test_assignments_require_owned_categories_in_service_and_database(self):
        category = category_store.create_category(self.db, self.owner, "Trabalho")
        with self.assertRaises(category_store.CategoryNotFound):
            category_store.set_assignment(self.db, self.other, self.entry_id, UUID(category["id"]))
        with self.assertRaises(ForeignKeyViolation), self.db.transaction():
            self.db.execute(
                "INSERT INTO balsave.transaction_category_assignments (user_id, entry_id, category_id) VALUES (%s, %s, %s)",
                (self.other, self.entry_id, category["id"]),
            )
        with self.assertRaises(ValueError):
            category_store.set_assignment(self.db, self.owner, "not-a-reference", UUID(category["id"]))

    def test_catalog_round_trip_empty_refresh_and_invalid_refresh_preserve_cache(self):
        records = [{"id": "08010000", "description": "Electronics", "descriptionTranslated": "Eletrônicos",
                    "parentId": "08000000", "parentDescription": "Shopping"}]
        category_store.replace_catalog(self.db, records)
        catalog, refreshed = category_store.load_catalog(self.db)
        self.assertEqual(catalog, {records[0]["id"]: records[0]})
        self.assertIsNotNone(refreshed)
        with self.assertRaises(ValueError):
            category_store.replace_catalog(self.db, [records[0], records[0]])
        self.assertEqual(category_store.load_catalog(self.db)[0], catalog)
        category_store.replace_catalog(self.db, [])
        empty, refreshed = category_store.load_catalog(self.db)
        self.assertEqual(empty, {})
        self.assertIsNotNone(refreshed)

    def test_application_role_can_manage_preferences_without_user_update_privileges(self):
        with self.db.transaction():
            self.db.execute("SET LOCAL ROLE balsave_app")
            self.assertFalse(self.db.execute(
                "SELECT has_table_privilege(current_user, 'balsave.users', 'UPDATE')",
            ).fetchone()[0])
            categories = category_store.ensure_default_categories(self.db, self.owner)
            self.assertEqual(len(categories), len(DEFAULT_CATEGORIES))
            category = category_store.create_category(self.db, self.owner, "Permissões mínimas")
            category_store.set_assignment(self.db, self.owner, self.entry_id, UUID(category["id"]))
            self.assertEqual(category_store.assignments(self.db, self.owner)[self.entry_id], category["id"])
            category_store.replace_catalog(self.db, [])
            self.assertIsNotNone(category_store.load_catalog(self.db)[1])

    def test_preference_survives_a_new_database_connection(self):
        # Roll back the committed test fixture explicitly after proving persistence.
        self.addCleanup(self.delete_committed_fixture)
        category = category_store.create_category(self.db, self.owner, "Persistência")
        category_store.set_assignment(self.db, self.owner, self.entry_id, UUID(category["id"]))
        self.db.commit()
        with psycopg.connect(DATABASE_URL) as other_connection:
            self.assertEqual(category_store.assignments(other_connection, self.owner), {self.entry_id: category["id"]})

    def delete_committed_fixture(self):
        self.db.rollback()
        with self.db.transaction():
            self.db.execute("DELETE FROM balsave.transaction_category_assignments WHERE user_id IN (%s, %s)", (self.owner, self.other))
            self.db.execute("DELETE FROM balsave.categories WHERE user_id IN (%s, %s)", (self.owner, self.other))
            self.db.execute("DELETE FROM balsave.users WHERE id IN (%s, %s)", (self.owner, self.other))
