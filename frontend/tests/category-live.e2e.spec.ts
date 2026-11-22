import { expect, test } from "@playwright/test";

test.describe("authenticated category management", () => {
  test.skip(!process.env.BALSAVE_CATEGORY_E2E, "Run with the dedicated category browser configuration.");

  test.beforeEach(async ({ page, request }) => {
    await request.post("http://127.0.0.1:8106/reset");
    await page.goto("/acesso");
    await page.getByLabel("Senha de acesso").fill("balsave-category-browser-tests-only-password");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Acesse seu painel" })).toHaveCount(0);
  });

  test("creates, renames and archives personal categories while preserving a purchase choice", async ({ page }) => {
    await page.goto("/categorias");
    const creator = page.getByRole("region", { name: "Criar categoria", exact: true });
    await creator.getByLabel("Nome da categoria", { exact: true }).fill("Escritório");
    await creator.getByRole("button", { name: "Criar categoria", exact: true }).click();
    await expect(creator.getByRole("status")).toHaveText("Categoria criada.");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.goto("/gastos?mes=2026-11");
    await page.getByRole("link", { name: "Alterar categoria de Loja de equipamentos" }).click();
    const editor = page.getByRole("region", { name: "Categoria da compra", exact: true });
    await editor.getByLabel("Buscar categoria").fill("escri");
    await editor.getByLabel("Nova categoria da compra").selectOption({ label: "Escritório" });
    const selected = await editor.getByLabel("Nova categoria da compra").inputValue();
    await editor.getByRole("button", { name: "Salvar categoria", exact: true }).click();
    await expect(editor.getByText("Classificada por você · Escritório", { exact: true })).toBeVisible();
    await expect(editor.getByText("Categoria de origem: Eletrônicos.", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.reload();
    await expect(editor.getByLabel("Nova categoria da compra")).toHaveValue(selected);

    await page.goto("/categorias");
    await page.getByLabel("Nome de Escritório", { exact: true }).fill("Trabalho");
    let category = page.getByRole("listitem").filter({ has: page.getByLabel("Nome de Escritório", { exact: true }) });
    await category.getByRole("button", { name: "Salvar nome", exact: true }).click();
    await expect(page.getByLabel("Nome de Trabalho", { exact: true })).toBeVisible();
    category = page.getByRole("listitem").filter({ has: page.getByLabel("Nome de Trabalho", { exact: true }) });
    await category.getByRole("button", { name: "Arquivar", exact: true }).click();
    await expect(category.getByRole("button", { name: "Reativar", exact: true })).toBeVisible();

    await page.goto("/lancamentos?lancamento=10000000-0000-0000-0000-000000000001.20000000-0000-0000-0000-000000000001");
    await expect(editor.getByText("Classificada por você · Trabalho", { exact: true })).toBeVisible();
    await expect(editor.getByLabel("Nova categoria da compra")).toHaveValue(selected);
    await expect(editor.getByRole("button", { name: "Salvar categoria", exact: true })).toBeDisabled();
    await editor.getByRole("button", { name: "Restaurar classificação automática", exact: true }).click();
    await expect(editor.getByText("Classificada automaticamente pelo Pluggy · Compras", { exact: true })).toBeVisible();
  });

  test("reports duplicate names and manages categories during a provider failure", async ({ page, request }) => {
    await request.post("http://127.0.0.1:8106/controls", { data: { snapshotUnavailable: true } });
    await page.goto("/categorias");
    const creator = page.getByRole("region", { name: "Criar categoria", exact: true });
    await creator.getByLabel("Nome da categoria", { exact: true }).fill("Compras");
    await creator.getByRole("button", { name: "Criar categoria", exact: true }).click();
    await expect(creator.getByRole("alert")).toHaveText("Já existe uma categoria com esse nome. Escolha outro nome.");
    await creator.getByLabel("Nome da categoria", { exact: true }).fill("Casa");
    await creator.getByRole("button", { name: "Criar categoria", exact: true }).click();
    await expect(page.getByLabel("Nome de Casa", { exact: true })).toBeVisible();
  });

  test("refreshes a previously visited dashboard after a manual reclassification", async ({ page }) => {
    await page.goto("/");
    const spending = page.getByRole("region", { name: "Gastos por categoria", exact: true });
    await spending.getByRole("link", { name: /^Compras/ }).click();
    await page.getByRole("link", { name: "Alterar categoria de Loja de equipamentos" }).click();
    const editor = page.getByRole("region", { name: "Categoria da compra", exact: true });
    await editor.getByLabel("Nova categoria da compra").selectOption({ label: "Alimentação" });
    await editor.getByRole("button", { name: "Salvar categoria", exact: true }).click();
    await expect(editor.getByText("Classificada por você · Alimentação", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Balsave, início", exact: true }).click();
    await expect(spending.getByRole("link", { name: /^Alimentação/ })).toBeVisible();
    await expect(spending.getByRole("link", { name: /^Compras/ })).toHaveCount(0);
  });

  test("explains that a changed transaction needs a refresh", async ({ page, request }) => {
    await page.goto("/lancamentos?lancamento=10000000-0000-0000-0000-000000000001.20000000-0000-0000-0000-000000000001");
    await request.post("http://127.0.0.1:8106/controls", { data: { assignmentConflict: true } });
    const editor = page.getByRole("region", { name: "Categoria da compra", exact: true });
    await editor.getByLabel("Nova categoria da compra").selectOption({ label: "Alimentação" });
    await editor.getByRole("button", { name: "Salvar categoria", exact: true }).click();
    await expect(editor.getByRole("alert")).toHaveText("Este lançamento mudou. Atualize a página antes de alterar a categoria.");
  });

  test("previews rule history scope and supports disabling, reactivating and removing a rule", async ({ page }) => {
    await page.goto("/categorias");
    const creator = page.getByRole("region", { name: "Criar regra pessoal", exact: true });
    await creator.getByLabel("Categoria da regra").selectOption({ label: "Alimentação" });
    await creator.getByRole("combobox", { name: "Descrição da compra", exact: true }).selectOption("contains");
    await creator.getByLabel("Texto para identificar a compra").fill("Loja");
    await creator.getByLabel("Prioridade da regra").fill("10");
    await expect(creator.getByRole("button", { name: "Criar regra", exact: true })).toBeDisabled();
    await creator.getByRole("button", { name: "Revisar compras afetadas", exact: true }).click();
    await expect(creator.getByText("0 compras serão reclassificadas entre os lançamentos disponíveis.", { exact: true })).toBeVisible();
    await creator.getByLabel("Aplicar a compras de").selectOption("history");
    await expect(creator.getByRole("button", { name: "Criar regra", exact: true })).toBeDisabled();
    await creator.getByRole("button", { name: "Revisar compras afetadas", exact: true }).click();
    await expect(creator.getByText("1 compra será reclassificada entre os lançamentos disponíveis.", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await creator.getByRole("button", { name: "Criar regra", exact: true }).click();
    const rules = page.getByRole("region", { name: "Minhas regras", exact: true });
    await expect(rules.getByRole("listitem")).toHaveCount(1);
    await page.goto("/lancamentos?lancamento=10000000-0000-0000-0000-000000000001.20000000-0000-0000-0000-000000000001");
    await expect(page.getByText("Classificada por uma regra pessoal · Alimentação", { exact: true })).toBeVisible();
    await page.goto("/categorias");
    await rules.getByRole("button", { name: "Desativar regra", exact: true }).click();
    await expect(rules.getByText("Desativada", { exact: true })).toBeVisible();
    await rules.getByRole("button", { name: "Editar e reativar", exact: true }).click();
    await expect(rules.getByRole("button", { name: "Salvar regra", exact: true })).toBeDisabled();
    await rules.getByRole("button", { name: "Revisar compras afetadas", exact: true }).click();
    await rules.getByRole("button", { name: "Salvar regra", exact: true }).click();
    await expect(rules.getByText("Ativa", { exact: true })).toBeVisible();
    await rules.getByRole("button", { name: "Remover regra", exact: true }).click();
    await rules.getByRole("button", { name: "Confirmar remoção", exact: true }).click();
    await expect(rules.getByText("Nenhuma regra criada.", { exact: true })).toBeVisible();
  });

  test("creates a rule deliberately from a purchase and preserves its manual category", async ({ page }) => {
    await page.goto("/lancamentos?lancamento=10000000-0000-0000-0000-000000000001.20000000-0000-0000-0000-000000000001");
    const editor = page.getByRole("region", { name: "Categoria da compra", exact: true });
    await editor.getByLabel("Nova categoria da compra").selectOption({ label: "Alimentação" });
    await editor.getByRole("button", { name: "Salvar categoria", exact: true }).click();
    await expect(editor.getByText("Classificada por você · Alimentação", { exact: true })).toBeVisible();
    await editor.getByRole("button", { name: "Usar esta categoria em compras semelhantes", exact: true }).click();
    await expect(editor.getByLabel("Texto para identificar a compra")).toHaveValue("Loja de equipamentos");
    await editor.getByLabel("Aplicar a compras de").selectOption("history");
    await editor.getByRole("button", { name: "Revisar compras afetadas", exact: true }).click();
    await expect(editor.getByText("1 escolha manual será preservada.", { exact: true })).toBeVisible();
    await editor.getByRole("button", { name: "Criar regra", exact: true }).click();
    await expect(editor.getByText("Classificada por você · Alimentação", { exact: true })).toBeVisible();
    await editor.getByRole("button", { name: "Restaurar classificação automática", exact: true }).click();
    await expect(editor.getByText("Classificada por uma regra pessoal · Alimentação", { exact: true })).toBeVisible();
  });

  test("requires a new review when data changes after the rule preview", async ({ page, request }) => {
    await page.goto("/categorias");
    const creator = page.getByRole("region", { name: "Criar regra pessoal", exact: true });
    await creator.getByLabel("Categoria da regra").selectOption({ label: "Alimentação" });
    await creator.getByLabel("Texto para identificar a compra").fill("Loja de equipamentos");
    await creator.getByLabel("Aplicar a compras de").selectOption("history");
    await creator.getByRole("button", { name: "Revisar compras afetadas", exact: true }).click();
    await expect(creator.getByRole("button", { name: "Criar regra", exact: true })).toBeEnabled();
    await request.post("http://127.0.0.1:8106/controls", { data: { assignment: "30000000-0000-0000-0000-000000000002" } });
    await creator.getByRole("button", { name: "Criar regra", exact: true }).click();
    await expect(creator.getByRole("alert")).toHaveText("Os dados da prévia mudaram. Revise as compras afetadas novamente antes de salvar.");
    await expect(creator.getByRole("button", { name: "Criar regra", exact: true })).toBeDisabled();
  });

  test("loads authenticated financial data without real credentials", async ({ page }) => {
    await page.goto("/lancamentos?lancamento=10000000-0000-0000-0000-000000000001.20000000-0000-0000-0000-000000000001");
    await expect(page.getByRole("heading", { name: "Loja de equipamentos", exact: true })).toBeVisible();
    await expect(page.getByText("Banco fictício · Conta de teste", { exact: true })).toBeVisible();
  });
});
