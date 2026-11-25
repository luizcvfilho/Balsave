"""Store category preferences without persisting the provider's financial records."""

import re
from collections.abc import Iterable
from datetime import UTC, datetime
from uuid import UUID

import psycopg

from app.categorization import DEFAULT_CATEGORIES


class CategoryNotFound(ValueError):
    """The category or owner is unavailable in the requested scope."""


class CategoryProtected(ValueError):
    """An initial category cannot be deleted."""


class CategoryConflict(ValueError):
    """A category name conflicts with another category owned by this user."""


def _lock_owner(connection: psycopg.Connection, owner: UUID) -> None:
    # All preference writers use the same transaction lock. Hash collisions only
    # serialize unrelated owners; they cannot weaken ownership checks.
    connection.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (f"balsave:categories:{owner}",))
    if connection.execute("SELECT id FROM balsave.users WHERE id = %s", (owner,)).fetchone() is None:
        raise CategoryNotFound("The category owner is unavailable.")


def _category(row: tuple) -> dict:
    return {"id": str(row[0]), "code": row[1], "name": row[2], "archived": row[3] is not None,
            "archivedAt": row[3].astimezone(UTC).isoformat() if row[3] is not None else None}


def _name(name: str) -> str:
    if not isinstance(name, str) or re.search(r"[\x00-\x1f\x7f]", name):
        raise ValueError("Category names cannot contain control characters.")
    normalized = " ".join(name.split())
    if not 1 <= len(normalized) <= 80:
        raise ValueError("Category names must contain between 1 and 80 characters.")
    return normalized


def _check_name(connection: psycopg.Connection, owner: UUID, name: str, category_id: UUID | None = None) -> None:
    # Do not introduce a unique index that could reject preexisting duplicate
    # names. The owner lock serializes every write through this module.
    row = connection.execute(
        """SELECT id FROM balsave.categories
        WHERE user_id = %s AND lower(btrim(name)) = lower(%s)
        AND (%s::uuid IS NULL OR id <> %s::uuid) LIMIT 1""",
        (owner, name, category_id, category_id),
    ).fetchone()
    if row is not None:
        raise CategoryConflict("A category with this name already exists.")


def list_categories(connection: psycopg.Connection, owner: UUID) -> list[dict]:
    rows = connection.execute(
        """SELECT id, code, name, archived_at FROM balsave.categories
        WHERE user_id = %s ORDER BY name, id""", (owner,),
    ).fetchall()
    return [_category(row) for row in rows]


def ensure_default_categories(connection: psycopg.Connection, owner: UUID) -> list[dict]:
    _lock_owner(connection, owner)
    existing = list_categories(connection, owner)
    codes = {category["code"] for category in existing}
    for code, name in DEFAULT_CATEGORIES:
        if code in codes:
            continue
        # Adopt an existing uncoded category instead of creating a duplicate.
        match = next((category for category in existing if category["code"] is None
                      and category["name"].strip().casefold() == name.casefold()), None)
        if match:
            connection.execute("UPDATE balsave.categories SET code = %s WHERE user_id = %s AND id = %s",
                               (code, owner, match["id"]))
            match["code"] = code
        else:
            # A user's renamed default may already use a different default's
            # initial name. Preserve that choice and use a distinct seed label.
            candidate = name
            suffix = 2
            names = {category["name"].strip().casefold() for category in existing}
            while candidate.casefold() in names:
                candidate = f"{name} ({suffix})"
                suffix += 1
            row = connection.execute(
                "INSERT INTO balsave.categories (user_id, code, name) VALUES (%s, %s, %s) RETURNING id",
                (owner, code, candidate),
            ).fetchone()
            existing.append({"id": str(row[0]), "code": code, "name": candidate, "archived": False})
        codes.add(code)
    return list_categories(connection, owner)


def create_category(connection: psycopg.Connection, owner: UUID, name: str) -> dict:
    name = _name(name)
    _lock_owner(connection, owner)
    _check_name(connection, owner, name)
    row = connection.execute(
        """INSERT INTO balsave.categories (user_id, name) VALUES (%s, %s)
        RETURNING id, code, name, archived_at""", (owner, name),
    ).fetchone()
    return _category(row)


def update_category(
    connection: psycopg.Connection, owner: UUID, category_id: UUID,
    *, name: str | None = None, archived: bool | None = None,
) -> dict:
    _lock_owner(connection, owner)
    row = connection.execute(
        "SELECT id, code, name, archived_at FROM balsave.categories WHERE user_id = %s AND id = %s",
        (owner, category_id),
    ).fetchone()
    if row is None:
        raise CategoryNotFound("The category is unavailable for this owner.")
    if name is not None:
        name = _name(name)
        _check_name(connection, owner, name, category_id)
    row = connection.execute(
        """UPDATE balsave.categories SET name = COALESCE(%s, name),
        archived_at = CASE WHEN %s::boolean IS NULL THEN archived_at
            WHEN %s THEN COALESCE(archived_at, CURRENT_TIMESTAMP) ELSE NULL END
        WHERE user_id = %s AND id = %s RETURNING id, code, name, archived_at""",
        (name, archived, archived, owner, category_id),
    ).fetchone()
    return _category(row)


def assignments(connection: psycopg.Connection, owner: UUID) -> dict[str, str | None]:
    return {entry_id: str(category_id) if category_id is not None else None for entry_id, category_id in connection.execute(
        "SELECT entry_id, category_id FROM balsave.transaction_category_assignments WHERE user_id = %s", (owner,),
    ).fetchall()}


