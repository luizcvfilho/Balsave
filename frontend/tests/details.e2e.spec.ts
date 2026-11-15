import { expect, test } from "@playwright/test";

test("opens the month and category from the dashboard and keeps the month on return", async ({ page }) => {
  await page.goto("/");
  const categories = page.getByRole("region", { name: "Gastos por categoria" });
  await categories.getByRole("combobox").selectOption("2026-10");
  const food = categories.getByRole("link", { name: /^Alimentação/ });
  await expect(food).toHaveAttribute("href", /mes=2026-10/);
  await food.click();

  await expect(page.getByRole("heading", { name: "Gastos por categoria", exact: true })).toBeVisible();
  await expect(page.getByLabel("Período", { exact: true })).toHaveValue("2026-10");
  await expect(page.getByLabel("Categoria", { exact: true })).toHaveValue("Alimentação");
  const purchases = page.getByRole("table", { name: "Compras por categoria" });
  await expect(purchases.getByRole("link", { name: "Supermercado" })).toHaveCount(2);
  await expect(purchases.getByRole("link", { name: "Farmácia" })).toHaveCount(0);
  await page.getByLabel("Ordenar por").selectOption("highest");
  await expect(purchases.getByRole("link").first()).toHaveText("Supermercado");
  await page.getByLabel("Buscar lançamentos").fill("restaurante");
  await expect(purchases.getByRole("link")).toHaveCount(2);
  await page.getByLabel("Período", { exact: true }).selectOption("personalizado");
  await page.getByLabel("Data inicial").fill("2026-10-20");
  await page.getByLabel("Data final").fill("2026-10-25");
  await expect(purchases.getByRole("link")).toHaveCount(1);
  await expect(purchases.getByText("24/10/2026")).toBeVisible();
  await page.getByRole("link", { name: "Voltar ao painel" }).click();
  await expect(categories.getByRole("combobox")).toHaveValue("2026-10");
});

test("uses the selected pace day for daily purchases and the net category breakdown", async ({ page }) => {
  await page.goto("/");
  const slider = page.getByRole("slider", { name: "Dia do mês no gráfico de ritmo de gastos" });
  await slider.focus();
  await slider.press("Home");
  await slider.press("ArrowRight");
  await page.getByRole("link", { name: "Ver detalhes de Ritmo de gastos" }).click();

  await expect(slider).toHaveAttribute("aria-valuetext", /Dia 2 de novembro/);
  const day = page.getByRole("region", { name: "Gastos do dia" });
  await expect(day.getByRole("link", { name: "Supermercado" })).toBeVisible();
  await slider.press("ArrowRight");
  await expect(day.getByText("Nenhum gasto neste dia.")).toBeVisible();
  await page.getByRole("region", { name: "Categorias no acumulado" }).getByRole("link", { name: "Alimentação" }).click();
  await expect(page.getByLabel("Data final")).toHaveValue("2026-11-03");
  await expect(page.getByRole("table").getByRole("link")).toHaveCount(1);
});

test("shows an institution's accounts, date-filtered statement, and balance evolution", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("region", { name: "Saldo em contas", exact: true }).getByRole("link", { name: "Itaú" }).click();
  await expect(page.getByLabel("Instituição")).toHaveValue("Itaú");
  await page.getByRole("link", { name: "Ver extrato de Itaú · Conta corrente" }).click();
  const statement = page.getByRole("table", { name: "Extrato da conta" });
  await expect(statement.getByRole("link", { name: "Pagamento de fatura" })).toBeVisible();
  await page.getByLabel("Movimentação").selectOption("in");
  await expect(statement.getByRole("link", { name: "Salário" })).toBeVisible();
  await expect(statement.getByRole("link", { name: "Reembolso do hotel" })).toBeVisible();
  await expect(statement.getByRole("link", { name: "Pagamento de fatura" })).toHaveCount(0);

  await page.getByRole("link", { name: "Evolução", exact: true }).click();
  await page.getByLabel("Mês inicial").selectOption("2026-10");
  await page.getByLabel("Mês final").selectOption("2026-10");
  const history = page.getByRole("region", { name: "Histórico de saldos" });
  await expect(history.getByText(/R\$\s*7\.750,00/)).toBeVisible();
  await expect(history.getByText(/R\$\s*8\.100,00/)).toBeVisible();
  await expect(history.getByText(/\+R\$\s*350,00/)).toBeVisible();
});

test("opens the selected card with its invoice, due date, and future installments", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Itaú.*4821/ }).click();
  const invoice = page.getByRole("region", { name: "Fatura aberta", exact: true });
  await expect(invoice.getByText("26 de novembro de 2026")).toBeVisible();
  await expect(invoice.getByRole("link", { name: "Hotel", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Parcelas futuras" }).getByText(/Notebook.*3\/6/)).toBeVisible();
  await page.getByRole("link", { name: /Nubank.*7032/ }).click();
  await expect(invoice.getByRole("link", { name: "Restaurante" })).toBeVisible();
  await expect(invoice.getByRole("link", { name: "Hotel", exact: true })).toHaveCount(0);
});

test.describe("mobile detail flows", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: "dark" });

  test("tracks refunds inside the ledger and saves receipt tags locally", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Ver detalhes de Lançamentos recentes" }).tap();
    await page.getByRole("link", { name: "Reembolsos", exact: true }).tap();
    await page.getByLabel("Status").selectOption("pending");
    await expect(page.getByText("Nenhum valor recebido até o momento.")).toBeVisible();
    await page.getByLabel("Status").selectOption("completed");
    await expect(page.getByRole("link", { name: "Reserva cancelada" })).toBeVisible();
    await page.getByLabel("Status").selectOption("partial");
    await expect(page.getByText(/R\$\s*300,00/)).toBeVisible();
    await page.getByRole("link", { name: /Reembolso do hotel/ }).tap();
    await expect(page.getByRole("link", { name: /Compra original.*Hotel/ })).toBeVisible();
    await page.getByLabel("Classificação", { exact: true }).fill("Viagem a trabalho");
    await page.getByLabel("Tags", { exact: true }).fill("hotel, empresa");
    await page.getByRole("button", { name: "Salvar" }).tap();
    await expect(page.getByRole("status")).toHaveText("Classificação e tags salvas.");
    await page.reload();
    await expect(page.getByLabel("Classificação", { exact: true })).toHaveValue("Viagem a trabalho");
    await expect(page.getByLabel("Tags", { exact: true })).toHaveValue("hotel, empresa");
    await page.getByRole("link", { name: "Voltar aos reembolsos" }).tap();
    await page.getByRole("link", { name: "Todos os lançamentos" }).tap();
    await page.getByLabel("Tipo").selectOption("refund");
    await page.getByLabel("Buscar lançamentos").fill("empresa");
    const ledger = page.getByRole("table", { name: "Lançamentos filtrados" });
    await expect(ledger.getByRole("link")).toHaveCount(1);
    await expect(ledger.getByText("Viagem a trabalho · hotel · empresa")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
