"""Exercise real authenticated ASGI routes against an isolated PostgreSQL database."""

import asyncio
import json
import os
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import date
from threading import Event
from unittest import TestCase, skipUnless
from unittest.mock import patch
from uuid import UUID, uuid4

import psycopg

from app import category_rule_api, database, pluggy, pluggy_preview as preview
from app.link_login_email import link_email
from app.main import app

DATABASE_URL = os.getenv("BALSAVE_TEST_DATABASE_URL")
INTERNAL_SECRET = "balsave-internal-category-tests-only-secret"
ACCOUNT = str(UUID(int=801))
ENTRY = f"{ACCOUNT}.{UUID(int=802)}"
TRANSFER = f"{ACCOUNT}.{UUID(int=803)}"


def asgi_request(method, path, payload=None, *, authorization="", secret=INTERNAL_SECRET, ip="192.0.2.1"):
    body = json.dumps(payload).encode() if payload is not None else b""
    messages = []

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    async def send(message):
        messages.append(message)

    scope = {
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": method,
        "scheme": "http", "path": f"/_internal/{path}", "raw_path": f"/_internal/{path}".encode(),
        "query_string": b"", "root_path": "", "server": ("test", 80), "client": ("test", 1),
        "headers": [(b"content-type", b"application/json"), (b"authorization", authorization.encode()),
                    (b"x-balsave-internal", secret.encode()), (b"x-balsave-client-ip", ip.encode())],
    }
    asyncio.run(app(scope, receive, send))
    status = next(message["status"] for message in messages if message["type"] == "http.response.start")
    content = b"".join(message.get("body", b"") for message in messages if message["type"] == "http.response.body")
    return status, json.loads(content) if content else None


