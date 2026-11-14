from alembic import op


def create_tables() -> None:
    # The same DDL serves new databases and databases stamped by the old 0001.
    op.execute("""
        DO $schema$
        BEGIN
            IF to_regclass('balsave.users') IS NOT NULL THEN
                RETURN;
            END IF;

            CREATE TABLE balsave.users (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE balsave.accounts (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id uuid NOT NULL REFERENCES balsave.users (id),
                name text NOT NULL,
                kind text NOT NULL CHECK (kind IN ('bank', 'credit_card')),
                currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
                provider text,
                external_id text,
                CONSTRAINT accounts_owner_key UNIQUE (user_id, id),
                CONSTRAINT accounts_external_key UNIQUE (user_id, provider, external_id),
                CONSTRAINT accounts_external_pair CHECK (
                    (provider IS NULL AND external_id IS NULL)
                    OR (provider IS NOT NULL AND provider <> ''
                        AND external_id IS NOT NULL AND external_id <> '')
                )
            );

            CREATE TABLE balsave.categories (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id uuid NOT NULL REFERENCES balsave.users (id),
                name text NOT NULL,
                CONSTRAINT categories_owner_key UNIQUE (user_id, id)
            );

            CREATE TABLE balsave.transactions (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id uuid NOT NULL,
                account_id uuid NOT NULL,
                category_id uuid,
                occurred_on date NOT NULL,
                description text NOT NULL,
                amount numeric(20, 6) NOT NULL CHECK (amount >= 0 AND amount <> 'NaN'),
                currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
                direction text NOT NULL CHECK (direction IN ('debit', 'credit')),
                status text NOT NULL CHECK (status IN ('pending', 'posted')),
                kind text NOT NULL CHECK (
                    kind IN ('income', 'expense', 'transfer', 'refund', 'unclassified')
                ),
                external_id text CHECK (external_id <> ''),
                updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT transactions_owner_key UNIQUE (user_id, id),
                CONSTRAINT transactions_external_key UNIQUE (account_id, external_id),
                CONSTRAINT transactions_account_fkey FOREIGN KEY (user_id, account_id)
                    REFERENCES balsave.accounts (user_id, id),
                CONSTRAINT transactions_category_fkey FOREIGN KEY (user_id, category_id)
                    REFERENCES balsave.categories (user_id, id)
            );

            CREATE INDEX transactions_owner_date_idx
                ON balsave.transactions (user_id, occurred_on DESC);
            CREATE INDEX transactions_category_idx
                ON balsave.transactions (user_id, category_id);

            CREATE TABLE balsave.refunds (
                refund_transaction_id uuid PRIMARY KEY,
                user_id uuid NOT NULL,
                expense_transaction_id uuid NOT NULL,
                CONSTRAINT refunds_distinct_transactions CHECK (
                    refund_transaction_id <> expense_transaction_id
                ),
                CONSTRAINT refunds_credit_fkey FOREIGN KEY (user_id, refund_transaction_id)
                    REFERENCES balsave.transactions (user_id, id),
                CONSTRAINT refunds_expense_fkey FOREIGN KEY (user_id, expense_transaction_id)
                    REFERENCES balsave.transactions (user_id, id)
            );

            CREATE INDEX refunds_expense_idx
                ON balsave.refunds (user_id, expense_transaction_id);

            CREATE FUNCTION balsave.validate_refund() RETURNS trigger
                LANGUAGE plpgsql SET search_path = pg_catalog
            AS $refund$
            DECLARE
                expense_id uuid;
                expense balsave.transactions%ROWTYPE;
                refunded numeric;
                valid_credits boolean;
            BEGIN
                IF TG_TABLE_NAME = 'refunds' THEN
                    -- Create a row version so a concurrent edit to the credit
                    -- either sees its new link or retries at stricter isolation.
                    UPDATE balsave.transactions AS credit SET updated_at = credit.updated_at
                    WHERE credit.user_id = NEW.user_id AND credit.id = NEW.refund_transaction_id;
                    expense_id := NEW.expense_transaction_id;
                ELSE
                    -- A linked transaction is either a credit or an original expense.
                    SELECT link.expense_transaction_id INTO expense_id
                    FROM balsave.refunds AS link
                    WHERE link.user_id = NEW.user_id
                        AND (link.refund_transaction_id = NEW.id OR link.expense_transaction_id = NEW.id)
                    LIMIT 1;
                    IF NOT FOUND THEN
                        RETURN NULL;
                    END IF;
                END IF;

                -- Serialize allocations and credit edits on the original expense.
                UPDATE balsave.transactions AS original SET updated_at = original.updated_at
                WHERE original.user_id = NEW.user_id AND original.id = expense_id
                RETURNING original.* INTO expense;

                SELECT sum(credit.amount), bool_and(
                    credit.kind = 'refund' AND credit.direction = 'credit'
                    AND credit.status = 'posted' AND credit.currency = expense.currency
                )
                INTO refunded, valid_credits
                FROM balsave.refunds AS link
                JOIN balsave.transactions AS credit
                    ON credit.user_id = link.user_id AND credit.id = link.refund_transaction_id
                WHERE link.user_id = NEW.user_id AND link.expense_transaction_id = expense_id;

                IF refunded IS NOT NULL AND (
                    expense.kind <> 'expense' OR expense.direction <> 'debit'
                    OR expense.status <> 'posted' OR NOT valid_credits
                    OR refunded > expense.amount
                ) THEN
                    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'refunds_valid_allocation',
                        MESSAGE = 'Refunds must be posted credits in the expense currency and cannot exceed the posted expense.';
                END IF;

                RETURN NULL;
            END;
            $refund$;

            CREATE TRIGGER refunds_validate_allocation
                AFTER INSERT OR UPDATE ON balsave.refunds
                FOR EACH ROW EXECUTE FUNCTION balsave.validate_refund();

            CREATE TRIGGER transactions_validate_refunds
                AFTER UPDATE OF amount, currency, direction, status, kind ON balsave.transactions
                FOR EACH ROW
                WHEN (
                    (OLD.amount, OLD.currency, OLD.direction, OLD.status, OLD.kind)
                    IS DISTINCT FROM
                    (NEW.amount, NEW.currency, NEW.direction, NEW.status, NEW.kind)
                )
                EXECUTE FUNCTION balsave.validate_refund();

            REVOKE EXECUTE ON FUNCTION balsave.validate_refund() FROM PUBLIC;
            GRANT SELECT, INSERT ON balsave.users TO balsave_app;
            GRANT SELECT, INSERT, UPDATE, DELETE ON
                balsave.accounts, balsave.categories, balsave.transactions, balsave.refunds TO balsave_app;
        END;
        $schema$
    """)
