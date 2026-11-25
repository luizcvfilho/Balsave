import { expect, test } from "@playwright/test";

test("opens demo account access from the profile menu", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  const signIn = header.getByRole("link", { name: "Entrar", exact: true });
  await expect(page.getByText("Dados fictícios", { exact: true })).toBeVisible();
  await expect(signIn).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("link", { name: "Entrar", exact: true })).toHaveCount(0);

  await header.getByRole("link", { name: "Contas", exact: true }).click();
  await page.getByRole("navigation", { name: "Detalhes de contas" }).getByRole("link", { name: "Conexões", exact: true }).click();
  await expect(page).toHaveURL(/\/conexoes$/);
  await header.getByLabel("Minha conta").click();
  await signIn.click();
  await expect(page).toHaveURL(/\/acesso$/);
  await expect(signIn).toHaveCount(0);
  await expect(page.getByText("O login ainda não está habilitado nesta instalação.")).toBeVisible();
  await page.getByRole("link", { name: "Voltar à demonstração", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Visão geral", exact: true })).toBeVisible();
});

test("shows shared navigation and updates spending charts independently", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", error => pageErrors.push(error));
  await page.goto("/");
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Balsave, visão geral" })).toHaveAttribute("href", "/");
  const nav = header.getByRole("navigation", { name: "Navegação principal" });
  await expect(nav.getByRole("link")).toHaveText(["Visão geral", "Extrato", "Gastos", "Contas"]);
  await expect(nav.getByRole("link", { name: "Visão geral", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Lançamentos recentes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reembolsos", exact: true })).toHaveCount(0);

  const categories = page.getByRole("region", { name: "Gastos por categoria" });
  const pace = page.getByRole("slider", { name: "Dia do mês no gráfico de ritmo de gastos" });
  await categories.getByText("Todas as categorias", { exact: true }).click();
  await expect(categories.getByText("Sem categoria")).toBeVisible();
  await page.getByLabel("Período", { exact: true }).selectOption("2026-09");
  await expect(categories.getByText("Viagem")).toBeVisible();
  await expect(categories.getByText("Sem categoria")).toHaveCount(0);
  await expect(pace).toHaveAttribute("aria-valuetext", /Dia 14 de novembro/);
  await pace.press("ArrowRight");
  await expect(pace).toHaveAttribute("aria-valuetext", /Dia 15 de novembro.*ainda sem dados/);
  expect(pageErrors).toEqual([]);
});

test("keeps category colors stable and communicates spending and transaction direction", async ({ page }) => {
  await page.goto("/");
  const categories = page.getByRole("region", { name: "Gastos por categoria" });
  const categoryBar = (name: string) => categories.getByRole("listitem")
    .filter({ has: page.getByText(name, { exact: true }) }).locator(".MuiLinearProgress-bar");
  await expect(categoryBar("Moradia")).toHaveCSS("background-color", "rgb(117, 165, 138)");
  await expect(categoryBar("Alimentação")).toHaveCSS("background-color", "rgb(117, 165, 138)");
  await page.getByLabel("Período", { exact: true }).selectOption("2026-09");
  await expect(categoryBar("Moradia")).toHaveCSS("background-color", "rgb(117, 165, 138)");

  const chart = page.getByRole("region", { name: "Ritmo de gastos" });
  await expect(chart.locator("path.chart-above")).toHaveCSS("stroke", "rgb(166, 79, 56)");
  await expect(chart.locator("path.chart-below")).toHaveCSS("stroke", "rgb(40, 101, 145)");
  const slider = chart.getByRole("slider");
  await expect(slider).toHaveAttribute("aria-valuetext", /6,17 abaixo da média/);
  await slider.press("Home");
  await slider.press("ArrowRight");
  await expect(chart.getByText(/4,53 acima da média/)).toBeVisible();

  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Extrato" }).click();
  const transactions = page.getByRole("table", { name: "Lançamentos filtrados" });
  await expect(transactions.getByText(/\+R\$\s*6\.850,00/)).toHaveCSS("color", "rgb(36, 101, 70)");
  await expect(transactions.getByText(/\+R\$\s*500,00/)).toHaveCSS("color", "rgb(36, 101, 70)");
  await expect(transactions.getByText(/-R\$\s*230,00/)).toHaveCSS("color", "rgb(25, 32, 29)");
  await expect(transactions.getByText(/-R\$\s*1\.600,00/)).toHaveCSS("color", "rgb(25, 32, 29)");
});

test.describe("mobile layout", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: "dark" });

  test("stacks the cards and allows touching the line chart", async ({ page }) => {
    await page.goto("/");
    const header = page.getByRole("banner");
    const logo = await header.getByRole("link", { name: "Balsave, visão geral" }).boundingBox();
    const profile = await header.getByLabel("Minha conta").boundingBox();
    expect(profile?.x).toBeGreaterThan((logo?.x ?? 0) + (logo?.width ?? 0));
    expect(profile?.height).toBeGreaterThanOrEqual(44);
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link")).toHaveText(["Início", "Extrato", "Gastos", "Contas"]);
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

test("follows the system theme and keeps a manual choice across pages and reloads", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  const toggle = page.getByRole("button", { name: "Tema escuro" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(16, 18, 17)");
  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Extrato" }).click();
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
});
