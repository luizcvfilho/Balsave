.DEFAULT_GOAL := help

COMPOSE := docker compose -f compose.yaml
COMPOSE_DEV := $(COMPOSE) -f compose.dev.yaml

.PHONY: help env dev up build migrate down ps logs config health check

help:
	@printf '%-26s %s\n' \
		'make env' 'Generate a local .env on the first run' \
		'make dev' 'Start with automatic reloading and follow logs' \
		'make up' 'Start the production build in the background' \
		'make build' 'Build images from the base configuration' \
		'make migrate' 'Apply pending database migrations' \
		'make down' 'Stop the stack and keep the database volume' \
		'make ps' 'Show service status' \
		'make logs [SERVICE=backend]' 'Follow logs for one service or the entire stack' \
		'make config' 'Validate both Compose configurations' \
		'make health' 'Check the API and database through the proxy' \
		'make check' 'Run frontend lint and type checks'

env: .env

.env:
	@set -euC; umask 077; \
		admin_password=$$(openssl rand -hex 24); \
		app_password=$$(openssl rand -hex 24); \
		printf 'POSTGRES_PASSWORD=%s\nVALORA_DB_PASSWORD=%s\n' "$$admin_password" "$$app_password" > "$@"

dev: .env
	$(COMPOSE_DEV) up --build

up: .env
	$(COMPOSE) up --build --wait

build: .env
	$(COMPOSE) build

migrate: .env
	$(COMPOSE) run --rm --build migrate

down: .env
	$(COMPOSE) down

ps: .env
	$(COMPOSE) ps

logs: .env
	$(COMPOSE) logs --follow $(if $(SERVICE),"$(SERVICE)")

config: .env
	$(COMPOSE) config --quiet
	$(COMPOSE_DEV) config --quiet

health: .env
	$(COMPOSE) exec -T proxy wget -qO- http://127.0.0.1:8080/api/ready
	@printf '\n'

check:
	npm --prefix frontend run lint
	npm --prefix frontend run typecheck
