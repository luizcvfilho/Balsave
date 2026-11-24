"""Check tag projection and request validation without a database."""

from unittest import TestCase
from uuid import UUID

from pydantic import ValidationError

from app.tag_api import TransactionTags
from app.tag_store import apply_tags


class Results:
    def __init__(self, rows):
        self.rows = rows

    def fetchall(self):
        return self.rows


class Connection:
    def __init__(self, rows):
        self.rows = iter(rows)

    def execute(self, *_args):
        return Results(next(self.rows))


class TagTests(TestCase):
    def test_projection_replaces_stale_tags_and_excludes_synthetic_entries(self):
        owner, first, second, account = (UUID(int=i) for i in range(1, 5))
        entry = f"{account}.{UUID(int=5)}"
        data = {"tags": [{"id": "old"}], "transactions": [
            {"id": entry, "accountId": str(account), "tagIds": ["old"]},
            {"id": f"{entry}:2", "cardId": str(account), "tagIds": ["old"]},
            {"id": f"{account}.{UUID(int=6)}", "accountId": str(account)},
        ]}
        connection = Connection([[(first, "One"), (second, "Two")], [(entry, first), (entry, second)]])
        apply_tags(connection, owner, data)
        self.assertEqual(data["transactions"][0]["tagIds"], [str(first), str(second)])
        self.assertNotIn("tagIds", data["transactions"][1])
        self.assertEqual(data["transactions"][2]["tagIds"], [])
        self.assertEqual(data["tags"], [{"id": str(first), "name": "One"}, {"id": str(second), "name": "Two"}])

    def test_rejects_invalid_or_duplicate_references(self):
        tag = str(UUID(int=4))
        entry = f"{UUID(int=2)}.{UUID(int=3)}"
        for payload in ({"entryId": entry, "tagIds": [tag, tag]}, {"entryId": entry + ":2", "tagIds": []},
                        {"entryId": "-" * 36 + "." + str(UUID(int=3)), "tagIds": []}):
            with self.subTest(payload=payload), self.assertRaises(ValidationError):
                TransactionTags.model_validate(payload)
