import { expect as baseExpect, test } from "@playwright/test";

const expect = baseExpect.configure({ timeout: 20_000 });

test("edits investment composition and confirms transfers from their respective details", async ({ page, request }) => {
  test.setTimeout(120_000);
  await request.post("http://127.0.0.1:8106/reset");
  await request.post("http://127.0.0.1:8106/controls", { data: { reconciliationEnabled: true } });
  await page.goto("/acesso", { waitUntil: "domcontentloaded" });
  await page.getByLabel("E-mail").fill("browser-owner@category-e2e.example.test");
  await page.getByLabel("Senha", { exact: true }).fill("balsave-category-browser-tests-only-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect.poll(async () => (await page.context().cookies()).some(cookie => cookie.name === "__Host-balsave-session")).toBe(true);

  for (const path of ["/contas?aba=conciliacao", "/cartoes", "/conexoes"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const navigation = page.getByRole("navigation", { name: "Detalhes de contas" });
    await expect(navigation.getByRole("link", { name: "Contas", exact: true })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Conciliação", exact: true })).toHaveCount(0);
  }

  await page.goto("/contas", { waitUntil: "domcontentloaded" });
  const investments = page.getByRole("region", { name: "Investimentos", exact: true });
  await expect(investments.getByText(/R\$\s*1\.900,00/)).toBeVisible();
  await investments.getByRole("link", { name: "Fundo de teste", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Fundo de teste", exact: true })).toBeVisible();
  const composition = page.getByLabel("Este investimento já está incluído no saldo de uma conta?");
  await composition.selectOption({ label: "Incluído em Banco fictício · Conta de teste" });
  await page.getByRole("button", { name: "Salvar composição" }).click();
  await expect(page.getByText("Composição salva.")).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(composition.locator("option:checked")).toHaveText("Incluído em Banco fictício · Conta de teste");
  await page.getByRole("link", { name: /Voltar às contas/ }).click();
  await expect(investments.getByText(/R\$\s*1\.500,00/)).toBeVisible();

  await page.goto("/lancamentos", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Aplicação no fundo", exact: true }).click();
  await page.getByText("Revisar movimentação", { exact: true }).click();
  await expect(page.getByText("Envio para o fundo", { exact: true })).toBeVisible();
  await expect(page.getByText("Banco fictício · Conta de teste · 13/11/2026", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar transferência interna" }).click();
  await expect(page.getByText("Movimentação confirmada", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Voltar aos lançamentos/ }).click();
  await page.getByRole("link", { name: "Envio para o fundo", exact: true }).click();
  await page.getByText("Movimentação confirmada", { exact: true }).click();
  await expect(page.getByText("Aplicação no fundo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Desfazer confirmação" }).click();
  await expect(page.getByText("Revisar movimentação", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: /Voltar aos lançamentos/ }).click();
  await page.getByRole("link", { name: "Resgate automático pendente", exact: true }).click();
  await page.getByText("Revisar movimentação", { exact: true }).click();
  await page.getByRole("button", { name: "Confirmar movimentação já incluída no saldo" }).click();
  await expect(page.getByText("Incluída no saldo da conta.")).toBeVisible();

  await page.getByRole("link", { name: /Voltar aos lançamentos/ }).click();
  await page.getByRole("link", { name: "Aplicação reconhecida", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Aplicação reconhecida", exact: true })).toBeVisible();
  await expect(page.getByText("Revisar movimentação", { exact: true })).toHaveCount(0);
});
