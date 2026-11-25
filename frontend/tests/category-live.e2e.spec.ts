import { expect, type Page, test } from "@playwright/test";

const emailDomain = "@category-e2e.example.test";
const password = "balsave-category-browser-tests-only-password";

async function openCategoryCreator(page: Page) {
  await page.getByRole("button", { name: "Nova categoria", exact: true }).click();
  return page.getByRole("dialog", { name: "Nova categoria", exact: true });
}

async function openRuleCreator(page: Page) {
  await page.getByRole("button", { name: "Regras", exact: true }).click();
  await page.getByRole("button", { name: "Nova regra", exact: true }).click();
  return page.getByRole("dialog", { name: "Nova regra", exact: true });
}

async function signOut(page: Page) {
  const profile = page.getByRole("banner");
  await profile.getByLabel("Minha conta").click();
  await profile.getByRole("button", { name: "Sair", exact: true }).click();
}

for (const testPassword of ["x", "Ab#ç💠".repeat(1024)]) {
  test(`accepts a password of ${Array.from(testPassword).length} characters`, async ({ page, request }) => {
    await request.post("http://127.0.0.1:8106/reset");
    await page.goto("/acesso?modo=cadastro");
    await page.getByLabel("Nome", { exact: true }).fill("Teste de senha");
    await page.getByLabel("E-mail").fill(`teste-senha${emailDomain}`);
    await page.getByLabel("Senha", { exact: true }).fill(testPassword);
    await page.getByRole("button", { name: "Criar conta", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Conecte seus bancos" })).toBeVisible();

    await signOut(page);
    await expect(page.getByRole("heading", { name: "Acesse sua conta" })).toBeVisible();
    await page.getByLabel("E-mail").fill(`teste-senha${emailDomain}`);
    await page.getByLabel("Senha", { exact: true }).fill(testPassword);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Conecte seus bancos" })).toBeVisible();
  });
}

test("keeps categories and bank connections available through the main sections", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  const signIn = header.getByRole("link", { name: "Entrar", exact: true });
  await header.getByLabel("Minha conta").click();
  await expect(signIn).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  await nav.getByRole("link", { name: "Classificações", exact: true }).click();
  await expect(page).toHaveURL(/\/classificacoes$/);
  await expect(page.getByText("Dados fictícios", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nova categoria", exact: true })).toBeDisabled();
  await expect(signIn).toHaveCount(0);
  await page.getByRole("link", { name: "Etiquetas", exact: true }).click();
  await expect(page).toHaveURL(/\/classificacoes\?aba=etiquetas$/);
  await expect(page.getByRole("button", { name: "Nova etiqueta", exact: true })).toBeDisabled();
  await expect(nav.getByRole("link", { name: "Classificações", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: /^(Visão geral|Início)$/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Extrato", exact: true })).toBeVisible();

  await nav.getByRole("link", { name: "Contas", exact: true }).click();
  await page.getByRole("navigation", { name: "Detalhes de contas" }).getByRole("link", { name: "Conexões", exact: true }).click();
  await expect(page).toHaveURL(/\/conexoes$/);
  await expect(page.getByRole("heading", { name: "Conexões bancárias", exact: true })).toBeVisible();
  await expect(signIn).toHaveCount(0);
  await page.getByRole("link", { name: "Acessar minha conta", exact: true }).click();
  await expect(page).toHaveURL(/\/acesso$/);
});

test("registers, signs out and keeps two browser sessions independent", async ({ context, page, request }) => {
  await request.post("http://127.0.0.1:8106/reset");
  await page.goto("/");
  await expect(page.getByText("Dados fictícios", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Saldo em contas", exact: true })).toBeVisible();
  const signIn = page.getByRole("banner").getByRole("link", { name: "Entrar", exact: true });
  await page.getByRole("banner").getByLabel("Minha conta").click();
  await signIn.click();
  await expect(page).toHaveURL(/\/acesso$/);
  await expect(signIn).toHaveCount(0);
  await page.getByRole("link", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL(/\/acesso\?modo=cadastro$/);
  await page.getByLabel("Nome", { exact: true }).fill("Nova conta");
  await page.getByLabel("E-mail").fill(`BROWSER-OWNER${emailDomain}`);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.getByRole("region", { name: "Criar conta" }).getByRole("alert"))
    .toHaveText("Este e-mail já está cadastrado.");
  await page.getByLabel("Nome", { exact: true }).fill("Nova conta");
  await page.getByLabel("E-mail").fill(`nova-conta${emailDomain}`);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Conecte seus bancos" })).toBeVisible();
  const session = (await context.cookies()).find(cookie => cookie.name === "__Host-balsave-session");
  expect(session).toMatchObject({ httpOnly: true, secure: true, sameSite: "Strict", path: "/" });
  expect(await page.evaluate(() => document.cookie)).not.toContain("__Host-balsave-session");

  const otherContext = await context.browser()?.newContext();
  if (!otherContext) throw new Error("Expected an active browser");
  try {
    const otherPage = await otherContext.newPage();
    await otherPage.goto(new URL("/", page.url()).href);
    await otherPage.getByRole("banner").getByLabel("Minha conta").click();
    await otherPage.getByRole("banner").getByRole("link", { name: "Entrar", exact: true }).click();
    await expect(otherPage).toHaveURL(/\/acesso$/);
    await otherPage.getByLabel("E-mail").fill(`BROWSER-OWNER${emailDomain}`);
    await otherPage.getByLabel("Senha", { exact: true }).fill(password);
    await otherPage.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(otherPage.getByRole("heading", { name: "Saldo em contas", exact: true })).toBeVisible();
    await expect(otherPage.getByText("Dados do Meu Pluggy", { exact: true })).toBeVisible();
    await expect(otherPage.getByRole("link", { name: "Entrar", exact: true })).toHaveCount(0);

    await signOut(page);
    await expect(page.getByRole("heading", { name: "Acesse sua conta" })).toBeVisible();
    await page.goto("/lancamentos");
    await expect(page).toHaveURL(/\/acesso$/);
    await otherPage.reload();
    await expect(otherPage.getByRole("heading", { name: "Saldo em contas", exact: true })).toBeVisible();

    await page.getByLabel("E-mail").fill(`nova-conta${emailDomain}`);
    await page.getByLabel("Senha", { exact: true }).fill("incorrect-password");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByRole("region", { name: "Acesse sua conta" }).getByRole("alert"))
      .toHaveText("E-mail ou senha inválidos.");
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Conecte seus bancos" })).toBeVisible();

    await otherPage.goto(new URL("/lancamentos", page.url()).href);
    const privateEntry = otherPage.getByRole("link", { name: "Loja de equipamentos", exact: true });
    await expect(privateEntry).toBeVisible();
    await otherPage.goto("/classificacoes");
    await expect(otherPage).toHaveURL(/\/classificacoes$/);
    await signOut(otherPage);
    await expect(otherPage.getByRole("heading", { name: "Acesse sua conta" })).toBeVisible();
    await otherPage.getByLabel("E-mail").fill(`nova-conta${emailDomain}`);
    await otherPage.getByLabel("Senha", { exact: true }).fill(password);
    await otherPage.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(otherPage.getByRole("heading", { name: "Conecte seus bancos" })).toBeVisible();
    await otherPage.goBack();
    await expect(otherPage).toHaveURL(/\/lancamentos$/);
    await expect(otherPage.getByRole("heading", { name: "Conecte seus bancos" })).toBeVisible();
    await expect(privateEntry).toHaveCount(0);
  } finally {
    await otherContext.close();
  }
});

test.describe("authenticated category management", () => {
  test.skip(!process.env.BALSAVE_CATEGORY_E2E, "Run with the dedicated category browser configuration.");

  test.beforeEach(async ({ page, request }) => {
    await request.post("http://127.0.0.1:8106/reset");
    await page.goto("/acesso");
    await page.getByLabel("E-mail").fill(`browser-owner${emailDomain}`);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("refreshes another tab when the signed-in account changes", async ({ page, context }) => {
    await page.goto("/lancamentos");
    const privateEntry = page.getByRole("link", { name: "Loja de equipamentos", exact: true });
    await expect(privateEntry).toBeVisible();
    const other = await context.newPage();
    try {
      await other.goto("/");
      await signOut(other);
      await expect(page.getByRole("heading", { name: "Acesse sua conta" })).toBeVisible();
      await expect(privateEntry).toHaveCount(0);

      await other.goto("/acesso?modo=cadastro");
      await other.getByLabel("Nome", { exact: true }).fill("Nova conta");
      await other.getByLabel("E-mail").fill(`nova-conta${emailDomain}`);
      await other.getByLabel("Senha", { exact: true }).fill(password);
      await other.getByRole("button", { name: "Criar conta", exact: true }).click();
      await expect(other.getByRole("heading", { name: "Conecte seus bancos" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Conecte seus bancos" })).toBeVisible();
      await expect(privateEntry).toHaveCount(0);
    } finally {
      await other.close();
    }
  });

  test("rejects an old tab's category and logout actions after an account switch", async ({ page, context }) => {
    await page.addInitScript(() => Object.defineProperty(window, "BroadcastChannel", { value: undefined }));
    await page.goto("/classificacoes");
    const creator = await openCategoryCreator(page);
    await creator.getByLabel("Nome da categoria", { exact: true }).fill("Categoria da sessão anterior");
    const other = await context.newPage();
    try {
      await other.goto("/");
      await signOut(other);
      await expect(other.getByRole("heading", { name: "Acesse sua conta" })).toBeVisible();
      await other.goto("/acesso?modo=cadastro");
      await other.getByLabel("Nome", { exact: true }).fill("Nova conta");
      await other.getByLabel("E-mail").fill(`nova-conta${emailDomain}`);
      await other.getByLabel("Senha", { exact: true }).fill(password);
      await other.getByRole("button", { name: "Criar conta", exact: true }).click();
      await expect(other.getByRole("heading", { name: "Conecte seus bancos" })).toBeVisible();

      const sessionChanged = "Sua sessão mudou. Recarregue a página e tente novamente.";
      await creator.getByRole("button", { name: "Criar categoria", exact: true }).click();
      await expect(creator.getByRole("alert")).toHaveText(sessionChanged);
      await creator.getByRole("button", { name: "Cancelar", exact: true }).click();
      await signOut(page);
      await expect(page.getByRole("banner").getByRole("alert")).toHaveText(sessionChanged);
      await other.reload();
      await expect(other.getByRole("heading", { name: "Conecte seus bancos" })).toBeVisible();
    } finally {
      await other.close();
    }
  });

  test("rejects a category mutation with an untrusted origin", async ({ page }) => {
    await page.goto("/classificacoes");
    await page.route("**/classificacoes", async route => {
      const outgoing = route.request();
      if (outgoing.method() !== "POST") return route.continue();
      const origin = new URL(outgoing.url());
      origin.protocol = "https:";
      const response = await route.fetch({ headers: { ...await outgoing.allHeaders(), origin: origin.origin } });
      await route.fulfill({ response });
    });
    const creator = await openCategoryCreator(page);
    await creator.getByLabel("Nome da categoria", { exact: true }).fill("Categoria fora da origem");
    const post = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith("/classificacoes"));
    await creator.getByRole("button", { name: "Criar categoria", exact: true }).click();
    await post;
    await page.unroute("**/classificacoes");
    await page.reload();
    await expect(page.getByRole("button", { name: /^Categoria fora da origem/ })).toHaveCount(0);
  });

  test("creates, renames and archives personal categories while preserving a purchase choice", async ({ page }) => {
    await page.goto("/classificacoes");
    const creator = await openCategoryCreator(page);
    await creator.getByLabel("Nome da categoria", { exact: true }).fill("Escritório");
    await creator.getByRole("button", { name: "Criar categoria", exact: true }).click();
    await expect(creator).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Escritório/ })).toBeVisible();
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

    await page.goto("/classificacoes");
    await page.getByRole("button", { name: /^Escritório/ }).click();
    const category = page.getByRole("dialog", { name: "Editar categoria", exact: true });
    await category.getByLabel("Nome da categoria", { exact: true }).fill("Trabalho");
    await category.getByRole("button", { name: "Salvar nome", exact: true }).click();
    await expect(category).toHaveCount(0);
    await page.getByRole("button", { name: /^Trabalho/ }).click();
    await category.getByRole("button", { name: "Arquivar", exact: true }).click();
    await expect(page.getByRole("button", { name: /Trabalho.*Arquivada/ })).toBeVisible();

    await page.goto("/lancamentos?lancamento=10000000-0000-0000-0000-000000000001.20000000-0000-0000-0000-000000000001");
    await expect(editor.getByText("Classificada por você · Trabalho", { exact: true })).toBeVisible();
    await expect(editor.getByLabel("Nova categoria da compra")).toHaveValue(selected);
    await expect(editor.getByRole("button", { name: "Salvar categoria", exact: true })).toBeDisabled();
    await editor.getByRole("button", { name: "Restaurar classificação automática", exact: true }).click();
    await expect(editor.getByText("Classificada automaticamente pelo Pluggy · Compras", { exact: true })).toBeVisible();
  });

  test("reports duplicate names and manages categories during a provider failure", async ({ page, request }) => {
    await request.post("http://127.0.0.1:8106/controls", { data: { snapshotUnavailable: true } });
    await page.goto("/classificacoes");
    const creator = await openCategoryCreator(page);
    await creator.getByLabel("Nome da categoria", { exact: true }).fill("Compras");
    await creator.getByRole("button", { name: "Criar categoria", exact: true }).click();
    await expect(creator.getByRole("alert")).toHaveText("Já existe uma categoria com esse nome. Escolha outro nome.");
    await creator.getByLabel("Nome da categoria", { exact: true }).fill("Casa");
    await creator.getByRole("button", { name: "Criar categoria", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Casa/ })).toBeVisible();
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
    await page.getByRole("link", { name: "Balsave, visão geral", exact: true }).click();
    await expect(spending.getByRole("link", { name: /^Alimentação/ })).toBeVisible();
    await expect(spending.getByRole("link", { name: /^Compras/ })).toHaveCount(0);
  });

  test("assigns, creates and removes a category inline, then restores automatic classification", async ({ page }) => {
    await page.goto("/lancamentos");
    const category = page.getByRole("button", { name: /^Alterar categoria de Loja de equipamentos/ });
    const chevron = page.locator('button[aria-label^="Alterar categoria de Loja de equipamentos"] svg:has(path[d="m6 9 6 6 6-6"])');
    await expect(chevron).toBeVisible();
    await expect(chevron).toHaveCSS("width", "14px");
    const picker = page.getByRole("dialog", { name: "Classificação", exact: true });
    await category.click();
    await expect(chevron).toHaveCSS("transform", "matrix(-1, 0, 0, -1, 0, 0)");
    await picker.getByRole("searchbox").fill("alimentacao");
    await picker.getByRole("button", { name: "Alimentação", exact: true }).click();
    await expect(category).toHaveText(/Alimentação/);
    await expect(chevron).toHaveCSS("transform", "none");
    await category.click();
    await picker.getByRole("searchbox").fill("Papelaria");
    await picker.getByRole("searchbox").press("Enter");
    await expect(picker).not.toBeVisible();
    await expect(category).toHaveText(/Papelaria/);
    await category.click();
    await picker.getByRole("button", { name: "Remover categoria", exact: true }).click();
    await expect(category).toHaveAccessibleName(/Sem categoria/);
    await page.reload();
    await expect(category).toHaveText(/Adicionar categoria/);
    await category.click();
    await picker.getByRole("button", { name: "Usar classificação automática", exact: true }).click();
    await expect(category).toHaveText(/Compras/);
  });

  test("deletes a custom category and restores the purchase's previous category", async ({ page }) => {
    await page.goto("/lancamentos");
    const trigger = page.getByRole("button", { name: /^Alterar categoria de Loja de equipamentos/ });
    await expect(trigger).toHaveText(/Compras/);
    await trigger.click();
    const picker = page.getByRole("dialog", { name: "Classificação", exact: true });
    await picker.getByRole("searchbox").fill("Temporária");
    await picker.getByRole("searchbox").press("Enter");
    await expect(trigger).toHaveText(/Temporária/);

    await page.goto("/classificacoes");
    const editor = page.getByRole("dialog", { name: "Editar categoria", exact: true });
    await page.getByRole("button", { name: /^Compras/ }).click();
    await expect(editor.getByRole("button", { name: "Excluir categoria" })).toHaveCount(0);
    await editor.getByRole("button", { name: "Cancelar", exact: true }).click();
    await page.getByRole("button", { name: /^Temporária/ }).click();
    await editor.getByRole("button", { name: "Excluir categoria", exact: true }).click();
    const confirmation = page.getByRole("dialog", { name: "Excluir categoria", exact: true });
    await confirmation.getByRole("button", { name: "Confirmar exclusão" }).click();
    await expect(confirmation).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Temporária/ })).toHaveCount(0);
    await page.goto("/lancamentos");
    await expect(trigger).toHaveText(/Compras/);
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
    await page.goto("/classificacoes");
    const creator = await openRuleCreator(page);
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
    const rules = page.getByRole("region", { name: "Regras pessoais", exact: true });
    await expect(rules.getByRole("listitem")).toHaveCount(1);
    await page.goto("/lancamentos?lancamento=10000000-0000-0000-0000-000000000001.20000000-0000-0000-0000-000000000001");
    await expect(page.getByText("Classificada por uma regra pessoal · Alimentação", { exact: true })).toBeVisible();
    await page.goto("/classificacoes");
    await page.getByRole("button", { name: "Regras", exact: true }).click();
    await rules.getByRole("button", { name: /^Loja/ }).click();
    const editor = page.getByRole("dialog", { name: "Editar regra", exact: true });
    await editor.getByRole("button", { name: "Desativar regra", exact: true }).click();
    await expect(rules.getByRole("button", { name: /Loja.*Desativada/ })).toBeVisible();
    await rules.getByRole("button", { name: /^Loja/ }).click();
    await expect(editor.getByRole("button", { name: "Salvar regra", exact: true })).toBeDisabled();
    await editor.getByRole("button", { name: "Revisar compras afetadas", exact: true }).click();
    await editor.getByRole("button", { name: "Salvar regra", exact: true }).click();
    await expect(rules.getByRole("button", { name: /Loja.*Ativa/ })).toBeVisible();
    await rules.getByRole("button", { name: /^Loja/ }).click();
    await editor.getByRole("button", { name: "Remover regra", exact: true }).click();
    await editor.getByRole("button", { name: "Confirmar remoção", exact: true }).click();
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
    await page.goto("/classificacoes");
    const creator = await openRuleCreator(page);
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
    const details = page.getByRole("region", { name: "Saída", exact: true });
    await expect(details.getByText("Banco fictício")).toBeVisible();
    await expect(details.getByText("Conta de teste", { exact: true })).toBeVisible();
  });
});