def set_assignment(
    connection: psycopg.Connection, owner: UUID, entry_id: str, category_id: UUID | None,
    *, unclassified: bool = False, previous_category_id: UUID | None = None,
) -> None:
    """Store an assignment after the service verifies the live transaction owner."""
    if not re.fullmatch(r"[0-9a-f-]{36}\.[0-9a-f-]{36}", entry_id):
        raise ValueError("The transaction reference is invalid.")
    try:
        account_id, transaction_id = entry_id.split(".")
        if str(UUID(account_id)) != account_id or str(UUID(transaction_id)) != transaction_id:
            raise ValueError
    except ValueError:
        raise ValueError("The transaction reference is invalid.") from None
    if unclassified and category_id is not None:
        raise ValueError("An unclassified transaction cannot have a category ID.")
    _lock_owner(connection, owner)
    if category_id is None and not unclassified:
        connection.execute("DELETE FROM balsave.transaction_category_assignments WHERE user_id = %s AND entry_id = %s",
                           (owner, entry_id))
        return
    if category_id is not None:
        category = connection.execute(
            "SELECT id FROM balsave.categories WHERE user_id = %s AND id = %s AND archived_at IS NULL",
            (owner, category_id),
        ).fetchone()
        if category is None:
            raise CategoryNotFound("The category is unavailable for new assignments.")
    connection.execute(
        """INSERT INTO balsave.transaction_category_assignments AS assignment
        (user_id, entry_id, category_id, previous_categories)
        VALUES (%s, %s, %s, ARRAY[%s::uuid]) ON CONFLICT (user_id, entry_id)
        DO UPDATE SET category_id = EXCLUDED.category_id,
            previous_categories = ARRAY[assignment.category_id] || assignment.previous_categories,
            updated_at = CURRENT_TIMESTAMP
        WHERE assignment.category_id IS DISTINCT FROM EXCLUDED.category_id""",
        (owner, entry_id, category_id, previous_category_id),
    )


def require_deletable(connection: psycopg.Connection, owner: UUID, category_id: UUID) -> None:
    _lock_owner(connection, owner)
    row = connection.execute(
        "SELECT code FROM balsave.categories WHERE user_id = %s AND id = %s",
        (owner, category_id),
    ).fetchone()
    if row is None:
        raise CategoryNotFound("The category is unavailable for this owner.")
    if row[0] is not None:
        raise CategoryProtected("Initial categories cannot be deleted.")


def delete_category(
    connection: psycopg.Connection, owner: UUID, category_id: UUID, rule_entries: list[str],
) -> None:
    require_deletable(connection, owner, category_id)
    connection.execute(
        """UPDATE balsave.transaction_category_assignments AS assignment
        SET category_id = (
            SELECT id FROM balsave.categories
            WHERE user_id = assignment.user_id AND id = assignment.previous_categories[1]
            AND id <> %s
        ), previous_categories = assignment.previous_categories[2:], updated_at = CURRENT_TIMESTAMP
        WHERE user_id = %s AND category_id = %s""",
        (category_id, owner, category_id),
    )
    if rule_entries:
        connection.execute(
            """INSERT INTO balsave.transaction_category_assignments (user_id, entry_id, category_id)
            SELECT %s, entry_id, NULL FROM unnest(%s::text[]) AS affected(entry_id)
            ON CONFLICT (user_id, entry_id) DO NOTHING""",
            (owner, rule_entries),
        )
    connection.execute("DELETE FROM balsave.category_rules WHERE user_id = %s AND category_id = %s", (owner, category_id))
    connection.execute("UPDATE balsave.transactions SET category_id = NULL WHERE user_id = %s AND category_id = %s", (owner, category_id))
    connection.execute("DELETE FROM balsave.categories WHERE user_id = %s AND id = %s", (owner, category_id))


def load_catalog(connection: psycopg.Connection) -> tuple[dict[str, dict], datetime | None]:
    # A state row distinguishes a successful empty catalog from no cached data.
    state = connection.execute("SELECT refreshed_at FROM balsave.pluggy_category_catalog_state WHERE singleton").fetchone()
    rows = connection.execute(
        "SELECT id, description, description_translated, parent_id, parent_description FROM balsave.pluggy_category_catalog",
    ).fetchall()
    fields = ("id", "description", "descriptionTranslated", "parentId", "parentDescription")
    return {row[0]: dict(zip(fields, row)) for row in rows}, state[0] if state else None


def replace_catalog(connection: psycopg.Connection, records: Iterable[dict]) -> None:
    """Atomically replace a successfully fetched public catalog, including empty lists."""
    records = list(records)
    if any(not isinstance(record, dict) or not isinstance(record.get("id"), str)
           or not record["id"] or not isinstance(record.get("description"), str) for record in records):
        raise ValueError("The provider category catalog is invalid.")
    if len({record["id"] for record in records}) != len(records):
        raise ValueError("The provider category catalog contains duplicate identifiers.")
    with connection.transaction():
        connection.execute("SELECT pg_advisory_xact_lock(hashtextextended('balsave:category-catalog', 0))")
        connection.execute("DELETE FROM balsave.pluggy_category_catalog")
        with connection.cursor() as cursor:
            cursor.executemany(
                """INSERT INTO balsave.pluggy_category_catalog
                (id, description, description_translated, parent_id, parent_description)
                VALUES (%s, %s, %s, %s, %s)""",
                [(record["id"], record["description"], record.get("descriptionTranslated"),
                  record.get("parentId"), record.get("parentDescription")) for record in records],
            )
        connection.execute(
            """INSERT INTO balsave.pluggy_category_catalog_state (singleton) VALUES (true)
            ON CONFLICT (singleton) DO UPDATE SET refreshed_at = CURRENT_TIMESTAMP""",
        )
