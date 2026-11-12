# Valora

Aplicação web de finanças pessoais em pt-BR e BRL. A versão inicial apresenta um painel com dados fictícios.

## Executar localmente

Use Make, Docker com o plugin Compose v2 e `openssl`. Na primeira execução, o Makefile gera um `.env` local com senhas distintas para a administração do PostgreSQL e para a API.

```sh
make dev
```

`make dev` combina `compose.yaml` e `compose.dev.yaml` para ativar a recarga automática do frontend e da API. Abra o painel em <http://localhost:8080>. A API atende em `/api`, com documentação em `/api/docs`.

| Comando | Uso |
| --- | --- |
| `make up` | Subir o build de produção em segundo plano. |
| `make migrate` | Aplicar as migrações pendentes do PostgreSQL. |
| `make ps` | Ver o estado dos serviços. |
| `make logs SERVICE=backend` | Acompanhar os logs da API. Use `make logs` para a pilha inteira. |
| `make health` | Consultar `/api/ready` pelo Caddy e verificar a conexão com o banco. |
| `make down` | Encerrar a pilha e preservar o volume `postgres_data`. |
| `make help` | Listar os comandos disponíveis. |

O PostgreSQL aplica as senhas na primeira inicialização do volume. Se precisar trocá-las depois, atualize também as senhas das funções no banco.

Para conferir o protótipo no Safari do iPhone, defina `VALORA_BIND_ADDRESS=0.0.0.0` no `.env`, execute `make up` e abra `http://<IP-do-computador>:8080` no iPhone conectado à mesma rede. Use essa configuração com os dados fictícios do protótipo. A configuração padrão escuta apenas na interface local.

## Verificações locais

Para verificar o frontend localmente com Node.js 24, rode os comandos abaixo a partir da raiz. Para sincronizar o ambiente do backend, use `cd backend && uv sync --locked` com Python 3.14.

```sh
npm --prefix frontend ci
make check
npm --prefix frontend run build
```

## Migrações do banco

`make dev` e `make up` aguardam o PostgreSQL e aplicam as migrações do Alembic antes de iniciar a API. O serviço `migrate` usa a conta `postgres` para alterar a estrutura. A API usa `valora_app`, que recebe as permissões de acesso aos dados.

A primeira revisão cria o esquema `valora` para as tabelas da aplicação e dá à API permissão para acessar esse esquema. As revisões ficam em `backend/migrations/versions/`. Para criar uma revisão a partir da raiz e aplicá-la após editar o arquivo gerado, use os comandos abaixo.

```sh
(cd backend && uv run --locked alembic revision -m "descreva a mudança")
# Edite a revisão gerada antes de aplicar.
make migrate
```

## Estrutura

- `frontend/src/app/` contém as rotas, o layout e o CSS do painel em Next.js App Router, TypeScript e Tailwind. As configurações e o `package.json` ficam na raiz de `frontend/`. Os tokens e o logo são compartilhados a partir de `assets/`.
- `backend/` contém a API FastAPI, a conexão PostgreSQL via Psycopg e as migrações Alembic. As dependências são fixadas em `uv.lock`.
- `infra/` contém a configuração do Caddy e a inicialização da função PostgreSQL da API. O proxy é o único serviço com porta publicada e encaminha a interface e `/api` na mesma origem.
