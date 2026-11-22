import os
from datetime import date
from unittest import TestCase, skipUnless
from uuid import UUID, uuid4

import psycopg
from psycopg.errors import CheckViolation, ForeignKeyViolation

from app import category_rule_store, category_store
from app.category_rules import normalize_draft
from app.category_store import CategoryNotFound


DATABASE_URL = os.getenv("BALSAVE_TEST_DATABASE_URL")


@skipUnless(DATABASE_URL, "Set BALSAVE_TEST_DATABASE_URL to a migrated test database.")
class CategoryRuleStoreTests(TestCase):
    def setUp(self):
        self.db = psycopg.connect(DATABASE_URL)
        self.addCleanup(self.db.close)
        self.owner = self.db.execute("INSERT INTO balsave.users DEFAULT VALUES RETURNING id").fetchone()[0]
        self.other = self.db.execute("INSERT INTO balsave.users DEFAULT VALUES RETURNING id").fetchone()[0]
        self.category = category_store.create_category(self.db, self.owner, "Escritório")
        self.draft = {"categoryId": self.category["id"], "description": "Loja", "matchType": "contains",
                      "accountId": str(uuid4()), "priority": 25, "applyToHistory": False}

    def save(self, **fields):
        candidate = normalize_draft({**self.draft, **fields}, category_rule_store.list_rules(self.db, self.owner), date(2026, 11, 20))
        return category_rule_store.save_rule(self.db, self.owner, candidate)

    def test_create_and_edit_preserve_identity_creation_time_and_date_scope(self):
        saved = self.save()
        self.assertEqual(saved["startsOn"], "2026-11-20")
        self.assertEqual(saved["accountId"], self.draft["accountId"])
        self.assertNotEqual(saved["id"], "__draft__")
        edited = self.save(ruleId=saved["id"], priority=10, applyToHistory=True)
        self.assertEqual((edited["id"], edited["createdAt"]), (saved["id"], saved["createdAt"]))
        self.assertEqual(edited["priority"], 10)
        self.assertIsNone(edited["startsOn"])
        self.assertEqual(category_rule_store.list_rules(self.db, self.other), [])

    def test_cross_owner_changes_and_target_categories_are_rejected(self):
        saved = self.save()
        identifier = UUID(saved["id"])
        for operation in (category_rule_store.disable_rule, category_rule_store.delete_rule):
            with self.subTest(operation=operation), self.assertRaises(CategoryNotFound):
                operation(self.db, self.other, identifier)
        candidate = normalize_draft(self.draft, [], date(2026, 11, 20))
        with self.assertRaises(CategoryNotFound):
            category_rule_store.save_rule(self.db, self.other, candidate)
        with self.assertRaises(CategoryNotFound):
            category_rule_store.save_rule(self.db, self.other, {**candidate, "id": saved["id"]})
        with self.assertRaises(ForeignKeyViolation), self.db.transaction():
            self.db.execute(
                """INSERT INTO balsave.category_rules (user_id, category_id, description, match_type)
                VALUES (%s, %s, 'Loja', 'exact')""", (self.other, self.category["id"]),
            )

    def test_archived_target_rejects_new_rules_but_existing_rule_can_be_disabled_and_removed(self):
        saved = self.save()
        category_store.update_category(self.db, self.owner, UUID(self.category["id"]), archived=True)
        with self.assertRaises(CategoryNotFound):
            self.save()
        with self.assertRaises(CategoryNotFound):
            self.save(ruleId=saved["id"])
        disabled = category_rule_store.disable_rule(self.db, self.owner, UUID(saved["id"]))
        self.assertFalse(disabled["enabled"])
        category_rule_store.delete_rule(self.db, self.owner, UUID(saved["id"]))
        self.assertEqual(category_rule_store.list_rules(self.db, self.owner), [])

    def test_disabled_rule_requires_a_validated_save_to_be_enabled_again(self):
        saved = self.save()
        category_rule_store.disable_rule(self.db, self.owner, UUID(saved["id"]))
        restored = self.save(ruleId=saved["id"], enabled=True)
        self.assertTrue(restored["enabled"])
        self.assertEqual(restored["createdAt"], saved["createdAt"])

    def test_database_bounds_and_application_role_privileges(self):
        with self.db.transaction():
            self.db.execute("SET LOCAL ROLE balsave_app")
            saved = self.save()
            self.assertEqual(saved["description"], "Loja")
            for column, value in (("priority", 0), ("match_type", "regex"), ("description", "")):
                with self.subTest(column=column), self.assertRaises(CheckViolation), self.db.transaction():
                    self.db.execute(f"UPDATE balsave.category_rules SET {column} = %s WHERE id = %s", (value, saved["id"]))

    def test_saved_rule_survives_a_new_connection(self):
        self.addCleanup(self.delete_committed_fixture)
        saved = self.save()
        self.db.commit()
        with psycopg.connect(DATABASE_URL) as second:
            self.assertEqual(category_rule_store.list_rules(second, self.owner), [saved])

    def delete_committed_fixture(self):
        self.db.rollback()
        with self.db.transaction():
            self.db.execute("DELETE FROM balsave.category_rules WHERE user_id IN (%s, %s)", (self.owner, self.other))
            self.db.execute("DELETE FROM balsave.categories WHERE user_id IN (%s, %s)", (self.owner, self.other))
            self.db.execute("DELETE FROM balsave.users WHERE id IN (%s, %s)", (self.owner, self.other))
