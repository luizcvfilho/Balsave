import { expect, test } from "@playwright/test";

const fixture = "http://127.0.0.1:8106";

function entryId(suffix: number) {
  return `10000000-0000-0000-0000-000000000001.20000000-0000-0000-0000-00000000000${suffix}`;
}

test("splits imported expenses and reports only the owner's net expense", async ({ page, request }) => {
  test.setTimeout(60_000);
  expect((await request.post(`${fixture}/reset`)).ok()).toBe(true);
  expect((await request.post(`${fixture}/controls`, { data: { receivablesEnabled: true } })).ok()).toBe(true);
  await page.goto("/acesso");
  await page.getByLabel("E-mail").fill("browser-owner@category-e2e.example.test");
  await page.getByLabel("Senha", { exact: true }).fill("balsave-category-browser-tests-only-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto(`/lancamentos?lancamento=${entryId(2)}`);
  await page.getByRole("button", { name: "Definir valores a receber" }).click();
  for (const [index, name] of ["Ana", "Bruno"].entries()) {
    await page.getByRole("button", { name: "Adicionar pessoa" }).click();
    await page.getByLabel(`Nome ${index + 1}`, { exact: true }).fill(name);
  }
  const includeSelf = page.getByRole("checkbox", { name: "Incluir minha parte na divisão" });
  const split = page.getByRole("button", { name: "Dividir igualmente", exact: true });
  const amounts = page.getByLabel("Valor a receber (R$)", { exact: true });
  await includeSelf.uncheck();
  await split.click();
  await expect(amounts.nth(0)).toHaveValue("50,00");
  await expect(amounts.nth(1)).toHaveValue("50,00");
  await includeSelf.check();
  await split.click();
  for (const amount of await amounts.all()) {
    await expect(amount).toHaveValue(/^33,3[34]$/);
    await amount.fill("33,33");
  }
  await page.getByRole("button", { name: "Salvar valores" }).click();
  await expect(page.getByText("Valores a receber salvos.")).toBeVisible();

  for (const [credit, name] of [[3, "Ana"], [4, "Bruno"]] as const) {
    await page.goto(`/lancamentos?lancamento=${entryId(credit)}`);
    await page.getByRole("button", { name: "Vincular a uma despesa" }).click();
    await page.getByRole("combobox", { name: "Despesa", exact: true }).selectOption(entryId(2));
    await page.getByRole("combobox", { name: "Pessoa (opcional)", exact: true }).selectOption({ label: name });
    await page.getByRole("button", { name: "Salvar vínculo" }).click();
    await expect(page.getByText("Vínculo atual: Jantar dividido", { exact: true })).toBeVisible();
  }

  await page.goto(`/lancamentos?lancamento=${entryId(6)}`);
  await page.getByRole("button", { name: "Vincular a uma despesa" }).click();
  await page.getByRole("combobox", { name: "Despesa", exact: true }).selectOption(entryId(5));
  await page.getByRole("button", { name: "Salvar vínculo" }).click();
  await expect(page.getByText("Vínculo atual: Compra da empresa", { exact: true })).toBeVisible();

  await page.goto("/lancamentos");
  await page.getByRole("navigation", { name: "Detalhes de lançamentos" }).getByRole("link", { name: "A receber" }).click();
  await expect(page).toHaveURL(/\/a-receber$/);
  await expect(page.getByRole("link", { name: /Jantar dividido/ })).toBeVisible();
  await expect(page.getByText(/Aplicado a: Ana.*Bruno/)).toBeVisible();
  await expect(page.getByText(/^R\$\s3,34$/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("link", { name: /Jantar dividido/ }).click();
  await expect(page.getByRole("heading", { name: "Detalhe do lançamento" })).toBeVisible();
  await page.getByRole("link", { name: "Voltar para A receber" }).click();
  await expect(page).toHaveURL(/\/a-receber$/);

  await page.goto("/gastos?mes=2026-10");
  await expect(page.getByRole("link", { name: "Jantar dividido", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Compra da empresa", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Compras no período" }).locator("dl").getByText(/^R\$\s33,34$/)).toBeVisible();
  await page.getByLabel("Valor", { exact: true }).selectOption({ label: "Bruto" });
  await expect(page.getByRole("link", { name: "Compra da empresa", exact: true })).toBeVisible();

  expect((await request.post(`${fixture}/controls`, { data: { missingCredit: true } })).ok()).toBe(true);
  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "A receber" }).click();
  await expect(page).toHaveURL(/\/a-receber$/);
  await expect(page.getByText("Crédito indisponível", { exact: true })).toBeVisible();
  await expect(page.getByText(/parte do valor vinculado está indisponível/)).toBeVisible();
});
