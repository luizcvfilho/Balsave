# Balsave

A personal finance web application in Brazilian Portuguese (pt-BR) that uses Brazilian reais (BRL). The dashboard supports demo data and a local Meu Pluggy preview.

## Run locally

Use Make, Docker with the Compose v2 plugin, and `openssl`. On the first run, the Makefile generates a local `.env` with separate passwords for the PostgreSQL administrator and the API.

```sh
make dev
```

`make dev` combines `compose.yaml` and `compose.dev.yaml` to enable automatic reloading for the frontend and API. Open the dashboard at <http://localhost:8080>. The API is available at `/api`, with documentation at `/api/docs`.

| Command | Purpose |
| --- | --- |
| `make up` | Start the production build in the background. |
| `make migrate` | Apply pending PostgreSQL migrations. |
| `make ps` | Show service status. |
| `make logs SERVICE=backend` | Follow the API logs. Use `make logs` for the entire stack. |
| `make health` | Request `/api/ready` through Caddy to check the database connection. |
| `make down` | Stop the stack and keep the `postgres_data` volume. |
| `make help` | List the available commands. |

PostgreSQL sets the passwords when it initializes the volume. If you change them later, update the role passwords in the database as well.

To try the prototype in Safari on an iPhone, set `BALSAVE_BIND_ADDRESS=0.0.0.0` in `.env`, run `make up`, and open `http://<computer-ip>:8080` on an iPhone connected to the same network. Use this configuration with the prototype's mock data. By default, the application listens only on the loopback interface.

## Local checks

To check the frontend locally with Node.js 24, run the following commands from the repository root. To sync the backend environment with Python 3.14, run `cd backend && uv sync --locked`.

```sh
npm --prefix frontend ci
make check
npm --prefix frontend exec -- playwright install chromium
npm --prefix frontend test
npm --prefix frontend run build
```

The dashboard uses a reproducible snapshot in [`frontend/src/data/mock-data.ts`](frontend/src/data/mock-data.ts). Edit that file to change the bank accounts, card limits, monthly balances, or transactions. Mock amounts use integer cents, and the reporting date is a calendar date in `America/Sao_Paulo`.

“Ritmo de gastos” and “Gastos por categoria” share the same net expense calculation. Expenses are categorized from their merchant type, and linked refunds reduce the original expense as of the reporting date. The daily comparison uses the previous three calendar months. For shorter months, it carries their closing total forward to the remaining days. The balance chart shows the last calendar day of each completed month. “Saldo em contas” displays the current balance.

“Parcelas incluídas” shows the net amount of card installments already included in the selected month's categories. The link opens “Gastos por categoria” with “Tipo de compra” set to “Parceladas”.

“Parcelas previstas” shows estimated dates and amounts separately in “Gastos por categoria” and “Cartões”. “Aguardando lançamento” marks a forecast whose estimated date has arrived. Forecasts have their own total.

Use “Ver detalhes” to open the spending, account, card, or transaction report. Detail links carry the selected period, category, institution, card, or chart point in the URL. Spending reports share the dashboard's refund calculation, and account history uses the same balance snapshots for consolidated and institution-level views. The card fixtures specify invoice membership and due dates separately from purchase dates.

In “Lançamentos” → “Reembolsos”, users can track pending, partial, and completed reimbursements and open the original purchase or individual receipts. Income and refund details support free-text classifications and tags. These annotations are stored in the current browser for the mock dataset and can be found through “Buscar lançamentos”.

## Database migrations

`make dev` and `make up` wait for PostgreSQL to become ready and apply Alembic migrations before starting the API. The `migrate` service uses the `postgres` role to make schema changes. The API uses the `balsave_app` role, which has permissions to access application data.

Revision `0001` creates the `balsave` schema and its initial tables. Revision `0002` installs those same tables in databases that already applied the original, schema-only version of `0001`. Run `make migrate` to apply pending revisions.

Open the [interactive database diagram](docs/database/schema.html) locally.

| Table | Purpose |
| --- | --- |
| `users` | Internal owners of financial records. |
| `accounts` | Bank accounts and credit cards, with optional external references. |
| `categories` | User-defined labels for transactions. |
| `transactions` | Dated entries with an exact amount, currency, direction, status and kind. |
| `refunds` | Links a posted refund credit to one original expense, which can receive multiple partial refunds. |

