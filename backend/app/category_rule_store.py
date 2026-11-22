"""Persist personal classification rules scoped to their authenticated owner."""

from datetime import date
from uuid import UUID

import psycopg

from app.category_rules import DRAFT_ID, normalize_draft
from app.category_store import CategoryNotFound, _lock_owner


RULE_COLUMNS = "id, category_id, description, match_type, account_id, priority, starts_on, enabled, created_at"


def _rule(row: tuple) -> dict:
    return {
        "id": str(row[0]), "categoryId": str(row[1]), "description": row[2],
        "matchType": row[3], "accountId": str(row[4]) if row[4] else None,
        "priority": row[5], "startsOn": row[6].isoformat() if row[6] else None,
        "enabled": row[7], "createdAt": row[8].isoformat(),
    }


def list_rules(connection: psycopg.Connection, owner: UUID) -> list[dict]:
    return [_rule(row) for row in connection.execute(
        f"SELECT {RULE_COLUMNS} FROM balsave.category_rules WHERE user_id = %s ORDER BY priority, created_at, id", (owner,),
    ).fetchall()]


def save_rule(connection: psycopg.Connection, owner: UUID, candidate: dict) -> dict:
    """Save a confirmed candidate after the service validates its live account scope."""
    _lock_owner(connection, owner)
    rules = list_rules(connection, owner)
    normalized = normalize_draft({
        "ruleId": None if candidate["id"] == DRAFT_ID else candidate["id"],
        "categoryId": candidate["categoryId"], "description": candidate["description"],
        "matchType": candidate["matchType"], "accountId": candidate["accountId"],
        "priority": candidate["priority"], "applyToHistory": candidate["startsOn"] is None,
        "enabled": candidate["enabled"],
    }, rules, date.fromisoformat(candidate["startsOn"]) if candidate["startsOn"] else date.today())
    if connection.execute(
        "SELECT id FROM balsave.categories WHERE user_id = %s AND id = %s AND archived_at IS NULL",
        (owner, normalized["categoryId"]),
    ).fetchone() is None:
        raise CategoryNotFound("The category is unavailable for new rules.")
    values = (normalized["categoryId"], normalized["description"], normalized["matchType"], normalized["accountId"],
              normalized["priority"], normalized["startsOn"], normalized["enabled"])
    if normalized["id"] == DRAFT_ID:
        row = connection.execute(
            f"""INSERT INTO balsave.category_rules
            (user_id, category_id, description, match_type, account_id, priority, starts_on, enabled)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING {RULE_COLUMNS}""", (owner, *values),
        ).fetchone()
    else:
        row = connection.execute(
            f"""UPDATE balsave.category_rules SET category_id = %s, description = %s,
            match_type = %s, account_id = %s, priority = %s, starts_on = %s, enabled = %s
            WHERE user_id = %s AND id = %s RETURNING {RULE_COLUMNS}""", (*values, owner, normalized["id"]),
        ).fetchone()
        if row is None:
            raise CategoryNotFound("The rule is unavailable for this owner.")
    return _rule(row)


def disable_rule(connection: psycopg.Connection, owner: UUID, rule_id: UUID) -> dict:
    _lock_owner(connection, owner)
    row = connection.execute(
        f"""UPDATE balsave.category_rules SET enabled = false
        WHERE user_id = %s AND id = %s RETURNING {RULE_COLUMNS}""", (owner, rule_id),
    ).fetchone()
    if row is None:
        raise CategoryNotFound("The rule is unavailable for this owner.")
    return _rule(row)


def delete_rule(connection: psycopg.Connection, owner: UUID, rule_id: UUID) -> None:
    _lock_owner(connection, owner)
    if connection.execute(
        "DELETE FROM balsave.category_rules WHERE user_id = %s AND id = %s RETURNING id", (owner, rule_id),
    ).fetchone() is None:
        raise CategoryNotFound("The rule is unavailable for this owner.")
