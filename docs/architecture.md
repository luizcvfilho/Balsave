# Application foundation

## Runtime and service boundaries

| Component | Implementation |
| --- | --- |
| Web | Next.js App Router, React, TypeScript, Material UI, and Tailwind CSS provide a responsive interface. Shared assets carry the Balsave theme and brand. |
| API | FastAPI serves health and readiness checks and handles the authenticated local Pluggy preview, including financial snapshot calculations and owner preferences. Next.js reads preview data through server-side requests. |
| Proxy | Caddy publishes the single host port, bound to `127.0.0.1:8080` by default. It serves Next.js and proxies `/api` and `/api/*` to FastAPI on the same origin. Requests to FastAPI's `/_internal/pluggy` routes come from the Next.js server over the Compose network. |
| Database | PostgreSQL runs on a dedicated internal Compose network with the migration job and FastAPI. Its port is available inside that network. The named `postgres_data` volume persists across container recreation and `make down`. |
| Migrations | Compose waits for PostgreSQL to accept the application role's credentials before running the one-shot Alembic job. FastAPI starts after the job succeeds. Alembic runs as `postgres`. FastAPI connects as `balsave_app`, a restricted login with per-table grants and no schema ownership or schema creation privilege. Caddy starts after Next.js and FastAPI pass their health checks. |

In demo mode, Next.js supplies the checked-in fixture independently of PostgreSQL. Demo receipt annotations use a browser-local storage key reserved for those fixtures. The regular startup also migrates the empty database, including the preview owner record, so the same Compose stack can support the authenticated preview when configured.

The Pluggy preview supports one local owner. The frontend validates a signed, secure, HTTP-only session cookie and authenticates its FastAPI requests separately. Pluggy credentials stay in the API service. FastAPI scopes stored connections and preferences to the preview owner. It retrieves available financial history from the provider and caches snapshots in process memory. PostgreSQL stores connection references and user preferences, including categories, personal rules, and reconciliation decisions.

## Amounts and reporting dates

The development plan proposed storing BRL amounts as integer cents in PostgreSQL. The existing ledger schema uses exact `numeric(20,6)` amounts with a currency code and a separate debit or credit direction. This preserves source precision up to six decimal places. Python reads these amounts as `Decimal`. Keep this schema for the foundation. The BRL reporting boundary uses integer cents for the demo and frontend calculations. FastAPI converts supported BRL snapshot amounts to cents with decimal `ROUND_HALF_UP` rounding before sending them to the frontend.

`transactions.occurred_on` is a PostgreSQL `date`. The demo's `YYYY-MM-DD` strings and period boundaries represent dates in `America/Sao_Paulo`. For provider data, the API preserves date-only values and converts timestamps to the reporting timezone before selecting the date. The browser formats the resulting date and BRL amounts in `pt-BR`. A linked refund appears as a credit on the receipt date and reduces spending in the original purchase month once the receipt is within the report's cutoff date.

## Starting history

The reproducible demo starts with June 2026 transactions and runs through November 14, 2026. The fixed history provides a baseline for month comparisons and the October–November refund scenario. Its entries, accounts, cards, categories and event tags are synthetic and shipped with the frontend. A clean database starts with an empty ledger. The default for future manual entry is to start with the current local month. The authenticated preview can show earlier records supplied by the provider. If a spreadsheet is supplied later, assess its format from the header and synthetic rows before specifying any import work.
