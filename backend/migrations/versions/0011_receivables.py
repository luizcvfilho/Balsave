"""Persist reimbursement plans and links without storing provider records."""
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(r"""
        CREATE TABLE balsave.receivable_expectations (
            user_id uuid NOT NULL REFERENCES balsave.users (id),
            expense_id text NOT NULL,
            id uuid NOT NULL,
            name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
            amount_cents bigint NOT NULL CHECK (amount_cents > 0 AND amount_cents < 9007199254740992),
            PRIMARY KEY (user_id, id),
            UNIQUE (user_id, expense_id, id)
        );
        CREATE TABLE balsave.receivable_receipts (
            user_id uuid NOT NULL REFERENCES balsave.users (id),
            expense_id text NOT NULL,
            credit_id text NOT NULL,
            expectation_id uuid,
            amount_cents bigint NOT NULL CHECK (amount_cents > 0 AND amount_cents < 9007199254740992),
            PRIMARY KEY (user_id, credit_id),
            FOREIGN KEY (user_id, expense_id, expectation_id)
                REFERENCES balsave.receivable_expectations (user_id, expense_id, id)
        );
        GRANT SELECT, INSERT, UPDATE, DELETE ON balsave.receivable_expectations TO balsave_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON balsave.receivable_receipts TO balsave_app;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE balsave.receivable_receipts; DROP TABLE balsave.receivable_expectations;")
