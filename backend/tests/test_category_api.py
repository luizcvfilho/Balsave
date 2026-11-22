"""Exercise real authenticated ASGI routes against an isolated PostgreSQL database."""

import asyncio
import json
import os
from copy import deepcopy
from datetime import date
from hashlib import sha256
from hmac import digest
from unittest import TestCase, skipUnless
from unittest.mock import patch
from uuid import UUID, uuid4

import psycopg

from app import category_rule_api, database, pluggy_preview as preview
from app.main import app

DATABASE_URL = os.getenv("BALSAVE_TEST_DATABASE_URL")
PASSWORD = "balsave-category-api-tests-only-password"
AUTH = "Bearer " + digest(PASSWORD.encode(), b"balsave/preview/backend", sha256).hex()
ACCOUNT = str(UUID(int=801))
ENTRY = f"{ACCOUNT}.{UUID(int=802)}"
TRANSFER = f"{ACCOUNT}.{UUID(int=803)}"


def request(method, path, payload=None, authorization=AUTH):
    body = json.dumps(payload).encode() if payload is not None else b""
    messages = []

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    async def send(message):
        messages.append(message)

    scope = {
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": method,
        "scheme": "http", "path": f"/_internal/pluggy/{path}", "raw_path": f"/_internal/pluggy/{path}".encode(),
        "query_string": b"", "root_path": "", "server": ("test", 80), "client": ("test", 1),
        "headers": [(b"content-type", b"application/json"), (b"authorization", authorization.encode())],
    }
    asyncio.run(app(scope, receive, send))
    status = next(message["status"] for message in messages if message["type"] == "http.response.start")
    content = b"".join(message.get("body", b"") for message in messages if message["type"] == "http.response.body")
    return status, json.loads(content)


