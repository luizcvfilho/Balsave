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

## Conectar suas contas com o Meu Pluggy

1. Entre no Meu Pluggy, adicione o banco e autorize o acesso. [Guia do Meu Pluggy](https://meu.pluggy.ai/api-guide)
2. Entre no Dashboard da Pluggy com a mesma conta. Em **Aplicações → sua aplicação → Demo**, selecione **Conectar conta → MeuPluggy** e autorize o acesso às conexões existentes. Se você personalizou os conectores disponíveis, habilite **MeuPluggy** na seção **Direct Connectors** do grupo **Pessoal**. [Configuração no Dashboard](https://docs.pluggy.ai/pt/docs/guides/meu-pluggy-personal-use)
3. Na seção **Itens conectados**, copie o `itemId` de cada banco. Use o Client ID e o Client Secret da mesma aplicação que recebeu os itens.
4. A partir da raiz do Valora, rode o comando e informe as credenciais da aplicação quando solicitado. Substitua `ITEM_ID` pelo ID copiado e repita para cada banco. Se `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` já estiverem no `.env` local, acrescente `--env-file ../.env` após `--locked`.

```sh
cd backend
uv run --locked python -m app.pluggy --meu-pluggy ITEM_ID
```

Após o vínculo inicial, o comando consulta a API diretamente. Ele mostra a quantidade de transações e os campos e tipos encontrados, sem exibir os lançamentos nem gravar no PostgreSQL. A autorização da aplicação dura um ano. Ao renovar, confira o `itemId` da conexão antes de repetir o comando. [Validade e renovação](https://docs.pluggy.ai/pt/docs/guides/meu-pluggy-personal-use)

## Explorar dados de teste da Pluggy

Crie uma aplicação de desenvolvimento e preencha `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` no `.env` local da raiz. Também é possível omitir `--env-file ../.env` e informar as credenciais no terminal. [Credenciais da aplicação](https://docs.pluggy.ai/en/docs/integration-checklist/api-keys)

```sh
cd backend
uv run --locked --env-file ../.env python -m app.pluggy --check-auth
uv run --locked --env-file ../.env python -m app.pluggy --create-sandbox
```

O primeiro comando autentica com as credenciais da aplicação. O segundo cria ou reutiliza uma conexão fictícia **Pluggy Bank** pela API e mostra os tipos de conta, a quantidade de transações e os campos observados em todas as páginas. Guarde o `itemId` exibido no terminal para repetir a consulta, passando `ITEM_ID` no lugar de `--create-sandbox`. [Criação de itens pela API](https://docs.pluggy.ai/en/reference/items/items-create) · [Sandbox](https://docs.pluggy.ai/en/docs/guides/sandbox)

No plano gratuito, a Pluggy exige o **Connect Widget** para criar itens. Depois de obter o `itemId` do item Sandbox conectado pelo widget, passe esse ID ao comando para consultar a API com as mesmas credenciais. [Regras de criação de itens](https://docs.pluggy.ai/en/reference/error-codes)

Para o esquema, use IDs próprios para contas e lançamentos do Valora e reserve vínculos para os IDs importados da Pluggy. Modele moeda e valor exato e considere a direção (`type`) e o estado (`status`) de cada movimento. Uma compra no cartão pode ter valor positivo e ser um débito. A presença dos campos varia conforme a instituição e o tipo de conta. [Contas](https://docs.pluggy.ai/en/docs/products/accounts) · [Transações](https://docs.pluggy.ai/en/docs/products/transactions)

## Estrutura

- `frontend/src/app/` contém as rotas, o layout e o CSS do painel em Next.js App Router, TypeScript e Tailwind. As configurações e o `package.json` ficam na raiz de `frontend/`. Os tokens e o logo são compartilhados a partir de `assets/`.
- `backend/` contém a API FastAPI, a conexão PostgreSQL via Psycopg e as migrações Alembic. As dependências são fixadas em `uv.lock`.
- `infra/` contém a configuração do Caddy e a inicialização da função PostgreSQL da API. O proxy é o único serviço com porta publicada e encaminha a interface e `/api` na mesma origem.
