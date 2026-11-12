.DEFAULT_GOAL := help

COMPOSE := docker compose -f compose.yaml
COMPOSE_DEV := $(COMPOSE) -f compose.dev.yaml

.PHONY: help env dev up build migrate down ps logs config health check

help:
	@printf '%-26s %s\n' \
		'make env' 'Gera o .env local na primeira execução' \
		'make dev' 'Sobe com recarga automática e acompanha os logs' \
		'make up' 'Sobe o build de produção em segundo plano' \
		'make build' 'Constrói as imagens da configuração base' \
		'make migrate' 'Aplica as migrações pendentes do banco' \
		'make down' 'Encerra a pilha e preserva o volume do banco' \
		'make ps' 'Mostra o estado dos serviços' \
		'make logs [SERVICE=backend]' 'Acompanha os logs de um serviço ou da pilha' \
		'make config' 'Valida as duas configurações do Compose' \
		'make health' 'Verifica a API e o banco pelo proxy' \
		'make check' 'Roda lint e checagem de tipos do frontend'

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
