import { expect, type Page, test } from "@playwright/test";

async function chooseFilters(page: Page, label: string, ...options: string[]) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  const menu = page.getByRole("listbox");
  for (const option of options) {
    await menu.getByRole("option", { name: option, exact: true }).click();
  }
  await page.keyboard.press("Escape");
}

test("keeps the spending total on one line in both themes", async ({ page }) => {
  await page.goto("/gastos");
  await page.getByLabel("Período", { exact: true }).selectOption("2026-10");
  await expect(page).toHaveURL(/mes=2026-10/);
  const total = page.getByRole("region", { name: "Gastos no período" }).locator("dd").first();
  await expect(total).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const fits = await total.evaluate(element => {
        const original = element.textContent;
        element.textContent = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(7350.53);
        const range = document.createRange();
        range.selectNodeContents(element);
        const onOneLine = range.getClientRects().length === 1 && range.getBoundingClientRect().width <= element.clientWidth;
        element.textContent = original;
        return onOneLine;
      });
      expect(fits, `${colorScheme}, ${width}px`).toBe(true);
    }
  }
});

test("opens the dedicated receivables page and returns to the selected status", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", error => pageErrors.push(error));
  await page.goto("/lancamentos");
  await expect(page.getByRole("heading", { name: "Lançamentos", exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Detalhes do extrato" }).getByRole("link", { name: "A receber" }).click();
  await expect(page.getByRole("heading", { name: "A receber", exact: true })).toBeVisible();
  await chooseFilters(page, "Status", "Parciais");
  const partialHotel = page.getByRole("listitem").filter({ has: page.getByText("Parcial", { exact: true }) })
    .getByRole("link", { name: "Hotel", exact: true });
  await expect(partialHotel).toHaveAttribute("href", /status=partial/);
  await partialHotel.click();
  await expect(page.getByRole("heading", { name: "Hotel", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Voltar para A receber" }).click();
  await expect(page).toHaveURL(/\/a-receber\?status=partial$/);
  await expect(page.getByRole("combobox", { name: "Status", exact: true })).toHaveText("Parciais");
  expect(pageErrors).toEqual([]);
});

test("opens the month and category from the dashboard and keeps the month on return", async ({ page }) => {
  await page.goto("/");
  const categories = page.getByRole("region", { name: "Gastos por categoria" });
  await page.getByLabel("Período", { exact: true }).selectOption("2026-10");
  const food = categories.getByRole("link", { name: /^Alimentação/ });
  await expect(food).toHaveAttribute("href", /mes=2026-10/);
  await food.click();

  await expect(page.getByRole("heading", { name: "Gastos por categoria", exact: true })).toBeVisible();
  await expect(page.getByLabel("Período", { exact: true })).toHaveValue("2026-10");
  await expect(page.getByRole("combobox", { name: "Categoria", exact: true })).toHaveText("Alimentação");
  const purchases = page.getByRole("table", { name: "Compras por categoria" });
  await expect(purchases.getByRole("columnheader", { name: "Forma de pagamento" })).toBeVisible();
  await expect(purchases.getByRole("link", { name: "Supermercado" })).toHaveCount(2);
  await expect(purchases.getByRole("link", { name: "Farmácia" })).toHaveCount(0);
  await chooseFilters(page, "Categoria", "Saúde");
  await expect(page.getByRole("combobox", { name: "Categoria", exact: true })).toHaveText("Categorias (2)");
  await expect(purchases.getByRole("link", { name: "Farmácia" })).toBeVisible();
  await chooseFilters(page, "Categoria", "Saúde");
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
  await expect(page.getByLabel("Período", { exact: true })).toHaveValue("2026-10");
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

test("includes only the installments dated in the selected calendar month", async ({ page }) => {
  await page.goto("/");
  const categories = page.getByRole("region", { name: "Gastos por categoria" });
  await expect(categories.getByText(/R\$\s*2\.115,50/)).toBeVisible();
  await expect(categories.getByRole("link", { name: /^Compras/ })).toContainText(/R\$\s*420,00/);
  const installments = categories.getByRole("link", { name: /^Parcelas incluídas/ });
  await expect(installments).toContainText(/R\$\s*420,00/);
  await installments.click();

  const filter = page.getByRole("combobox", { name: "Tipo de compra", exact: true });
  const purchases = page.getByRole("table", { name: "Compras por categoria" });
  await expect(filter).toHaveText("Parceladas");
  await expect(purchases.getByRole("link")).toHaveCount(1);
  const notebook = purchases.getByRole("row").filter({ hasText: "Notebook" });
  await expect(notebook.getByText("Parcela 2/6")).toBeVisible();
  await expect(notebook.getByText("13/11/2026")).toBeVisible();
  await expect(notebook.getByText(/R\$\s*420,00/)).toBeVisible();
  const period = page.getByLabel("Período", { exact: true });
  await period.selectOption("2026-10");
  await expect(notebook.getByText("Parcela 1/6")).toBeVisible();
  await expect(purchases.getByText("Parcela 6/6")).toBeVisible();
  await expect(purchases.getByText("Parcela 2/6")).toHaveCount(0);
  await period.selectOption("2026-11");
  await chooseFilters(page, "Tipo de compra", "Sem parcelas identificadas");
  await expect(filter).toHaveText("Tipos de compra (2)");
  await expect(purchases.getByRole("link", { name: "Restaurante" })).toBeVisible();
});

test("shows upcoming installment estimates without adding them to recorded spending", async ({ page }) => {
  await page.goto("/");
  const categories = page.getByRole("region", { name: "Gastos por categoria" });
  await page.getByLabel("Período", { exact: true }).selectOption("2026-12");
  const planned = categories.getByRole("link", { name: /^Parcelas previstas/ });
  await expect(planned).toContainText(/R\$\s*770,20/);
  await expect(categories.getByText("Nenhum gasto registrado neste mês.")).toBeVisible();
  await planned.click();

  const projections = page.getByRole("region", { name: "Parcelas previstas" });
  const actuals = page.getByRole("region", { name: "Compras no período" });
  await expect(actuals.getByText(/R\$\s*0,00/)).toBeVisible();
  await expect(projections.getByText(/3\/6 · 13\/12\/2026 · Compras/)).toBeVisible();
  await expect(projections.getByRole("link", { name: "Notebook" })).toHaveAttribute("href", /lancamento=notebook-1/);
  await chooseFilters(page, "Categoria", "Compras");
  await expect(projections.getByText("Cadeira ergonômica")).toHaveCount(0);
  await page.getByLabel("Período", { exact: true }).selectOption("2027-01");
  await expect(projections.getByText(/4\/6 · 13\/01\/2027/)).toBeVisible();
});

test("shows an institution's accounts, date-filtered statement, and balance evolution", async ({ page }) => {
  await page.goto("/");
  const evolution = page.getByRole("region", { name: "Saldo consolidado" });
  await expect(evolution.getByText("+10,9%", { exact: false })).toBeVisible();
  await expect(evolution.getByRole("button", { name: /^Saldo em 14 de novembro de 2026/ })).toHaveAttribute("aria-pressed", "true");
  const october = evolution.getByRole("button", { name: /^Fechamento em 31 de outubro de 2026/ });
  await october.click();
  await expect(october).toHaveAttribute("aria-pressed", "true");
  await expect(evolution.getByRole("link", { name: "Ver contas" })).toHaveAttribute("href", /ponto=2026-10/);
  await page.getByRole("region", { name: "Saldo em contas", exact: true }).getByRole("link", { name: "Itaú" }).click();
  await expect(page.getByRole("combobox", { name: "Instituição", exact: true })).toHaveText("Itaú");
  await page.getByRole("link", { name: "Ver extrato de Itaú · Conta corrente" }).click();
  const statement = page.getByRole("table", { name: "Extrato da conta" });
  await expect(statement.getByRole("link", { name: "Pagamento de fatura" })).toBeVisible();
  await expect(statement.getByText(/-R\$\s*1\.600,00/)).toHaveCSS("color", "rgb(150, 63, 57)");
  await chooseFilters(page, "Movimentação", "Entradas");
  await expect(statement.getByRole("link", { name: "Salário" })).toBeVisible();
  await expect(statement.getByRole("link", { name: "Reembolso do hotel" })).toBeVisible();
  await expect(statement.getByRole("link", { name: "Pagamento de fatura" })).toHaveCount(0);

  await page.getByRole("link", { name: "Evolução", exact: true }).click();
  const history = page.getByRole("region", { name: "Histórico de saldos" });
  await expect(history.getByRole("slider")).toHaveAttribute("aria-valuetext", /^Fechamento em 31 de outubro de 2026/);
  await expect(page.getByLabel("Mês final").locator('option[value="2026-11"]')).toHaveCount(0);
  await page.getByLabel("Mês inicial").selectOption("2026-10");
  await page.getByLabel("Mês final").selectOption("2026-10");
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
  await expect(page.getByRole("region", { name: "Parcelas previstas" }).getByText(/Notebook.*3\/6/)).toBeVisible();
  await page.getByRole("link", { name: /Nubank.*7032/ }).click();
  await expect(invoice.getByRole("link", { name: "Restaurante" })).toBeVisible();
  await expect(invoice.getByRole("link", { name: "Hotel", exact: true })).toHaveCount(0);
});

test("finds the demo event across three categories in the ledger", async ({ page }) => {
  await page.goto("/lancamentos");
  await page.getByLabel("Buscar lançamentos").fill("Mostra de cinema");
  const ledger = page.getByRole("table", { name: "Lançamentos filtrados" });
  await expect(ledger.getByRole("link")).toHaveCount(3);
  for (const category of ["Alimentação", "Lazer", "Transporte"]) {
    await expect(ledger.getByText(category, { exact: true })).toBeVisible();
  }
  await page.getByText("Mais filtros", { exact: true }).click();
  await chooseFilters(page, "Categoria", "Lazer");
  await expect(ledger.getByRole("link")).toHaveCount(1);
  await ledger.getByRole("link", { name: "Cinema", exact: true }).click();
  await expect(page.getByText("Mostra de cinema", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Etiquetas", exact: true })).toHaveCount(0);
});

test("reports the hotel net expense in the purchase month and the credit in the receipt month", async ({ page }) => {
  await page.goto("/gastos?mes=2026-10&categoria=travel");
  const hotel = page.getByRole("row").filter({ has: page.locator('a[href*="lancamento=hotel"]') });
  await expect(hotel.getByText("30/10/2026")).toBeVisible();
  await expect(hotel.getByText(/^R\$\s*300,00$/)).toBeVisible();
  await page.getByLabel("Período", { exact: true }).selectOption("2026-11");
  await expect(hotel).toHaveCount(0);

  await page.goto("/lancamentos?mes=2026-10");
  await expect(hotel.getByText(/-R\$\s*800,00/)).toHaveCSS("color", "rgb(150, 63, 57)");
  await page.goto("/lancamentos?mes=2026-11");
  const credit = page.getByRole("row").filter({ has: page.getByRole("link", { name: "Reembolso do hotel", exact: true }) });
  await expect(credit.getByText("11/11/2026")).toBeVisible();
  await expect(credit.getByText(/\+R\$\s*500,00/)).toBeVisible();
});

test("combines multiple statement filters and preserves compatible cards", async ({ page }) => {
  await page.goto("/lancamentos?mes=2026-11");
  const bank = page.getByRole("combobox", { name: "Banco", exact: true });
  const card = page.getByRole("combobox", { name: "Cartão", exact: true });
  const ledger = page.getByRole("table", { name: "Lançamentos filtrados" });
  const link = (name: string) => ledger.getByRole("link", { name, exact: true });

  await chooseFilters(page, "Tipo", "Despesa", "Receita");
  await expect(link("Salário")).toBeVisible();
  await expect(link("Restaurante")).toBeVisible();
  await expect(link("Reembolso do hotel")).toHaveCount(0);

  await chooseFilters(page, "Banco", "Nubank", "Itaú");
  await expect(bank).toHaveText("Bancos (2)");
  await expect(link("Posto")).toHaveCount(0);
  await card.click();
  const cards = page.getByRole("listbox", { name: "Cartões", exact: true });
  await expect(cards.getByRole("option")).toHaveText(["Todos os cartões", "Itaú · final 4821", "Nubank · final 7032"]);
  await cards.getByRole("option", { name: "Itaú · final 4821", exact: true }).click();
  await cards.getByRole("option", { name: "Nubank · final 7032", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(card).toHaveText("Cartões (2)");
  await expect(link("Restaurante")).toBeVisible();
  await expect(link("Notebook")).toBeVisible();
  await expect(link("Supermercado")).toHaveCount(0);

  await page.getByText("Mais filtros", { exact: true }).click();
  await chooseFilters(page, "Categoria", "Lazer", "Compras");
  await page.getByLabel("Buscar lançamentos").fill("cinema");
  await expect(ledger.getByRole("link")).toHaveCount(1);
  await link("Cinema").click();
  await page.getByRole("link", { name: "Voltar aos lançamentos" }).click();
  await expect(bank).toHaveText("Bancos (2)");
  await expect(card).toHaveText("Cartões (2)");
  await expect(ledger.getByRole("link")).toHaveCount(1);

  await chooseFilters(page, "Banco", "Itaú");
  await expect(card).toHaveText("Nubank · final 7032");
  expect(new URL(page.url()).searchParams.getAll("cartao")).toEqual(["nubank-7032"]);
  await chooseFilters(page, "Banco", "Nubank", "Inter");
  await expect(card).toBeDisabled();
  await expect(card).toHaveText("Sem cartões");
  await expect(page).not.toHaveURL(/cartao=/);
});

test.describe("mobile detail flows", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: "dark" });

  test("shows payment methods for expenses without overflowing the mobile layout", async ({ page }) => {
    await page.goto("/gastos?mes=2026-11");
    const purchases = page.getByRole("table", { name: "Compras por categoria" });
    for (const [name, method] of [
      ["Restaurante", "Cartão de crédito"],
      ["Aluguel", "Pix"],
      ["Compra no débito", "Cartão de débito"],
      ["Supermercado", "Não identificada"],
    ]) {
      const row = purchases.getByRole("row").filter({ has: page.getByRole("link", { name, exact: true }) });
      await expect(row.getByRole("cell", { name: method, exact: true })).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("tracks refunds inside the ledger and saves receipt tags locally", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Ver extrato", exact: true }).tap();
    await page.getByRole("link", { name: "A receber", exact: true }).tap();
    await chooseFilters(page, "Status", "Pendentes");
    await expect(page.getByText("Nenhum valor recebido até o momento.")).toBeVisible();
    await chooseFilters(page, "Status", "Concluídos");
    await expect(page.getByRole("link", { name: "Reserva cancelada" })).toBeVisible();
    await chooseFilters(page, "Status", "Pendentes", "Concluídos", "Parciais");
    await expect(page.getByText("Compra em 30 de outubro de 2026")).toBeVisible();
    await expect(page.getByText(/R\$\s*300,00/)).toBeVisible();
    await page.getByRole("link", { name: "Reembolso do hotel · 11 de novembro de 2026" }).tap();
    await expect(page.getByRole("link", { name: /Compra original.*Hotel/ })).toBeVisible();
    await page.getByLabel("Classificação", { exact: true }).fill("Viagem a trabalho");
    await page.getByLabel("Tags", { exact: true }).fill("hotel, empresa");
    await page.getByRole("button", { name: "Salvar" }).tap();
    await expect(page.getByRole("status")).toHaveText("Classificação e tags salvas.");
    await page.reload();
    await expect(page.getByLabel("Classificação", { exact: true })).toHaveValue("Viagem a trabalho");
    await expect(page.getByLabel("Tags", { exact: true })).toHaveValue("hotel, empresa");
    await page.getByRole("link", { name: "Voltar para A receber" }).tap();
    await page.getByRole("link", { name: "Lançamentos", exact: true }).tap();
    await chooseFilters(page, "Tipo", "Reembolso");
    await page.getByLabel("Buscar lançamentos").fill("empresa");
    const ledger = page.getByRole("table", { name: "Lançamentos filtrados" });
    await expect(ledger.getByRole("link")).toHaveCount(1);
    for (const label of ["Viagem a trabalho", "hotel", "empresa"]) {
      await expect(ledger.getByText(label, { exact: true })).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
