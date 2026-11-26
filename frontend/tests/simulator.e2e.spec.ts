import { expect, test } from "@playwright/test";

test("submits the selected cash balance and an automatic or edited annual yield", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/simulador/calcular", route => route.fulfill({
    json: {
      ends_on: "2026-12-31", advantage_cents: 0, break_even: { status: "any" },
      cash: { cost_cents: 12_000, balance_cents: 0, extra_cents: 0 },
      installments: { cost_cents: 12_000, balance_cents: 0, extra_cents: 0 },
    },
  }));
  await page.goto("/simulador");
  const cash = page.getByLabel("Origem do caixa inicial");
  await expect(cash).toHaveValue("total");
  await expect(page.getByText(/18\.742,65/)).toBeVisible();

  const fund = page.getByLabel("Fundo de investimento", { exact: true });
  await fund.selectOption("demo-fund");
  await expect(page.getByText(/Rentabilidade em 12 meses de 8,75%/)).toBeVisible();
  const rate = page.getByLabel(/^Rendimento anual da simulação/);
  await expect(rate).toHaveValue("8,75");
  await page.getByLabel("Preço à vista (R$)").fill("120");
  await page.getByLabel("Valor da parcela (R$)").fill("120");
  await page.getByLabel("Número de parcelas").fill("1");
  const due = page.getByLabel("Vencimento da primeira parcela");
  const today = (await due.getAttribute("min")) ?? "";
  const [year, month] = today.split("-").map(Number);
  const defaultDueOn = new Date(Date.UTC(year, month, 5)).toISOString().slice(0, 10);
  const displayedDueOn = defaultDueOn.split("-").reverse().join("/");
  await expect(due).toBeEmpty();
  await expect(page.getByText(`Se vazio, usamos ${displayedDueOn}.`)).toBeVisible();

  async function submit() {
    const request = page.waitForRequest("**/simulador/calcular");
    await page.getByRole("button", { name: "Calcular", exact: true }).click();
    const payload = (await request).postDataJSON();
    await expect(page.getByRole("heading", { name: "Resultado", exact: true })).toBeVisible();
    return payload;
  }

  expect(await submit()).toMatchObject({ initial_cash_cents: 1_874_265, rate_bps: 875, first_due_on: defaultDueOn });
  await expect(due).toBeEmpty();
  await cash.selectOption({ label: "Itaú" });
  await expect(page.getByRole("heading", { name: "Resultado", exact: true })).toHaveCount(0);
  await due.fill(today);
  await rate.fill("6,25");
  expect(await submit()).toMatchObject({ initial_cash_cents: 942_015, rate_bps: 625, first_due_on: today });
  await cash.selectOption("manual");
  await page.getByLabel(/^Caixa inicial \(R\$\)/).fill("100,01");
  expect(await submit()).toMatchObject({ initial_cash_cents: 10_001, rate_bps: 625 });
  await fund.selectOption("");
  await expect(rate).toBeEmpty();
  await rate.fill("0");
  expect(await submit()).toMatchObject({ initial_cash_cents: 10_001, rate_bps: 0 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
