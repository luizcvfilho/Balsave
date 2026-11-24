"""Store owner-scoped tags and references, never provider financial records."""

from uuid import UUID

import psycopg


class TagNotFound(ValueError):
    pass


class TagConflict(ValueError):
    pass


def list_tags(connection, owner: UUID) -> list[dict]:
    return [{"id": str(row[0]), "name": row[1]} for row in connection.execute(
        "SELECT id, name FROM balsave.tags WHERE user_id = %s ORDER BY name, id", (owner,),
    ).fetchall()]


def imported_entry(entry: dict) -> bool:
    reference = entry.get("id")
    if not isinstance(reference, str):
        return False
    parts = reference.split(".")
    if len(parts) != 2:
        return False
    try:
        if any(str(UUID(part)) != part for part in parts):
            return False
    except ValueError:
        return False
    return (entry.get("accountId") or entry.get("cardId") or entry.get("investmentId")) == parts[0]


def apply_tags(connection, owner: UUID, data: dict) -> dict:
    data["tags"] = list_tags(connection, owner)
    assignments: dict[str, list[str]] = {}
    for entry_id, tag_id in connection.execute(
        "SELECT entry_id, tag_id FROM balsave.transaction_tags WHERE user_id = %s ORDER BY tag_id", (owner,),
    ).fetchall():
        assignments.setdefault(entry_id, []).append(str(tag_id))
    for entry in data["transactions"]:
        if imported_entry(entry):
            entry["tagIds"] = assignments.get(entry["id"], [])
        else:
            entry.pop("tagIds", None)
    return data


def create(connection, owner: UUID, name: str) -> dict:
    try:
        row = connection.execute("INSERT INTO balsave.tags (user_id, name) VALUES (%s, %s) RETURNING id, name", (owner, name)).fetchone()
    except psycopg.errors.UniqueViolation:
        raise TagConflict from None
    return {"id": str(row[0]), "name": row[1]}


def update(connection, owner: UUID, tag_id: UUID, name: str) -> dict:
    try:
        row = connection.execute("UPDATE balsave.tags SET name = %s WHERE user_id = %s AND id = %s RETURNING id, name", (name, owner, tag_id)).fetchone()
    except psycopg.errors.UniqueViolation:
        raise TagConflict from None
    if row is None:
        raise TagNotFound
    return {"id": str(row[0]), "name": row[1]}


def assign(connection, owner: UUID, entry_id: str, tag_ids: list[UUID]) -> None:
    connection.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (f"balsave:tags:{owner}",))
    rows = connection.execute("SELECT id FROM balsave.tags WHERE user_id = %s AND id = ANY(%s)", (owner, tag_ids)).fetchall()
    if len(rows) != len(tag_ids):
        raise TagNotFound
    connection.execute("DELETE FROM balsave.transaction_tags WHERE user_id = %s AND entry_id = %s", (owner, entry_id))
    for tag_id in tag_ids:
        connection.execute("INSERT INTO balsave.transaction_tags (user_id, entry_id, tag_id) VALUES (%s, %s, %s)", (owner, entry_id, tag_id))
