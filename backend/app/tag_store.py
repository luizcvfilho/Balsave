"""Store owner-scoped tags and references, never provider financial records."""

from uuid import UUID

import psycopg


MAX_TRANSACTION_TAGS = 100


class TagNotFound(ValueError):
    pass


class TagConflict(ValueError):
    pass


class TagLimitReached(ValueError):
    pass


def list_tags(connection, owner: UUID) -> list[dict]:
    return [{"id": str(row[0]), "name": row[1]} for row in connection.execute(
        "SELECT id, name FROM balsave.tags WHERE user_id = %s ORDER BY name, id", (owner,),
    ).fetchall()]


def catalog(connection, owner: UUID) -> dict:
    rows = connection.execute(
        """SELECT tags.id, tags.name, count(assignments.entry_id)
        FROM balsave.tags AS tags
        LEFT JOIN balsave.transaction_tags AS assignments
            ON assignments.user_id = tags.user_id AND assignments.tag_id = tags.id
        WHERE tags.user_id = %s
        GROUP BY tags.id, tags.name
        ORDER BY tags.name, tags.id""",
        (owner,),
    ).fetchall()
    return {
        "tags": [{"id": str(tag_id), "name": name} for tag_id, name, _ in rows],
        "usageByTag": {str(tag_id): count for tag_id, _, count in rows},
    }


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


def _lock_assignments(connection, owner: UUID) -> None:
    connection.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (f"balsave:tags:{owner}",))


def assign(connection, owner: UUID, entry_id: str, tag_ids: list[UUID]) -> None:
    _lock_assignments(connection, owner)
    rows = connection.execute("SELECT id FROM balsave.tags WHERE user_id = %s AND id = ANY(%s)", (owner, tag_ids)).fetchall()
    if len(rows) != len(tag_ids):
        raise TagNotFound
    connection.execute("DELETE FROM balsave.transaction_tags WHERE user_id = %s AND entry_id = %s", (owner, entry_id))
    for tag_id in tag_ids:
        connection.execute("INSERT INTO balsave.transaction_tags (user_id, entry_id, tag_id) VALUES (%s, %s, %s)", (owner, entry_id, tag_id))


def delete(connection, owner: UUID, tag_id: UUID) -> None:
    _lock_assignments(connection, owner)
    row = connection.execute(
        "DELETE FROM balsave.tags WHERE user_id = %s AND id = %s RETURNING id",
        (owner, tag_id),
    ).fetchone()
    if row is None:
        raise TagNotFound


def set_assignment(connection, owner: UUID, entry_id: str, tag_id: UUID, assigned: bool) -> None:
    _lock_assignments(connection, owner)
    if connection.execute("SELECT 1 FROM balsave.tags WHERE user_id = %s AND id = %s", (owner, tag_id)).fetchone() is None:
        raise TagNotFound
    if not assigned:
        connection.execute("DELETE FROM balsave.transaction_tags WHERE user_id = %s AND entry_id = %s AND tag_id = %s", (owner, entry_id, tag_id))
        return
    count, already_assigned = connection.execute(
        """SELECT count(*), count(*) FILTER (WHERE tag_id = %s)
        FROM balsave.transaction_tags WHERE user_id = %s AND entry_id = %s""",
        (tag_id, owner, entry_id),
    ).fetchone()
    if already_assigned:
        return
    if count >= MAX_TRANSACTION_TAGS:
        raise TagLimitReached
    connection.execute("INSERT INTO balsave.transaction_tags (user_id, entry_id, tag_id) VALUES (%s, %s, %s)", (owner, entry_id, tag_id))
