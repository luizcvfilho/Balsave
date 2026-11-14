import { expect, test } from "@playwright/test";

test("shows shared navigation and updates spending charts independently", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Balsave, início" })).toHaveAttribute("href", "/");
  await expect(header.getByRole("link")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Lançamentos recentes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reembolsos", exact: true })).toBeVisible();

  const categories = page.getByRole("region", { name: "Gastos por categoria" });
  const pace = page.getByRole("slider", { name: "Dia do mês no gráfico de ritmo de gastos" });
  await expect(categories.getByText("Sem categoria")).toBeVisible();
  await categories.getByRole("combobox").selectOption("2026-09");
  await expect(categories.getByText("Viagem")).toBeVisible();
  await expect(categories.getByText("Sem categoria")).toHaveCount(0);
  await expect(pace).toHaveAttribute("aria-valuetext", /Dia 14 de novembro/);
  await pace.press("ArrowRight");
  await expect(pace).toHaveAttribute("aria-valuetext", /Dia 15 de novembro.*ainda sem dados/);
});

test("keeps category colors stable and communicates spending and transaction direction", async ({ page }) => {
  await page.goto("/");
  const categories = page.getByRole("region", { name: "Gastos por categoria" });
  const categoryBar = (name: string) => categories.getByRole("listitem")
    .filter({ has: page.getByText(name, { exact: true }) }).locator(".MuiLinearProgress-bar");
  await expect(categoryBar("Moradia")).toHaveCSS("background-color", "rgb(171, 89, 66)");
  await expect(categoryBar("Alimentação")).toHaveCSS("background-color", "rgb(53, 116, 86)");
  await categories.getByRole("combobox").selectOption("2026-09");
  await expect(categoryBar("Moradia")).toHaveCSS("background-color", "rgb(171, 89, 66)");

  const chart = page.getByRole("region", { name: "Ritmo de gastos" });
  await expect(chart.locator("path.chart-above")).toHaveCSS("stroke", "rgb(166, 79, 56)");
  await expect(chart.locator("path.chart-below")).toHaveCSS("stroke", "rgb(40, 101, 145)");
  const slider = chart.getByRole("slider");
  await expect(slider).toHaveAttribute("aria-valuetext", /126,17 abaixo da média/);
  await slider.press("Home");
  await slider.press("ArrowRight");
  await expect(chart.getByText(/4,53 acima da média/)).toBeVisible();

  const transactions = page.getByRole("region", { name: "Lançamentos recentes" });
  await expect(transactions.getByText(/\+R\$\s*6\.850,00/)).toHaveCSS("color", "rgb(40, 113, 79)");
  await expect(transactions.getByText(/\+R\$\s*500,00/)).toHaveCSS("color", "rgb(40, 113, 79)");
  await expect(transactions.getByText(/-R\$\s*230,00/)).toHaveCSS("color", "rgb(168, 68, 63)");
  await expect(transactions.getByText(/-R\$\s*1\.600,00/)).toHaveCSS("color", "rgb(83, 102, 91)");
});

test.describe("mobile layout", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: "dark" });

  test("stacks the cards and allows touching the line chart", async ({ page }) => {
    await page.goto("/");
    const accounts = page.getByRole("region", { name: "Saldo em contas", exact: true });
    const cards = page.getByRole("region", { name: "Limite usado nos cartões" });
    await expect(accounts).toBeVisible();
    await expect(cards).toBeVisible();
    const accountsBox = await accounts.boundingBox();
    const cardsBox = await cards.boundingBox();
    expect(accountsBox?.x).toBe(cardsBox?.x);
    expect(cardsBox?.y).toBeGreaterThan((accountsBox?.y ?? 0) + (accountsBox?.height ?? 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    const plot = page.getByRole("region", { name: "Ritmo de gastos" }).locator(".chart-plot");
    await expect(plot.locator("path.chart-below")).toHaveCSS("stroke", "rgb(121, 188, 242)");
    await plot.tap({ position: { x: 2, y: 24 } });
    await expect(page.getByRole("slider", { name: "Dia do mês no gráfico de ritmo de gastos" }))
      .toHaveAttribute("aria-valuetext", /Dia 1 de novembro/);
  });
});
