# Application foundation

## Runtime and service boundaries

| Component | Implementation |
| --- | --- |
| Web | Next.js App Router, React, TypeScript, Material UI, and Tailwind CSS provide a responsive interface. Shared assets carry the Balsave theme and brand. Better Auth runs in Next.js Server Actions. |
| API | FastAPI serves health and readiness checks, checks session ownership, and handles Pluggy snapshots and owner preferences. Next.js accesses private APIs through server-side requests. |
| Proxy | Caddy publishes the single host port, bound to `127.0.0.1:8080` by default. It serves Next.js, proxies `/api` and `/api/*` to FastAPI, and blocks browser requests to `/_internal/*`. It overwrites the client-IP header used by the authentication limiter using its trusted-proxy configuration. |
| Database | PostgreSQL runs on a dedicated internal Compose network with the migration job, Next.js, and FastAPI. Its port is available inside that network. The named `postgres_data` volume persists across container recreation and `make down`. |
| Migrations | Compose waits for PostgreSQL to accept the application role's credentials before running the one-shot Alembic job. Next.js and FastAPI start after the job succeeds. Alembic runs as `postgres`. FastAPI connects as `balsave_app`, a restricted login with per-table grants and no schema ownership or schema creation privilege. Caddy starts after Next.js and FastAPI pass their health checks. |

In demo mode, Next.js supplies the checked-in fixture independently of PostgreSQL. Receipt annotations use browser-local storage only for those fixtures.

## Financial control milestone

Better Auth signs in accounts using a unique normalized email and a salted scrypt password hash. Server Actions call Better Auth's server API. The browser presents a signed session token in a `Secure`, `HttpOnly`, `SameSite=Strict` host-only cookie. Better Auth persists the token in PostgreSQL and enforces an eight-hour lifetime. Private backend requests carry the separate internal service secret and the verified session ID. FastAPI checks the session's expiration and its financial owner on every request. The FastAPI database role can read only the identity and session columns required for this lookup.

Every browser mutation verifies its `Origin` against the configured origin. Private pages carry a session-specific HMAC that Next.js checks before forwarding an action. Browsers with open tabs refresh their view when a tab signals a new session. Registration and login use shared PostgreSQL rate limits scoped to the normalized email and client IP group. The limiter receives the email and operation. Better Auth handles passwords inside Next.js.

FastAPI derives the owner ID from the session for each private route. It retrieves Pluggy history using that owner's connections and stores snapshots in a bounded process cache keyed by owner and connection set. The snapshot lock is scoped to the owner so synchronization cannot hold up another owner's requests. The Pluggy API key is held server-side and reused across calls until refresh. Connect Token issuance has a PostgreSQL-backed quota per owner. Reports, including refund views, use the owner's snapshot, fetched without shared frontend caching. PostgreSQL stores owner-scoped connection references, categories, rules and reconciliation decisions. The ledger schema also enforces ownership on both sides of a refund link.

Migration `0008` introduces a dedicated identity schema and database role. Registration creates a financial owner and Better Auth credentials in a single transaction. PostgreSQL assigns the owner through an insert trigger. The identity role cannot write owner mappings or access financial records. The administrator can [link a legacy login](../README.md#migrate-existing-logins) to its existing owner ID and preserve its scrypt hash. The previous credential tables are restricted to database administrators.

Migration `0009` remains in the migration history so databases that already applied it can continue to upgrade. The account metadata added by that migration is retained while the authenticated reports use Pluggy snapshots.

Migration `0010` stores personal tags and their assignments using the owner and existing provider transaction reference. The write API verifies the transaction against the owner's Pluggy snapshot and validates every selected tag before replacing the assignments in one database transaction. Snapshot responses re-read tag preferences from PostgreSQL so they appear after provider refreshes and across backend workers.

Migration `0011` stores expected amounts by payer and receipt allocations by owner and provider transaction reference. It keeps amounts in integer BRL cents. FastAPI verifies expenses and posted credits from the owner's snapshot. A database transaction lock serializes each owner's updates across workers. Snapshots re-read these records from PostgreSQL and keep saved references available for review when provider records are unavailable.

## Amounts and reporting dates

The development plan proposed storing BRL amounts as integer cents in PostgreSQL. The existing ledger schema uses exact `numeric(20,6)` amounts with a currency code and a separate debit or credit direction. This preserves source precision up to six decimal places. Python reads these amounts as `Decimal`. Keep this schema for the foundation. The BRL reporting boundary uses integer cents for the demo and frontend calculations. FastAPI converts supported BRL snapshot amounts to cents with decimal `ROUND_HALF_UP` rounding before sending them to the frontend.

`transactions.occurred_on` is a PostgreSQL `date`. The demo's `YYYY-MM-DD` strings and period boundaries represent dates in `America/Sao_Paulo`. For provider data, the API preserves date-only values and converts timestamps to the reporting timezone before selecting the date. The browser formats the resulting date and BRL amounts in `pt-BR`. A linked refund appears as a credit on the receipt date and reduces spending in the original purchase month once the receipt is within the report's cutoff date.

Expected amounts track what is owed. Actual receipts reduce net spending. Each allocated receipt first covers the payer selected for it, then any remainder covers outstanding shares on the same expense. Amounts above the total planned reimbursement are surplus and do not reduce the owner's share. Direct reimbursements with no plan can cover the entire expense. Cash flow keeps each original transaction amount and date.

“Lançamentos” applies the period and other active filters before totaling the displayed amounts. “Painel financeiro” and “Gastos por categoria” use the same tag matching for spending, including the daily pace, and retain their net spending calculation. Selecting multiple tags matches any selected tag and counts each transaction once. Projected installments are excluded while a tag filter is active.

## Starting history

The reproducible demo starts with June 2026 transactions and runs through November 14, 2026. The fixed history provides a baseline for month comparisons and the October–November refund scenario. Its entries, accounts, cards, categories and event tags are synthetic and shipped with the frontend. A clean database starts with an empty ledger. The default for future manual entry is to start with the current local month. The authenticated preview can show earlier records supplied by the provider. If a spreadsheet is supplied later, assess its format from the header and synthetic rows before specifying any import work.