@skipUnless(DATABASE_URL, "Set BALSAVE_TEST_DATABASE_URL to a migrated isolated database.")
class CategoryApiTests(TestCase):
    def setUp(self):
        with psycopg.connect(DATABASE_URL) as connection:
            self.owner = connection.execute("INSERT INTO balsave.users DEFAULT VALUES RETURNING id").fetchone()[0]
            self.other = connection.execute("INSERT INTO balsave.users DEFAULT VALUES RETURNING id").fetchone()[0]
            self.foreign_category = str(connection.execute(
                "INSERT INTO balsave.categories(user_id,name) VALUES (%s,'Foreign category') RETURNING id", (self.other,),
            ).fetchone()[0])
        self.addCleanup(self.clean_owner)
        preview.cached_snapshot = None
        self.addCleanup(setattr, preview, "cached_snapshot", None)
        self.items = (uuid4(),)
        patches = [
            patch.dict(os.environ, {"BALSAVE_PREVIEW_PASSWORD": PASSWORD}),
            patch.object(database, "connect", side_effect=self.app_connection),
            patch.object(preview, "owner_and_items", return_value=(self.owner, self.items)),
            patch.object(preview, "api_key", return_value="test"),
            patch.object(preview.category_catalog, "load_catalog", return_value=({}, False)),
            patch.object(preview, "load_snapshot", side_effect=lambda *args, **kwargs: self.facts()),
        ]
        for mocked in patches:
            mocked.start()
            self.addCleanup(mocked.stop)

    def app_connection(self):
        connection = psycopg.connect(DATABASE_URL)
        connection.execute("SET ROLE balsave_app")
        return connection

    def clean_owner(self):
        with psycopg.connect(DATABASE_URL) as connection:
            for owner in (self.owner, self.other):
                connection.execute("DELETE FROM balsave.category_rules WHERE user_id=%s", (owner,))
                connection.execute("DELETE FROM balsave.transaction_category_assignments WHERE user_id=%s", (owner,))
                connection.execute("DELETE FROM balsave.categories WHERE user_id=%s", (owner,))
                connection.execute("DELETE FROM balsave.users WHERE id=%s", (owner,))

    def facts(self):
        return deepcopy({
            "asOf": "2026-11-20", "accounts": [{"id": ACCOUNT, "bank": "Test", "name": "Test account", "balanceCents": 10000}],
            "cards": [], "investments": [], "transactions": [
                {"id": ENTRY, "accountId": ACCOUNT, "date": "2026-11-15", "kind": "expense", "name": "Equipment", "amountCents": 1001,
                 "category": "Compras", "categoryKey": "shopping", "categorySource": "pluggy", "categoryNeedsReview": False,
                 "providerCategoryId": "test", "providerCategoryName": "Electronics", "providerCategoryLabel": "Eletrônicos"},
                {"id": TRANSFER, "accountId": ACCOUNT, "date": "2026-11-15", "kind": "transfer", "name": "Transfer", "amountCents": 100},
            ], "balanceSnapshots": [], "connectionCount": 1, "failedConnections": 0, "failedInvestments": 0,
        })

    def create(self, name="Escritório"):
        status, result = request("POST", "category-create", {"name": name})
        self.assertEqual(status, 200, result)
        return result["category"]

    def test_every_preference_route_requires_authentication(self):
        for method, path, payload in (
            ("GET", "categories", None), ("POST", "category-create", {"name": "Test"}),
            ("POST", "category-update", {"categoryId": str(uuid4()), "archived": True}),
            ("POST", "transaction-category", {"entryId": ENTRY, "categoryId": None}),
            ("POST", "category-rule-preview", {"categoryId": str(uuid4()), "description": "Test"}),
            ("POST", "category-rule-save", {"categoryId": str(uuid4()), "description": "Test", "previewFingerprint": "0" * 64}),
            ("POST", "category-rule-update", {"ruleId": str(uuid4()), "enabled": False}),
        ):
            with self.subTest(path=path):
                self.assertEqual(request(method, path, payload, authorization="")[0], 401)

    def test_category_settings_work_without_a_provider_or_connections(self):
        with patch.object(preview, "owner_and_items", return_value=(self.owner, ())):
            status, result = request("GET", "categories")
            self.assertEqual(status, 200)
            self.assertTrue(result["categories"])
            self.assertEqual(result["categoryAccounts"], [])
            self.assertEqual(self.create()["name"], "Escritório")

    def test_manual_choice_survives_refresh_and_restart_and_restore_uses_provider(self):
        created = self.create()
        status, result = request("POST", "transaction-category", {"entryId": ENTRY, "categoryId": created["id"]})
        self.assertEqual(status, 200, result)
        for restart in (False, True):
            if restart:
                preview.cached_snapshot = None
            status, result = request("GET", "snapshot")
            self.assertEqual(status, 200)
            entry = result["data"]["transactions"][0]
            self.assertEqual((entry["category"], entry["categorySource"]), ("Escritório", "manual"))
            self.assertEqual(entry["amountCents"], 1001)
            self.assertNotIn("_automaticCategory", entry)
        self.assertEqual(request("POST", "transaction-category", {"entryId": ENTRY, "categoryId": None})[0], 200)
        _, result = request("GET", "snapshot")
        self.assertEqual(result["data"]["transactions"][0]["categorySource"], "pluggy")

    def test_archive_preserves_choice_but_rejects_new_assignment_and_rename_updates_cache(self):
        category = self.create()
        request("POST", "transaction-category", {"entryId": ENTRY, "categoryId": category["id"]})
        self.assertEqual(request("POST", "category-update", {"categoryId": category["id"], "name": "Trabalho"})[0], 200)
        self.assertEqual(request("GET", "snapshot")[1]["data"]["transactions"][0]["category"], "Trabalho")
        self.assertEqual(request("POST", "category-update", {"categoryId": category["id"], "archived": True})[0], 200)
        self.assertEqual(request("GET", "snapshot")[1]["data"]["transactions"][0]["category"], "Trabalho")
        self.assertEqual(request("POST", "transaction-category", {"entryId": ENTRY, "categoryId": category["id"]})[0], 404)

    def test_cross_owner_categories_entries_and_non_expenses_are_rejected(self):
        self.assertEqual(request("POST", "category-update", {"categoryId": self.foreign_category, "archived": True})[0], 404)
        self.assertEqual(request("POST", "transaction-category", {"entryId": ENTRY, "categoryId": self.foreign_category})[0], 404)
        self.assertEqual(request("POST", "transaction-category", {"entryId": f"{uuid4()}.{uuid4()}", "categoryId": None})[0], 404)
        self.assertEqual(request("POST", "transaction-category", {"entryId": TRANSFER, "categoryId": None})[0], 409)

    def test_external_input_validation_and_duplicate_names(self):
        self.create()
        self.assertEqual(request("POST", "category-create", {"name": " escritório "})[0], 409)
        for payload in ({"name": "  "}, {"name": "Test\nname"}, {"name": "A" * 81}, {"name": "Test", "userId": str(self.other)}):
            self.assertEqual(request("POST", "category-create", payload)[0], 422)
        self.assertEqual(request("POST", "category-update", {"categoryId": self.foreign_category, "name": None})[0], 422)

    def rule_draft(self, **changes):
        return {"categoryId": self.create()["id"], "description": "Equipment", "matchType": "exact", "accountId": None,
                "priority": 100, "applyToHistory": True, **changes}

    def save_rule(self, draft):
        status, result = request("POST", "category-rule-preview", draft)
        self.assertEqual(status, 200, result)
        status, saved = request("POST", "category-rule-save", {**draft, "previewFingerprint": result["preview"]["fingerprint"]})
        self.assertEqual(status, 200, saved)
        return saved["rule"]

    def test_rule_preview_save_manual_priority_disable_and_restore(self):
        draft = self.rule_draft()
        status, result = request("POST", "category-rule-preview", draft)
        self.assertEqual(status, 200, result)
        self.assertEqual(result["preview"]["affectedCount"], 1)
        self.assertEqual(result["preview"]["manualCount"], 0)
        rule = self.save_rule(draft)
        _, result = request("GET", "snapshot")
        expense = result["data"]["transactions"][0]
        self.assertEqual((expense["category"], expense["categorySource"], expense["categoryRuleId"]), ("Escritório", "rule", rule["id"]))
        self.assertEqual(expense["amountCents"], 1001)
        self.assertEqual(result["data"]["transactions"][1]["kind"], "transfer")
        _, categories = request("GET", "categories")
        food = next(row for row in categories["categories"] if row["code"] == "food")
        self.assertEqual(request("POST", "transaction-category", {"entryId": ENTRY, "categoryId": food["id"]})[0], 200)
        _, result = request("POST", "category-rule-preview", draft)
        self.assertEqual((result["preview"]["affectedCount"], result["preview"]["manualCount"]), (0, 1))
        self.assertEqual(request("POST", "category-rule-update", {"ruleId": rule["id"], "enabled": False})[0], 200)
        _, result = request("GET", "snapshot")
        self.assertEqual(result["data"]["transactions"][0]["categorySource"], "manual")
        request("POST", "transaction-category", {"entryId": ENTRY, "categoryId": None})
        _, result = request("GET", "snapshot")
        self.assertEqual(result["data"]["transactions"][0]["categorySource"], "pluggy")
        self.assertNotIn("categoryRuleId", result["data"]["transactions"][0])

    def test_rule_save_requires_a_current_preview_and_reenable_requires_preview(self):
        draft = self.rule_draft()
        _, result = request("POST", "category-rule-preview", draft)
        self.create("Casa")
        self.assertEqual(request("POST", "category-rule-save", {**draft, "previewFingerprint": result["preview"]["fingerprint"]})[0], 409)
        self.assertEqual(request("POST", "category-rule-save", draft)[0], 422)
        rule = self.save_rule(draft)
        self.assertEqual(request("POST", "category-rule-update", {"ruleId": rule["id"], "enabled": True})[0], 422)
        request("POST", "category-rule-update", {"ruleId": rule["id"], "enabled": False})
        changed = self.save_rule({**draft, "ruleId": rule["id"], "enabled": True})
        self.assertEqual(changed["id"], rule["id"])
        self.assertTrue(changed["enabled"])
        self.assertEqual(request("POST", "category-rule-update", {"ruleId": rule["id"], "remove": True})[0], 200)
        self.assertEqual(request("GET", "categories")[1]["categoryRules"], [])

    def test_rule_date_scope_account_ownership_and_partial_data(self):
        draft = self.rule_draft(applyToHistory=False)
        with patch.object(category_rule_api, "_today", return_value=date(2026, 11, 20)):
            status, result = request("POST", "category-rule-preview", draft)
            self.assertEqual(status, 200, result)
            self.assertEqual(result["preview"]["affectedCount"], 0)
            self.assertEqual(request("POST", "category-rule-preview", {**draft, "applyToHistory": True})[1]["preview"]["affectedCount"], 1)
        self.assertEqual(request("POST", "category-rule-preview", {**draft, "accountId": str(uuid4())})[0], 404)
        self.assertEqual(request("POST", "category-rule-preview", {**draft, "categoryId": self.foreign_category})[0], 404)
        self.assertEqual(request("POST", "category-rule-update", {"ruleId": str(uuid4()), "remove": True})[0], 404)
        preview.cached_snapshot = None
        partial = self.facts()
        partial["failedConnections"] = 1
        with patch.object(preview, "load_snapshot", return_value=partial):
            self.assertEqual(request("POST", "category-rule-preview", draft)[0], 503)

    def test_rule_external_input_is_validated(self):
        draft = self.rule_draft()
        for changes in ({"description": " "}, {"description": "A\nB"}, {"matchType": "regex"}, {"priority": 0},
                        {"priority": True}, {"applyToHistory": "true"}, {"userId": str(self.other)}):
            self.assertEqual(request("POST", "category-rule-preview", {**draft, **changes})[0], 422)