@skipUnless(DATABASE_URL, "Set BALSAVE_TEST_DATABASE_URL to a migrated isolated database.")
class CategoryApiTests(TestCase):
    def setUp(self):
        self.users = []
        self.addCleanup(self.clean_users)
        preview.snapshot_cache.clear()
        self.addCleanup(preview.snapshot_cache.clear)
        self.items = (uuid4(),)
        self.other_items = (uuid4(),)
        self.ip = f"2001:db8:{uuid4().hex[:4]}:{uuid4().hex[:4]}::1"
        patches = [
            patch.dict(os.environ, {"BALSAVE_AUTH_SECRET": INTERNAL_SECRET}),
            patch.object(database, "connect", side_effect=self.app_connection),
            patch.object(preview, "api_key", return_value="test"),
            patch.object(preview.category_catalog, "load_catalog", return_value=({}, False)),
            patch.object(preview, "load_snapshot", side_effect=lambda items, *args, **kwargs: self.facts(items)),
        ]
        for mocked in patches:
            mocked.start()
            self.addCleanup(mocked.stop)

        self.owner_email, self.owner, self.token = self.create_identity()
        _, self.other, self.other_token = self.create_identity()
        self.foreign_category = self.create("Foreign category", token=self.other_token)["id"]
        with psycopg.connect(DATABASE_URL) as connection:
            for owner, items in ((self.owner, self.items), (self.other, self.other_items)):
                connection.execute("INSERT INTO balsave.pluggy_connections (item_id, user_id) VALUES (%s, %s)", (items[0], owner))

    def create_identity(self):
        email = f"{uuid4().hex}@api-tests.example.test"
        with psycopg.connect(DATABASE_URL) as connection:
            identity, owner = connection.execute(
                'INSERT INTO balsave_identity."user" (name, email) VALUES (%s, %s) RETURNING id, owner_id',
                ("API test owner", email),
            ).fetchone()
        self.users.append(owner)
        return email, owner, self.new_session(owner)

    def new_session(self, owner):
        with psycopg.connect(DATABASE_URL) as connection:
            return connection.execute(
                """
                INSERT INTO balsave_identity.session ("userId", token, "expiresAt")
                SELECT id, %s, now() + interval '8 hours'
                FROM balsave_identity."user" WHERE owner_id = %s
                RETURNING id
                """,
                (uuid4().hex, owner),
            ).fetchone()[0]

    def request(self, method, path, payload=None, *, token=None, secret=INTERNAL_SECRET):
        token = self.token if token is None else token
        return asgi_request(method, f"pluggy/{path}", payload, authorization=f"Bearer {token}" if token else "",
                            secret=secret, ip=self.ip)

    def app_connection(self):
        connection = psycopg.connect(DATABASE_URL)
        connection.execute("SET ROLE balsave_app")
        return connection

    def clean_users(self):
        with psycopg.connect(DATABASE_URL) as connection:
            for owner in self.users:
                connection.execute('DELETE FROM balsave_identity."user" WHERE owner_id = %s', (owner,))
                connection.execute("DELETE FROM balsave.pluggy_connections WHERE user_id=%s", (owner,))
                connection.execute("DELETE FROM balsave.reconciliation_decisions WHERE user_id=%s", (owner,))
                connection.execute("DELETE FROM balsave.investment_account_links WHERE user_id=%s", (owner,))
                connection.execute("DELETE FROM balsave.category_rules WHERE user_id=%s", (owner,))
                connection.execute("DELETE FROM balsave.transaction_category_assignments WHERE user_id=%s", (owner,))
                connection.execute("DELETE FROM balsave.transaction_tags WHERE user_id=%s", (owner,))
                connection.execute("DELETE FROM balsave.tags WHERE user_id=%s", (owner,))
                connection.execute("DELETE FROM balsave.categories WHERE user_id=%s", (owner,))
                connection.execute("DELETE FROM balsave.users WHERE id=%s", (owner,))

    def facts(self, items=None):
        if items == self.other_items:
            account = str(UUID(int=901))
            return {
                "asOf": "2026-11-20", "accounts": [{"id": account, "bank": "Other bank", "name": "Other account", "balanceCents": 20000}],
                "cards": [], "investments": [{"id": str(UUID(int=904))}], "transactions": [],
                "balanceSnapshots": [], "connectionCount": 1, "failedConnections": 0, "failedInvestments": 0,
                "reconciliationCandidates": [],
            }
        return deepcopy({
            "asOf": "2026-11-20", "accounts": [{"id": ACCOUNT, "bank": "Test", "name": "Test account", "balanceCents": 10000}],
            "cards": [], "investments": [], "transactions": [
                {"id": ENTRY, "accountId": ACCOUNT, "date": "2026-11-15", "kind": "expense", "name": "Equipment", "amountCents": 1001,
                 "category": "Compras", "categoryKey": "shopping", "categorySource": "pluggy", "categoryNeedsReview": False,
                 "providerCategoryId": "test", "providerCategoryName": "Electronics", "providerCategoryLabel": "Eletrônicos"},
                {"id": TRANSFER, "accountId": ACCOUNT, "date": "2026-11-15", "kind": "transfer", "name": "Transfer", "amountCents": 100},
            ], "balanceSnapshots": [], "connectionCount": 1, "failedConnections": 0, "failedInvestments": 0,
            "reconciliationCandidates": [],
        })

    def create(self, name="Escritório", *, token=None):
        status, result = self.request("POST", "category-create", {"name": name}, token=token)
        self.assertEqual(status, 200, result)
        return result["category"]

    def test_every_preference_route_requires_authentication(self):
        for method, path, payload in (
            ("GET", "snapshot", None), ("POST", "token", None),
            ("POST", "connections", {"itemId": str(uuid4())}),
            ("POST", "reconciliation", {"entryId": ENTRY, "remove": True}),
            ("POST", "position-links", {"investmentId": str(uuid4())}),
            ("GET", "categories", None), ("POST", "category-create", {"name": "Test"}),
            ("POST", "category-update", {"categoryId": str(uuid4()), "archived": True}),
            ("POST", "transaction-category", {"entryId": ENTRY, "categoryId": None}),
            ("POST", "category-rule-preview", {"categoryId": str(uuid4()), "description": "Test"}),
            ("POST", "category-rule-save", {"categoryId": str(uuid4()), "description": "Test", "previewFingerprint": "0" * 64}),
            ("POST", "category-rule-update", {"ruleId": str(uuid4()), "enabled": False}),
        ):
            with self.subTest(path=path):
                self.assertEqual(self.request(method, path, payload, token="")[0], 401)
                self.assertEqual(self.request(method, path, payload, secret="")[0], 403)

    def test_revoked_and_expired_sessions_cannot_access_financial_data(self):
        expiring = self.new_session(self.owner)
        self.assertEqual(self.request("GET", "categories", token=expiring)[0], 200)
        with psycopg.connect(DATABASE_URL) as connection:
            connection.execute(
                """UPDATE balsave_identity.session SET "expiresAt" = now() - interval '1 second' WHERE id = %s""",
                (expiring,),
            )
            connection.execute("DELETE FROM balsave_identity.session WHERE id = %s", (self.token,))
        self.assertEqual(self.request("GET", "categories", token=expiring)[0], 401)
        self.assertEqual(self.request("GET", "categories")[0], 401)
        self.assertEqual(self.request("GET", "categories", token=self.other_token)[0], 200)

    def test_authentication_rate_limit_is_shared_across_source_addresses(self):
        attempt = {"mode": "login", "email": self.owner_email}
        self.assertEqual(asgi_request("POST", "auth/attempt", attempt, secret="")[0], 403)
        self.assertEqual(asgi_request("POST", "auth/attempt", {**attempt, "password": "Unexpected"})[0], 422)
        for counter in range(10):
            email = self.owner_email.upper() if counter % 2 else self.owner_email
            self.assertEqual(asgi_request("POST", "auth/attempt", {**attempt, "email": email}, ip=f"192.0.2.{counter + 1}")[0], 204)
        self.assertEqual(asgi_request("POST", "auth/attempt", attempt, ip="192.0.2.200")[0], 429)

    def test_legacy_email_link_preserves_existing_records_and_requires_admin(self):
        username = f"legacy-{uuid4().hex[:20]}"
        email = f"{username}@api-tests.example.test"
        password_hash = "legacy-test-hash"
        with self.app_connection() as connection:
            with self.assertRaises(psycopg.errors.InsufficientPrivilege), connection.transaction():
                link_email(connection, email, username=username)
            for query in (
                'SELECT email FROM balsave_identity."user"',
                'SELECT token FROM balsave_identity.session',
                'SELECT password FROM balsave_identity.account',
            ):
                with self.assertRaises(psycopg.errors.InsufficientPrivilege), connection.transaction():
                    connection.execute(query)

        with psycopg.connect(DATABASE_URL) as connection, connection.transaction(force_rollback=True):
            legacy_owner = connection.execute("SELECT user_id FROM balsave.preview_owner").fetchone()[0]
            item = uuid4()
            connection.execute("INSERT INTO balsave.pluggy_connections (item_id, user_id) VALUES (%s, %s)", (item, legacy_owner))
            connection.execute(
                "INSERT INTO balsave.auth_credentials (user_id, username, password_hash) VALUES (%s, %s, %s)",
                (legacy_owner, username, password_hash),
            )
            with self.assertRaises(psycopg.errors.UniqueViolation), connection.transaction():
                link_email(connection, self.owner_email, username=username)
            self.assertEqual(link_email(connection, email, username=username), legacy_owner)
            self.assertIsNone(link_email(connection, f"other-{email}", username=username))
            self.assertEqual(connection.execute(
                """
                SELECT account.password
                FROM balsave_identity.account AS account
                JOIN balsave_identity."user" AS identity ON account."userId" = identity.id
                JOIN balsave.pluggy_connections AS pluggy ON pluggy.user_id = identity.owner_id
                WHERE pluggy.item_id = %s AND identity.email = %s
                """,
                (item, email),
            ).fetchone(), (password_hash,))

    def test_cache_and_financial_requests_are_isolated_between_signed_in_users(self):
        own = self.request("GET", "snapshot")[1]["data"]
        other = self.request("GET", "snapshot", token=self.other_token)[1]["data"]
        self.assertEqual(own["accounts"][0]["id"], ACCOUNT)
        self.assertNotEqual(other["accounts"][0]["id"], ACCOUNT)
        self.assertTrue(other["investments"])
        self.assertEqual(other["transactions"], [])
        for token, data in ((self.token, own), (self.other_token, other)):
            _, categories = self.request("GET", "categories", token=token)
            self.assertEqual([option["id"] for option in categories["categoryAccounts"]], [data["accounts"][0]["id"]])
            self.assertEqual(self.foreign_category in [category["id"] for category in categories["categories"]], token == self.other_token)
        self.assertEqual(self.request("POST", "transaction-category", {"entryId": ENTRY, "categoryId": None}, token=self.other_token)[0], 404)
        self.assertEqual(self.request("POST", "position-links", {"investmentId": other["investments"][0]["id"], "accountId": ACCOUNT})[0], 403)

        own_category = self.create()["id"]
        own_rule = self.save_rule({"categoryId": own_category, "description": "Equipment"})
        self.assertEqual(self.request("POST", "category-rule-update", {"ruleId": own_rule["id"], "remove": True}, token=self.other_token)[0], 404)
        self.assertEqual(self.request("GET", "categories")[1]["categoryRules"][0]["id"], own_rule["id"])

        with psycopg.connect(DATABASE_URL) as connection:
            connection.execute(
                "INSERT INTO balsave.reconciliation_decisions (user_id, entry_id, fingerprint) VALUES (%s, %s, %s)",
                (self.owner, ENTRY, "0" * 64),
            )
        self.assertEqual(self.request("POST", "reconciliation", {"entryId": ENTRY, "remove": True}, token=self.other_token)[0], 200)
        with psycopg.connect(DATABASE_URL) as connection:
            self.assertTrue(connection.execute("SELECT 1 FROM balsave.reconciliation_decisions WHERE user_id = %s AND entry_id = %s", (self.owner, ENTRY)).fetchone())

    def test_pluggy_token_and_connection_registration_use_session_owner(self):
        with patch.object(pluggy, "request", return_value={"accessToken": "widget-token"}) as provider:
            status, result = self.request("POST", "token", token=self.other_token)
            self.assertEqual(status, 200, result)
            provider.assert_called_once_with("/connect_token", api_key="test", body={"options": {"clientUserId": str(self.other)}})
        with patch.object(pluggy, "request", return_value={"clientUserId": str(self.other)}):
            foreign = self.request("POST", "connections", {"itemId": str(self.other_items[0])})
        with patch.object(pluggy, "request", side_effect=pluggy.PluggyAPIError("/items/{id}", 404, {})):
            missing = self.request("POST", "connections", {"itemId": str(uuid4())})
        self.assertEqual(foreign, missing)
        self.assertEqual(foreign[0], 404)

    def test_connect_token_budget_is_shared_by_owner_sessions_and_isolated_between_owners(self):
        another_session = self.new_session(self.owner)
        with patch.object(pluggy, "request", return_value={"accessToken": "widget-token"}) as provider:
            for _ in range(preview.CONNECT_TOKENS_PER_WINDOW):
                self.assertEqual(self.request("POST", "token")[0], 200)
            self.assertEqual(self.request("POST", "token", token=another_session)[0], 429)
            self.assertEqual(provider.call_count, preview.CONNECT_TOKENS_PER_WINDOW)
            self.assertEqual(self.request("POST", "token", token=self.other_token)[0], 200)
            self.assertEqual(provider.call_count, preview.CONNECT_TOKENS_PER_WINDOW + 1)

    def test_slow_provider_does_not_block_another_owners_snapshot_or_categories(self):
        syncing = Event()
        finish_sync = Event()

        def load(items, *args, **kwargs):
            if items == self.items:
                syncing.set()
                if not finish_sync.wait(timeout=10):
                    raise AssertionError("Timed out waiting to resume the first owner's snapshot")
            return self.facts(items)

        with patch.object(preview, "load_snapshot", side_effect=load), ThreadPoolExecutor(max_workers=3) as workers:
            first = workers.submit(self.request, "GET", "snapshot")
            try:
                self.assertTrue(syncing.wait(timeout=5))
                second = workers.submit(self.request, "GET", "snapshot", token=self.other_token)
                category = workers.submit(self.create, "Other settings", token=self.other_token)
                self.assertEqual(second.result(timeout=4)[0], 200)
                self.assertEqual(category.result(timeout=4)["name"], "Other settings")
                self.assertFalse(first.done())
            finally:
                finish_sync.set()
            self.assertEqual(first.result(timeout=5)[0], 200)

    def test_category_settings_work_without_a_provider_or_connections(self):
        with patch.object(preview, "owner_items", return_value=()):
            status, result = self.request("GET", "categories")
            self.assertEqual(status, 200)
            self.assertTrue(result["categories"])
            self.assertEqual(result["categoryAccounts"], [])
            self.assertEqual(self.create()["name"], "Escritório")

    def test_manual_choice_survives_refresh_and_restart_and_restore_uses_provider(self):
        created = self.create()
        status, result = self.request("POST", "transaction-category", {"entryId": ENTRY, "categoryId": created["id"]})
        self.assertEqual(status, 200, result)
        for restart in (False, True):
            if restart:
                preview.snapshot_cache.clear()
            status, result = self.request("GET", "snapshot")
            self.assertEqual(status, 200)
            entry = result["data"]["transactions"][0]
            self.assertEqual((entry["category"], entry["categorySource"]), ("Escritório", "manual"))
            self.assertEqual(entry["amountCents"], 1001)
            self.assertNotIn("_automaticCategory", entry)
        self.assertEqual(self.request("POST", "transaction-category", {"entryId": ENTRY, "categoryId": None})[0], 200)
        _, result = self.request("GET", "snapshot")
        self.assertEqual(result["data"]["transactions"][0]["categorySource"], "pluggy")

    def test_archive_preserves_choice_but_rejects_new_assignment_and_rename_updates_cache(self):
        category = self.create()
        self.request("POST", "transaction-category", {"entryId": ENTRY, "categoryId": category["id"]})
        self.assertEqual(self.request("POST", "category-update", {"categoryId": category["id"], "name": "Trabalho"})[0], 200)
        self.assertEqual(self.request("GET", "snapshot")[1]["data"]["transactions"][0]["category"], "Trabalho")
        self.assertEqual(self.request("POST", "category-update", {"categoryId": category["id"], "archived": True})[0], 200)
        self.assertEqual(self.request("GET", "snapshot")[1]["data"]["transactions"][0]["category"], "Trabalho")
        self.assertEqual(self.request("POST", "transaction-category", {"entryId": ENTRY, "categoryId": category["id"]})[0], 404)

    def test_removing_a_category_suppresses_automatic_rules_until_restored(self):
        draft = self.rule_draft()
        rule = self.save_rule(draft)
        remove = {"entryId": ENTRY, "categoryId": None, "unclassified": True}
        self.assertEqual(self.request("POST", "transaction-category", {**remove, "categoryId": draft["categoryId"]})[0], 422)
        self.assertEqual(self.request("POST", "transaction-category", remove, token=self.other_token)[0], 404)
        self.assertEqual(self.request("POST", "transaction-category", remove)[0], 200)
        preview.snapshot_cache.clear()
        _, result = self.request("GET", "snapshot")
        entry = result["data"]["transactions"][0]
        self.assertEqual((entry["category"], entry["categoryId"], entry["categorySource"]), ("Sem categoria", None, "manual"))
        self.assertNotIn("categoryRuleId", entry)
        self.assertEqual(entry["amountCents"], 1001)
        _, result = self.request("POST", "category-rule-preview", draft)
        self.assertEqual((result["preview"]["affectedCount"], result["preview"]["manualCount"]), (0, 1))
        self.assertEqual(self.request("POST", "transaction-category", {"entryId": ENTRY, "categoryId": None})[0], 200)
        _, result = self.request("GET", "snapshot")
        self.assertEqual(result["data"]["transactions"][0]["categoryRuleId"], rule["id"])

    def test_deleting_custom_categories_restores_previous_choices_in_order(self):
        initial = self.request("GET", "snapshot")[1]["data"]["transactions"][0]["categoryId"]
        first, second = (self.create(name)["id"] for name in ("Primeira", "Segunda"))
        self.assertEqual(self.request("POST", "category-delete", {"categoryId": initial})[0], 409)
        self.assertEqual(self.request("POST", "category-delete", {"categoryId": self.foreign_category})[0], 404)
        for category in (first, second, second):
            self.assertEqual(self.request("POST", "transaction-category", {"entryId": ENTRY, "categoryId": category})[0], 200)
        for category, expected in ((second, first), (first, initial)):
            self.assertEqual(self.request("POST", "category-delete", {"categoryId": category})[0], 200)
            entry = self.request("GET", "snapshot")[1]["data"]["transactions"][0]
            self.assertEqual((entry["categoryId"], entry["amountCents"]), (expected, 1001))

    def test_deleting_a_category_with_missing_history_or_rule_marks_expense_unclassified(self):
        legacy = self.create("Legada")["id"]
        with psycopg.connect(DATABASE_URL) as connection:
            connection.execute(
                "INSERT INTO balsave.transaction_category_assignments (user_id, entry_id, category_id) VALUES (%s, %s, %s)",
                (self.owner, ENTRY, legacy),
            )
        self.assertEqual(self.request("POST", "category-delete", {"categoryId": legacy})[0], 200)
        entry = self.request("GET", "snapshot")[1]["data"]["transactions"][0]
        self.assertEqual((entry["category"], entry["categorySource"]), ("Sem categoria", "manual"))
        self.assertEqual(self.request("POST", "transaction-category", {"entryId": ENTRY, "categoryId": None})[0], 200)
        rule = self.save_rule(self.rule_draft())
        self.assertEqual(self.request("POST", "category-delete", {"categoryId": rule["categoryId"]})[0], 200)
        data = self.request("GET", "snapshot")[1]["data"]
        self.assertEqual(data["transactions"][0]["category"], "Sem categoria")
        self.assertEqual(data["categoryRules"], [])

    def test_cross_owner_categories_entries_and_non_expenses_are_rejected(self):
        self.assertEqual(self.request("POST", "category-update", {"categoryId": self.foreign_category, "archived": True})[0], 404)
        self.assertEqual(self.request("POST", "transaction-category", {"entryId": ENTRY, "categoryId": self.foreign_category})[0], 404)
        self.assertEqual(self.request("POST", "transaction-category", {"entryId": f"{uuid4()}.{uuid4()}", "categoryId": None})[0], 404)
        self.assertEqual(self.request("POST", "transaction-category", {"entryId": TRANSFER, "categoryId": None})[0], 409)

    def test_external_input_validation_and_duplicate_names(self):
        self.create()
        self.assertEqual(self.request("POST", "category-create", {"name": " escritório "})[0], 409)
        for payload in ({"name": "  "}, {"name": "Test\nname"}, {"name": "A" * 81}, {"name": "Test", "userId": str(self.other)}):
            self.assertEqual(self.request("POST", "category-create", payload)[0], 422)
        self.assertEqual(self.request("POST", "category-update", {"categoryId": self.foreign_category, "name": None})[0], 422)

    def test_tags_persist_multiple_assignments_across_refresh_and_are_owner_scoped(self):
        first = self.request("POST", "tag-create", {"name": "Trabalho"})[1]["tag"]
        second = self.request("POST", "tag-create", {"name": "Casa"})[1]["tag"]
        foreign = self.request("POST", "tag-create", {"name": "Outro"}, token=self.other_token)[1]["tag"]
        self.assertEqual(self.request("POST", "transaction-tags", {"entryId": ENTRY, "tagIds": [first["id"], second["id"]]})[0], 200)
        self.assertEqual(self.request("POST", "transaction-tags", {"entryId": TRANSFER, "tagIds": [first["id"]]})[0], 200)
        for _ in range(2):
            data = self.request("GET", "snapshot")[1]["data"]
            self.assertEqual(set(data["transactions"][0]["tagIds"]), {first["id"], second["id"]})
            self.assertEqual(data["transactions"][1]["tagIds"], [first["id"]])
            self.assertEqual({tag["id"] for tag in data["tags"]}, {first["id"], second["id"]})
            preview.snapshot_cache.clear()
        self.assertEqual(self.request("POST", "tag-update", {"tagId": first["id"], "name": "Projeto"})[0], 200)
        self.assertEqual(self.request("GET", "snapshot")[1]["data"]["tags"][1]["name"], "Projeto")
        self.assertEqual(self.request("POST", "tag-update", {"tagId": foreign["id"], "name": "Teste"})[0], 404)
        self.assertEqual(self.request("POST", "transaction-tags", {"entryId": ENTRY, "tagIds": [foreign["id"]]})[0], 404)
        self.assertEqual(self.request("POST", "transaction-tags", {"entryId": ENTRY, "tagIds": []}, token=self.other_token)[0], 404)
        self.assertEqual(self.request("POST", "transaction-tags", {"entryId": ENTRY, "tagIds": []})[0], 200)
        self.assertEqual(self.request("GET", "snapshot")[1]["data"]["transactions"][0]["tagIds"], [])

    def test_tag_validation_and_authentication(self):
        tag = self.request("POST", "tag-create", {"name": "Teste"})[1]["tag"]
        self.assertEqual(self.request("POST", "tag-create", {"name": " teste "})[0], 409)
        for payload in ({"name": " "}, {"name": "A\nB"}, {"name": "A" * 81}, {"name": "Teste", "userId": str(self.other)}):
            self.assertEqual(self.request("POST", "tag-create", payload)[0], 422)
        self.assertEqual(self.request("POST", "transaction-tags", {"entryId": ENTRY, "tagIds": [tag["id"], tag["id"]]})[0], 422)
        self.assertEqual(self.request("POST", "transaction-tags", {"entryId": f"{uuid4()}.{uuid4()}", "tagIds": []})[0], 404)
        for path, payload in (("tag-create", {"name": "A"}), ("tag-update", {"tagId": tag["id"], "name": "A"}), ("transaction-tags", {"entryId": ENTRY, "tagIds": []})):
            self.assertEqual(self.request("POST", path, payload, token="")[0], 401)
            self.assertEqual(self.request("POST", path, payload, secret="")[0], 403)

    def test_deleting_a_tag_cascades_only_the_owners_association(self):
        deleted = self.request("POST", "tag-create", {"name": "Excluir"})[1]["tag"]
        kept = self.request("POST", "tag-create", {"name": "Manter"})[1]["tag"]
        self.assertEqual(self.request("POST", "transaction-tags", {"entryId": ENTRY, "tagIds": [deleted["id"], kept["id"]]})[0], 200)
        payload = {"tagId": deleted["id"]}
        self.assertEqual(self.request("POST", "tag-delete", payload, token="")[0], 401)
        self.assertEqual(self.request("POST", "tag-delete", payload, token=self.other_token)[0], 404)
        self.assertEqual(self.request("POST", "tag-delete", payload)[0], 200)
        self.assertEqual(self.request("POST", "tag-delete", payload)[0], 404)
        self.assertEqual(self.request("GET", "tags")[1]["tags"], [kept])
        self.assertEqual(self.request("GET", "snapshot")[1]["data"]["transactions"][0]["tagIds"], [kept["id"]])

    def test_tag_catalog_counts_saved_links_and_single_updates_preserve_other_tags(self):
        home = self.request("POST", "tag-create", {"name": "Casa"})[1]["tag"]
        work = self.request("POST", "tag-create", {"name": "Trabalho"})[1]["tag"]
        foreign = self.request("POST", "tag-create", {"name": "Outro"}, token=self.other_token)[1]["tag"]
        for tag in (home, work, work):
            self.assertEqual(self.request("POST", "transaction-tags", {"entryId": ENTRY, "tagId": tag["id"], "assigned": True})[0], 200)
        self.assertEqual(self.request("POST", "transaction-tags", {"entryId": ENTRY, "tagId": foreign["id"], "assigned": False})[0], 404)
        self.assertEqual(self.request("POST", "transaction-tags", {"entryId": ENTRY, "tagId": home["id"], "assigned": False})[0], 200)
        self.assertEqual(self.request("GET", "snapshot")[1]["data"]["transactions"][0]["tagIds"], [work["id"]])
        with patch.object(preview, "owner_items", side_effect=AssertionError("The tag catalog must not load transactions")):
            self.assertEqual(self.request("GET", "tags"), (200, {"tags": [home, work], "usageByTag": {home["id"]: 0, work["id"]: 1}}))
            self.assertEqual(self.request("GET", "tags", token=self.other_token), (200, {"tags": [foreign], "usageByTag": {foreign["id"]: 0}}))
        self.assertEqual(self.request("GET", "tags", token="")[0], 401)

    def rule_draft(self, **changes):
        return {"categoryId": self.create()["id"], "description": "Equipment", "matchType": "exact", "accountId": None,
                "priority": 100, "applyToHistory": True, **changes}

    def save_rule(self, draft):
        status, result = self.request("POST", "category-rule-preview", draft)
        self.assertEqual(status, 200, result)
        status, saved = self.request("POST", "category-rule-save", {**draft, "previewFingerprint": result["preview"]["fingerprint"]})
        self.assertEqual(status, 200, saved)
        return saved["rule"]

    def test_rule_preview_save_manual_priority_disable_and_restore(self):
        draft = self.rule_draft()
        status, result = self.request("POST", "category-rule-preview", draft)
        self.assertEqual(status, 200, result)
        self.assertEqual(result["preview"]["affectedCount"], 1)
        self.assertEqual(result["preview"]["manualCount"], 0)
        rule = self.save_rule(draft)
        _, result = self.request("GET", "snapshot")
        expense = result["data"]["transactions"][0]
        self.assertEqual((expense["category"], expense["categorySource"], expense["categoryRuleId"]), ("Escritório", "rule", rule["id"]))
        self.assertEqual(expense["amountCents"], 1001)
        self.assertEqual(result["data"]["transactions"][1]["kind"], "transfer")
        _, categories = self.request("GET", "categories")
        food = next(row for row in categories["categories"] if row["code"] == "food")
        self.assertEqual(self.request("POST", "transaction-category", {"entryId": ENTRY, "categoryId": food["id"]})[0], 200)
        _, result = self.request("POST", "category-rule-preview", draft)
        self.assertEqual((result["preview"]["affectedCount"], result["preview"]["manualCount"]), (0, 1))
        self.assertEqual(self.request("POST", "category-rule-update", {"ruleId": rule["id"], "enabled": False})[0], 200)
        _, result = self.request("GET", "snapshot")
        self.assertEqual(result["data"]["transactions"][0]["categorySource"], "manual")
        self.request("POST", "transaction-category", {"entryId": ENTRY, "categoryId": None})
        _, result = self.request("GET", "snapshot")
        self.assertEqual(result["data"]["transactions"][0]["categorySource"], "pluggy")
        self.assertNotIn("categoryRuleId", result["data"]["transactions"][0])

    def test_rule_save_requires_a_current_preview_and_reenable_requires_preview(self):
        draft = self.rule_draft()
        _, result = self.request("POST", "category-rule-preview", draft)
        self.create("Casa")
        self.assertEqual(self.request("POST", "category-rule-save", {**draft, "previewFingerprint": result["preview"]["fingerprint"]})[0], 409)
        self.assertEqual(self.request("POST", "category-rule-save", draft)[0], 422)
        rule = self.save_rule(draft)
        self.assertEqual(self.request("POST", "category-rule-update", {"ruleId": rule["id"], "enabled": True})[0], 422)
        self.request("POST", "category-rule-update", {"ruleId": rule["id"], "enabled": False})
        changed = self.save_rule({**draft, "ruleId": rule["id"], "enabled": True})
        self.assertEqual(changed["id"], rule["id"])
        self.assertTrue(changed["enabled"])
        self.assertEqual(self.request("POST", "category-rule-update", {"ruleId": rule["id"], "remove": True})[0], 200)
        self.assertEqual(self.request("GET", "categories")[1]["categoryRules"], [])

    def test_rule_date_scope_account_ownership_and_partial_data(self):
        draft = self.rule_draft(applyToHistory=False)
        with patch.object(category_rule_api, "_today", return_value=date(2026, 11, 20)):
            status, result = self.request("POST", "category-rule-preview", draft)
            self.assertEqual(status, 200, result)
            self.assertEqual(result["preview"]["affectedCount"], 0)
            self.assertEqual(self.request("POST", "category-rule-preview", {**draft, "applyToHistory": True})[1]["preview"]["affectedCount"], 1)
        self.assertEqual(self.request("POST", "category-rule-preview", {**draft, "accountId": str(uuid4())})[0], 404)
        self.assertEqual(self.request("POST", "category-rule-preview", {**draft, "categoryId": self.foreign_category})[0], 404)
        self.assertEqual(self.request("POST", "category-rule-update", {"ruleId": str(uuid4()), "remove": True})[0], 404)
        preview.snapshot_cache.clear()
        partial = self.facts()
        partial["failedConnections"] = 1
        with patch.object(preview, "load_snapshot", return_value=partial):
            self.assertEqual(self.request("POST", "category-rule-preview", draft)[0], 503)

    def test_rule_external_input_is_validated(self):
        draft = self.rule_draft()
        for changes in ({"description": " "}, {"description": "A\nB"}, {"matchType": "regex"}, {"priority": 0},
                        {"priority": True}, {"applyToHistory": "true"}, {"userId": str(self.other)}):
            self.assertEqual(self.request("POST", "category-rule-preview", {**draft, **changes})[0], 422)