Composite foreign keys prevent accounts, categories and refund links from referencing another user's records. The API role has table-level data permissions. Private endpoints will also need to enforce user authorization.

Transaction amounts use `numeric(20,6)` and a separate debit or credit direction. Read amounts as `Decimal` in Python. Preserve source dates that have no time component and convert timestamps to `America/Sao_Paulo` before assigning an `occurred_on` date. For reporting, sum posted entries by currency. Count card bill payments as transfers and linked refunds against the original expense. PostgreSQL checks that both entries are posted, have the same currency, and that their total refunds do not exceed the original amount, including during concurrent writes.

External account IDs are unique per user and provider. External transaction IDs are unique per account. An importer can upsert on these keys and preserve user categorization.

Revisions live in `backend/migrations/versions/`. Run the following commands from the repository root to create a revision and apply it after editing the generated file.

```sh
(cd backend && uv run --locked alembic revision -m "describe the change")
# Edit the generated revision before applying it.
make migrate
```

To run the refund integration tests, set `BALSAVE_TEST_DATABASE_URL` to the migration role's connection URL for a disposable PostgreSQL database migrated to `head`. Run the following command from the repository root.

```sh
(cd backend && uv run --locked python -m unittest discover -s tests -v)
```

### Upgrade a volume from the previous project name

If you have an existing `valora_postgres_data` volume, back it up and rename the `VALORA_BIND_ADDRESS`, `VALORA_PORT`, and `VALORA_DB_PASSWORD` keys in `.env` to their `BALSAVE_` equivalents. Keep the existing values and add `BALSAVE_POSTGRES_VOLUME=valora_postgres_data` so the renamed project keeps using that volume.

From the repository root, stop the old stack and run the one-time database rename. The volume check ensures the commands target an existing volume.

```sh
docker volume inspect valora_postgres_data >/dev/null &&
docker compose -p valora down &&
docker compose run -d --rm --name balsave-rename-db db
docker exec -it balsave-rename-db pg_isready -U postgres -d postgres
docker exec -i balsave-rename-db psql -X -U postgres -d postgres < infra/postgres/upgrade-legacy.sql &&
docker stop balsave-rename-db &&
make migrate
```

Run the `psql` command once `pg_isready` reports that the server is accepting connections. The SQL renames the database, schema and API role in the existing volume.

## Connect your accounts with Meu Pluggy

