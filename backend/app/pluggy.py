import argparse
import json
import os
import sys
import warnings
from collections import defaultdict
from collections.abc import Iterable, Iterator
from contextlib import closing
from datetime import UTC, datetime
from decimal import Decimal
from getpass import GetPassWarning, getpass
from http.client import HTTPException, HTTPSConnection
from time import monotonic, sleep
from typing import Any
from urllib.parse import urlencode
from uuid import UUID


MEU_PLUGGY_CONNECTOR_ID = 200


class PluggyError(Exception):
    pass


class PluggyAPIError(PluggyError):
    def __init__(self, endpoint: str, status: int, data: dict[str, Any]):
        super().__init__(f"A Pluggy retornou HTTP {status} em {endpoint}.")
        self.code = data.get("codeDescription")
        self.details = data.get("data")


def request(
    path: str,
    *,
    api_key: str | None = None,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    endpoint = path.split("?", 1)[0]
    if endpoint.startswith("/items/"):
        endpoint = "/items/{id}"
    headers = {"Accept": "application/json"}
    if api_key is not None:
        headers["X-API-KEY"] = api_key
    if body is not None:
        headers["Content-Type"] = "application/json"

    try:
        with closing(HTTPSConnection("api.pluggy.ai", timeout=15)) as connection:
            connection.request(
                "POST" if body is not None else "GET",
                path,
                body=json.dumps(body) if body is not None else None,
                headers=headers,
            )
            response = connection.getresponse()
            status = response.status
            raw_data = response.read()
    except (OSError, HTTPException):
        raise PluggyError(f"Falha na comunicação com a Pluggy em {endpoint}.") from None

    try:
        data = json.loads(raw_data, parse_float=Decimal)
    except ValueError:
        data = None

    if status != 200:
        raise PluggyAPIError(endpoint, status, data if isinstance(data, dict) else {})
    if not isinstance(data, dict):
        raise PluggyError(f"Resposta inesperada da Pluggy em {endpoint}.")
    return data


def results(response: dict[str, Any]) -> list[dict[str, Any]]:
    records = response.get("results")
    if not isinstance(records, list) or not all(isinstance(record, dict) for record in records):
        raise PluggyError("A Pluggy retornou uma lista de registros inválida.")
    return records


def transactions(account_id: str, api_key: str) -> Iterator[dict[str, Any]]:
    query = "?" + urlencode({"accountId": account_id})
    seen_queries = set()
    while True:
        if query in seen_queries:
            raise PluggyError("A Pluggy repetiu um cursor de transações.")
        seen_queries.add(query)
        page = request("/v2/transactions" + query, api_key=api_key)
        yield from results(page)

        next_query = page.get("next")
        if "next" in page and next_query is None:
            return
        if not isinstance(next_query, str) or not next_query.startswith("?"):
            raise PluggyError("A Pluggy retornou um cursor de transações inválido.")
        query = next_query


def describe(records: Iterable[dict[str, Any]]) -> dict[str, Any]:
    fields: dict[str, set[str]] = defaultdict(set)

    def visit(value: Any, path: str) -> None:
        if path:
            fields[path].add(type(value).__name__ if value is not None else "null")
        if isinstance(value, dict):
            for name, child in value.items():
                visit(child, f"{path}.{name}" if path else name)
        elif isinstance(value, list):
            for child in value:
                visit(child, f"{path}[]")

    count = 0
    for count, record in enumerate(records, start=1):
        visit(record, "")
    return {"count": count, "fields": {name: sorted(fields[name]) for name in sorted(fields)}}


def authenticate(client_id: str, client_secret: str) -> str:
    auth = request("/auth", body={"clientId": client_id, "clientSecret": client_secret})
    api_key = auth.get("apiKey")
    if not isinstance(api_key, str) or not api_key:
        raise PluggyError("A Pluggy não retornou uma chave de API válida.")
    return api_key


def create_sandbox(api_key: str) -> UUID:
    try:
        item = request("/items", api_key=api_key, body={
            "connectorId": 2,
            "parameters": {"user": "user-ok", "password": "password-ok"},
            "avoidDuplicates": True,
        })
        item_id = item.get("id")
    except PluggyAPIError as error:
        if error.code == "CREATE_ITEMS_API_FREE_DISABLED":
            raise PluggyError("Seu plano exige o Pluggy Connect Widget para criar itens.") from None
        if error.code != "ITEM_USER_ALREADY_EXISTS":
            raise
        ids = error.details.get("items") if isinstance(error.details, dict) else None
        item_id = ids[0] if isinstance(ids, list) and ids else None

    try:
        return UUID(str(item_id))
    except ValueError:
        raise PluggyError("A Pluggy não retornou um itemId válido para o Sandbox.") from None


def sandbox_item(item_id: UUID, api_key: str, *, wait: bool) -> dict[str, Any]:
    deadline = monotonic() + 60
    while True:
        item = request(f"/items/{item_id}", api_key=api_key)
        connector = item.get("connector")
        if not isinstance(connector, dict) or connector.get("isSandbox") is not True:
            raise PluggyError("Use o itemId de uma conexão criada com o conector Sandbox.")

        status = item.get("status")
        if status == "UPDATED":
            return item
        if status != "UPDATING":
            raise PluggyError("A sincronização do Sandbox terminou sem disponibilizar os dados.")
        if not wait or monotonic() >= deadline:
            raise PluggyError("O Sandbox ainda está sincronizando. Tente novamente com o mesmo itemId.")
        sleep(3)


def inspect_accounts(item_id: UUID, api_key: str) -> list[dict[str, Any]]:
    accounts = request("/accounts?" + urlencode({"itemId": item_id}), api_key=api_key)
    account_reports = []
    for account in results(accounts):
        account_id = account.get("id")
        if not isinstance(account_id, str) or not account_id:
            raise PluggyError("A Pluggy retornou uma conta sem identificador.")
        account_reports.append({
            "type": account.get("type"),
            "subtype": account.get("subtype"),
            "account": describe([account]),
            "transactions": describe(transactions(account_id, api_key)),
        })
    return account_reports


def inspect_sandbox(item_id: UUID, api_key: str, *, wait: bool = False) -> dict[str, Any]:
    item = sandbox_item(item_id, api_key, wait=wait)
    return {"executionStatus": item.get("executionStatus"), "accounts": inspect_accounts(item_id, api_key)}


def inspect_meu_pluggy(item_id: UUID, api_key: str) -> dict[str, Any]:
    item = request(f"/items/{item_id}", api_key=api_key)
    connector = item.get("connector")
    if not isinstance(connector, dict) or connector.get("id") != MEU_PLUGGY_CONNECTOR_ID:
        raise PluggyError("Use o itemId de uma conexão criada com o conector MeuPluggy no Dashboard.")

    error = item.get("error")
    expired = isinstance(error, dict) and error.get("code") == "USER_AUTHORIZATION_EXPIRED"
    consent_expires_at = item.get("consentExpiresAt")
    if consent_expires_at is not None and not expired:
        try:
            expiration = datetime.fromisoformat(consent_expires_at)
            expired = expiration <= datetime.now(UTC)
        except (ValueError, TypeError):
            raise PluggyError("A Pluggy retornou uma data de expiração de consentimento inválida.") from None
    if expired:
        raise PluggyError("O consentimento expirou. Reconecte o MeuPluggy no Dashboard e confira o novo itemId.")
    if item.get("status") != "UPDATED":
        raise PluggyError("O item do Meu Pluggy ainda não está pronto para leitura. Confira a conexão no Dashboard.")

    return {
        "executionStatus": item.get("executionStatus"),
        "consentExpiresAt": consent_expires_at,
        "accounts": inspect_accounts(item_id, api_key),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspeciona contas e transações pela API da Pluggy.")
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("item_id", type=UUID, nargs="?", metavar="ITEM_ID", help="Inspeciona um item do Sandbox.")
    action.add_argument("--meu-pluggy", type=UUID, metavar="ITEM_ID", help="Inspeciona um item do Meu Pluggy.")
    action.add_argument("--check-auth", action="store_true", help="Valida as credenciais da aplicação.")
    action.add_argument("--create-sandbox", action="store_true", help="Cria ou reutiliza um item de teste pela API.")
    args = parser.parse_args()

    try:
        client_id = os.getenv("PLUGGY_CLIENT_ID", "").strip()
        client_secret = os.getenv("PLUGGY_CLIENT_SECRET", "").strip()
        if not client_id:
            client_id = input("Client ID da Pluggy: ").strip()
        if not client_secret:
            with warnings.catch_warnings():
                warnings.simplefilter("error", GetPassWarning)
                client_secret = getpass("Client Secret da Pluggy: ").strip()
        if not client_id or not client_secret:
            raise PluggyError("Informe o Client ID e o Client Secret da aplicação no Dashboard da Pluggy.")

        api_key = authenticate(client_id, client_secret)
        if args.check_auth:
            print("Credenciais da Pluggy validadas.")
            return

        if args.meu_pluggy is not None:
            report = inspect_meu_pluggy(args.meu_pluggy, api_key)
        else:
            item_id = args.item_id
            if args.create_sandbox:
                item_id = create_sandbox(api_key)
                print(f"Item do Sandbox: {item_id}", file=sys.stderr)
            report = inspect_sandbox(item_id, api_key, wait=args.create_sandbox)
    except (EOFError, GetPassWarning):
        parser.exit(1, "Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET ou use um terminal interativo.\n")
    except PluggyError as error:
        parser.exit(1, f"{error}\n")

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
