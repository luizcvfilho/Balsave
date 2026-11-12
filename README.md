# Balsave

A personal finance web application in Brazilian Portuguese (pt-BR) that uses Brazilian reais (BRL). The initial version includes a dashboard with mock data.

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

Existing `.env` files still work. If you update one, rename `VALORA_BIND_ADDRESS`, `VALORA_PORT`, and `VALORA_DB_PASSWORD` to `BALSAVE_BIND_ADDRESS`, `BALSAVE_PORT`, and `BALSAVE_DB_PASSWORD` and keep the existing values. The Compose project retains the `valora` identifier so Docker continues to use the same PostgreSQL volume.

## Local checks

To check the frontend locally with Node.js 24, run the following commands from the repository root. To sync the backend environment with Python 3.14, run `cd backend && uv sync --locked`.

```sh
npm --prefix frontend ci
make check
npm --prefix frontend run build
```

## Database migrations

`make dev` and `make up` wait for PostgreSQL to become ready and apply Alembic migrations before starting the API. The `migrate` service uses the `postgres` role to make schema changes. The API uses the `valora_app` role, which has permissions to access application data.

The first revision creates the `valora` schema for application tables and grants the API access to that schema. Revisions live in `backend/migrations/versions/`. Run the following commands from the repository root to create a revision and apply it after editing the generated file.

```sh
(cd backend && uv run --locked alembic revision -m "describe the change")
# Edit the generated revision before applying it.
make migrate
```

## Connect your accounts with Meu Pluggy

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

- `frontend/src/app/` contains the dashboard routes, layout, and CSS built with the Next.js App Router, TypeScript, and Tailwind. Configuration files and `package.json` live at the root of `frontend/`. The shared theme tokens and light and dark brand assets live in `assets/`.
- `backend/` contains the FastAPI application, the PostgreSQL connection through Psycopg, and the Alembic migrations. The `uv.lock` file pins backend dependencies.
- `infra/` contains the Caddy configuration and the initialization script for the API's PostgreSQL role. The proxy is the only service with a published port and serves the frontend and `/api` from the same origin.