1. Keep `BALSAVE_BIND_ADDRESS=127.0.0.1` and set `PLUGGY_CLIENT_ID` and `PLUGGY_CLIENT_SECRET` for your Pluggy application in the repository's local `.env`. If needed, enable **MeuPluggy** in the application's connector settings. [Meu Pluggy setup](https://docs.pluggy.ai/pt/docs/guides/meu-pluggy-personal-use)
2. Set `BALSAVE_PREVIEW_PASSWORD` in the same file to a unique random password, generated with `openssl rand -hex 24`. Run `make up` and open <http://localhost:8080> on the same computer. Sign in using the preview password.
3. Select “Conectar bancos” → “Conectar com Meu Pluggy”. Sign in to Meu Pluggy and authorize access to the banks already connected there. Balsave captures the connection references returned by the widget. Select “Ver dados no painel” to see the available balances, card limits, and transactions through the report date.

The preview uses one local owner and a secure, HTTP-only session cookie. Pluggy API credentials stay in FastAPI. Only the short-lived Connect Token reaches the widget. Migration `0003` creates a local owner and stores the Pluggy item references so they are available after restart. Financial records are read on demand and kept in memory for up to five minutes. Clear `BALSAVE_PREVIEW_PASSWORD` and restart the stack to use the demo.

The preview matches the bank code reported on an account to Pluggy's institution directory. Cards use the same institution when the connection reports a single bank code, along with the card product name and last four digits when available. A connection label is used when the institution cannot be identified. [Pluggy accounts](https://docs.pluggy.ai/en/docs/products/accounts) · [Institution directory](https://docs.pluggy.ai/en/reference/payment-recipient/payment-recipients-institution-list)

The preview displays available BRL balances, posted transactions, and card charges dated through the report date, including charges on an open bill. Foreign-currency card purchases require the converted BRL amount from Pluggy. Card bill payments, transfers identified as being between accounts under the same ownership, and investment contributions and redemptions such as BB Rende Fácil stay in “Lançamentos” and are excluded from spending. Same-owner transfers use full document matches or an explicit same-owner label. Investment movements use Pluggy classifications or recognizable bank descriptions. [Pluggy transactions](https://v2.docs.pluggy.ai/en/docs/products/transactions) · [Pluggy categories](https://v2.docs.pluggy.ai/en/docs/products/transaction-categorization)

“Gastos por categoria” displays “Forma de pagamento” for each expense. The snapshot uses the credit card account, reported payment method, or operation code, with fallbacks to recognizable descriptions and payment categories. Bank entries with an unspecified card type appear as “Cartão (tipo não informado)”. Entries with insufficient information appear as “Não identificada”.

The snapshot identifies card installments from the metadata reported by Pluggy and uses the individual transaction amount. The first installment uses the purchase date. Later installments use the bill posting date when available. Both fall back to the reported transaction date. Monthly and daily spending use the same calendar dates, including when the bill is due in a different month. Later installments enter the report as Pluggy supplies the records for their period. [Pluggy installment documentation](https://docs.pluggy.ai/en/docs/products/credit-card-installments) · [Transaction fields](https://docs.pluggy.ai/en/reference/transaction/transactions-retrieve)

The backend generates the remaining installment estimates from the latest reported charge in an unambiguous purchase plan. It matches records on the same card using the purchase date, description and total installment count. Estimates use the latest installment amount and move one calendar month at a time, clamping dates to shorter months. A newly reported installment supersedes estimates through its sequence number. After a successful synchronization covers the second consecutive expected date without a charge, the plan's outstanding estimates are removed from the report. The backend rebuilds estimates on each snapshot, so a late charge can restore the remaining schedule. [Pluggy installment documentation](https://docs.pluggy.ai/en/docs/products/credit-card-installments) · [Pluggy synchronization](https://docs.pluggy.ai/en/docs/integration-checklist/data-sync)

“Evolução de contas e investimentos” consolidates the available BRL bank accounts and investment positions. “Contas” → “Conciliação” lets the owner indicate that an investment is already included in a bank balance so it is counted once. Bank and investment reference dates remain visible. The chart reverses posted movements from each reported position to estimate completed month-ends. Historical investment valuations require historical quotes, so the chart explicitly identifies cash-flow estimates and incomplete coverage. [Pluggy accounts](https://docs.pluggy.ai/pt/docs/products/accounts) · [Investment position fields](https://docs.pluggy.ai/pt/docs/products/investments)

Reconciliation compares structured transaction data. Candidates require different positions, the same BRL cash amount, opposite directions and dates within three calendar days. Explicitly different participant documents prevent a match. A unique match is automatic when supported by both same-owner classifications, a shared payment reference, a matching fund counterparty document, or the bank's investment operation and a corresponding investment movement in the same connection. Investment transaction net amounts reconcile bank cash while gross position movements preserve the effect of taxes and fees. A payment to a third party remains an external debit even when a redemption funds it. [Transaction fields](https://docs.pluggy.ai/pt/docs/products/transactions) · [Investment movements](https://docs.pluggy.ai/pt/docs/products/investment-transactions)

“Contas” → “Conciliação” lists ambiguous associations for confirmation. It also supports confirming a bank investment movement already included in the account's automatic investment facility when that facility has no separately reported transaction. Confirmations can be undone. Revision `0004` stores owner-scoped transaction references and fingerprints plus investment/account composition links. A changed posting invalidates a saved confirmation. Financial descriptions, account numbers and participant documents are processed in memory. They are removed before returning snapshots to the frontend. Existing verified decisions can be preserved as explicit confirmations during migration.

Ledger colors use gray for reconciled internal movements, green for remaining credits and red for remaining debits. An individual account statement retains its actual debit or credit. The consolidated chart cancels paired transfers only when both positions are included. The calculation uses structured fields and saved decisions independently of transaction descriptions or bank-specific product names.

Card limit usage requires a reported total and available limit. Open bill totals and purchase-to-refund links require additional data. The reports show available card credits without applying them to a purchase. The personal-use Pluggy plan cannot list existing application item IDs, so connections created in the Pluggy Dashboard can be authorized again in the Balsave widget. [Pluggy item documentation](https://docs.pluggy.ai/en/docs/connections/item)

### Inspect a connection from the command line

1. Sign in to Meu Pluggy, add your bank, and authorize access. [Meu Pluggy guide](https://meu.pluggy.ai/api-guide)
2. Sign in to the Pluggy Dashboard with the same account. Under **Aplicações**, open your application and go to **Demo**. Select **Conectar conta → MeuPluggy** and authorize access to your existing connections. If you customized the available connectors, enable **MeuPluggy** under **Direct Connectors** in the **Pessoal** group. [Dashboard setup](https://docs.pluggy.ai/pt/docs/guides/meu-pluggy-personal-use)
3. In the **Itens conectados** section, copy the `itemId` for each bank. Use the Client ID and Client Secret from the application that received the items.
4. From the Balsave repository root, run the commands below and enter the application credentials when prompted. Replace `ITEM_ID` with the copied ID and repeat for each bank. If your local `.env` already contains `PLUGGY_CLIENT_ID` and `PLUGGY_CLIENT_SECRET`, add `--env-file ../.env` after `--locked`.

```sh
cd backend
uv run --locked python -m app.pluggy --meu-pluggy ITEM_ID
```

After the initial setup, the command queries the API directly, processes the data in memory, and reports only the transaction count, field names, and data types. Application authorization lasts one year. After renewing it, check the connection's `itemId` before running the command again. [Authorization and renewal](https://docs.pluggy.ai/pt/docs/guides/meu-pluggy-personal-use)

## Explore Pluggy test data

Create a development application and set `PLUGGY_CLIENT_ID` and `PLUGGY_CLIENT_SECRET` in the local `.env` at the repository root. You can also omit `--env-file ../.env` and enter the credentials in the terminal. [Application credentials](https://docs.pluggy.ai/en/docs/integration-checklist/api-keys)

```sh
cd backend
uv run --locked --env-file ../.env python -m app.pluggy --check-auth
uv run --locked --env-file ../.env python -m app.pluggy --create-sandbox
```

The first command authenticates with the application credentials. The second creates or reuses a mock **Pluggy Bank** connection through the API and reports account types, transaction counts, and the fields observed across all pages. Save the `itemId` printed in the terminal and pass it as `ITEM_ID` in place of `--create-sandbox` to repeat the query. [Create items through the API](https://docs.pluggy.ai/en/reference/items/items-create) · [Sandbox](https://docs.pluggy.ai/en/docs/guides/sandbox)

On the free plan, Pluggy requires the **Connect Widget** to create items. After connecting a sandbox item through the widget, pass its `itemId` to the command to query the API with the same credentials. [Item creation rules](https://docs.pluggy.ai/en/reference/error-codes)

In the database schema, assign Balsave's own IDs to accounts and transactions and store the imported Pluggy IDs as references. Store the currency and exact amount, and account for each transaction's direction (`type`) and state (`status`). A card purchase can have a positive amount and still be a debit. The available fields vary by institution and account type. [Accounts](https://docs.pluggy.ai/en/docs/products/accounts) · [Transactions](https://docs.pluggy.ai/en/docs/products/transactions)

## Project structure

- `frontend/src/app/` defines the Next.js App Router routes and shared layout. Route entries render screens from `frontend/src/ui/pages/`. Place additional screens there and give each one a route entry under `src/app/`.
- `frontend/src/components/` contains the shared Header, cards, charts, and dashboard sections. `frontend/src/theme/` configures Material UI with the Balsave fonts and system color scheme. Shared brand assets and CSS tokens live in `assets/`.
- `frontend/src/data/` contains mock records. `frontend/src/lib/` contains financial calculations and locale formatting. `frontend/tests/` contains TypeScript Playwright specs for both calculations and browser behavior.
- `backend/` contains the FastAPI application, the PostgreSQL connection through Psycopg, and the Alembic migrations. The `uv.lock` file pins backend dependencies.
- `infra/` contains the Caddy configuration and the initialization script for the API's PostgreSQL role. The proxy is the only service with a published port and serves the frontend and `/api` from the same origin.
