"""Owner-scoped reimbursement plans and links."""
from uuid import UUID


def lock(connection, owner: UUID) -> None:
    connection.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (f"balsave:receivables:{owner}",))


def apply(connection, owner: UUID, data: dict) -> dict:
    groups: dict[str, dict] = {}
    rows = connection.execute("""
        SELECT expense_id, id, name, amount_cents, NULL::text AS credit_id, NULL::uuid AS expectation_id
        FROM balsave.receivable_expectations WHERE user_id = %(owner)s
        UNION ALL
        SELECT expense_id, NULL, NULL, amount_cents, credit_id, expectation_id
        FROM balsave.receivable_receipts WHERE user_id = %(owner)s
        ORDER BY expense_id, name, id, credit_id
        """, {"owner": owner}).fetchall()
    for expense, ident, name, amount, credit, expectation in rows:
        group = groups.setdefault(expense, {"expenseId": expense, "expectations": [], "receipts": []})
        if ident:
            group["expectations"].append({"id": str(ident), "name": name, "amountCents": amount})
        else:
            group["receipts"].append({
                "creditId": credit, "expectationId": str(expectation) if expectation else None, "amountCents": amount,
            })
    data["receivableGroups"] = list(groups.values())
    return data


def replace_plan(connection, owner: UUID, expense: str, expectations: list) -> None:
    ids = [item.id for item in expectations]
    connection.execute("UPDATE balsave.receivable_receipts SET expectation_id = NULL WHERE user_id = %s AND expense_id = %s AND expectation_id IS NOT NULL AND NOT (expectation_id = ANY(%s))", (owner, expense, ids))
    connection.execute("DELETE FROM balsave.receivable_expectations WHERE user_id = %s AND expense_id = %s AND NOT (id = ANY(%s))", (owner, expense, ids))
    for item in expectations:
        result = connection.execute("""INSERT INTO balsave.receivable_expectations (user_id, expense_id, id, name, amount_cents)
            VALUES (%s, %s, %s, %s, %s) ON CONFLICT (user_id, id) DO UPDATE SET name = EXCLUDED.name, amount_cents = EXCLUDED.amount_cents
            WHERE balsave.receivable_expectations.expense_id = EXCLUDED.expense_id RETURNING id""",
            (owner, expense, item.id, item.name, item.amountCents)).fetchone()
        if result is None:
            raise ValueError("Expectation belongs to another expense")
