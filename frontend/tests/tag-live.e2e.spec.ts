import { expect, test } from "@playwright/test";

const entry = "10000000-0000-0000-0000-000000000001.20000000-0000-0000-0000-000000000001";

test("creates, assigns, renames, filters and removes personal tags", async ({ page, request }) => {
  expect((await request.post("http://127.0.0.1:8106/reset")).ok()).toBe(true);
  await page.goto("/acesso");
  await page.getByLabel("E-mail").fill("browser-owner@category-e2e.example.test");
  await page.getByLabel("Senha", { exact: true }).fill("balsave-category-browser-tests-only-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/lancamentos");
  const ledger = page.getByRole("region", { name: "Histórico de lançamentos" });
  await expect(ledger.getByRole("columnheader", { name: "Classificações" })).toHaveCount(1);
  await ledger.getByRole("button", { name: "Adicionar etiquetas a Loja de equipamentos" }).click();
  const editor = page.getByRole("dialog", { name: "Editar etiquetas" });
  await expect(editor).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const name of ["Trabalho", "Viagem"]) {
    await editor.getByLabel("Nome da nova etiqueta").fill(name);
    await editor.getByRole("button", { name: "Criar etiqueta", exact: true }).click();
    await expect(editor.getByRole("checkbox", { name })).toBeChecked();
  }
  await editor.getByRole("button", { name: "Salvar etiquetas", exact: true }).click();
  await expect(editor.getByRole("status")).toHaveText("Etiquetas salvas.");
  await editor.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(page).toHaveURL(/\/lancamentos$/);
  const editTags = ledger.getByRole("button", { name: /^Editar etiquetas de Loja de equipamentos/ });
  const work = editTags.getByText("Trabalho", { exact: true });
  await expect(work).toBeVisible();
  await expect(editTags.getByText("Viagem", { exact: true })).toBeVisible();
  const workColor = await work.getAttribute("data-color");
  await page.reload();
  await editTags.click();
  await expect(editor.getByRole("checkbox", { name: "Trabalho" })).toBeChecked();
  await expect(editor.getByRole("checkbox", { name: "Viagem" })).toBeChecked();
  await editor.getByLabel("Etiqueta para renomear").selectOption({ label: "Trabalho" });
  await editor.getByLabel("Novo nome da etiqueta").fill("Escritório");
  await editor.getByRole("button", { name: "Renomear etiqueta" }).click();
  await expect(editor.getByRole("checkbox", { name: "Escritório" })).toBeChecked();
  await editor.getByLabel("Nome da nova etiqueta").fill("Outra etiqueta");
  await editor.getByRole("button", { name: "Criar etiqueta", exact: true }).click();
  await expect(editor.getByRole("checkbox", { name: "Outra etiqueta" })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  await expect(editTags).toBeFocused();
  expect(await editTags.getByText("Escritório", { exact: true }).getAttribute("data-color")).toBe(workColor);

  const tagFilter = page.getByRole("combobox", { name: "Filtrar por etiquetas" });
  const tagOptions = page.getByRole("listbox", { name: "Etiquetas" });
  await tagFilter.click();
  const purchase = ledger.getByRole("link", { name: "Loja de equipamentos", exact: true });
  await tagOptions.getByRole("option", { name: "Outra etiqueta" }).click();
  await expect(tagOptions.getByRole("option", { name: "Outra etiqueta" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(tagFilter).toBeFocused();
  await expect(purchase).toHaveCount(0);
  await tagFilter.click();
  await tagOptions.getByRole("option", { name: "Limpar etiquetas" }).click();
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/etiquetas=/);
  await expect(purchase).toHaveCount(1);
  await tagFilter.click();
  for (const name of ["Escritório", "Viagem"]) {
    const filter = tagOptions.getByRole("option", { name, exact: true });
    await filter.click();
    await expect(filter).toHaveAttribute("aria-selected", "true");
  }
  await page.keyboard.press("Escape");
  await expect(tagFilter).toHaveText("Etiquetas (2)");
  await expect(page).toHaveURL(/etiquetas=/);
  await expect(purchase).toHaveCount(1);
  await expect(ledger.locator("dl").getByText(/^R\$\s125,00$/)).toBeVisible();
  await page.getByLabel("Período").selectOption({ label: "Personalizado" });
  await page.getByLabel("Data final").fill("2026-11-14");
  await expect(purchase).toHaveCount(0);
  await expect(ledger.locator("dl").getByText(/^R\$\s0,00$/)).toHaveCount(3);
  await page.getByLabel("Data final").fill("2026-11-15");
  await expect(purchase).toHaveCount(1);

  await page.getByRole("link", { name: "Voltar ao painel" }).click();
  await expect(tagFilter).toHaveText("Etiquetas (2)");
  await expect(page.getByRole("region", { name: "Gastos por categoria" }).getByText(/^R\$\s125,00$/)).toBeVisible();
  await page.getByRole("link", { name: "Ver gastos", exact: true }).click();
  await expect(page).toHaveURL(/etiquetas=/);
  await expect(tagFilter).toHaveText("Etiquetas (2)");
  await expect(page.getByRole("region", { name: "Compras no período" }).locator("dl").getByText(/^R\$\s125,00$/)).toBeVisible();

  await page.goto("/lancamentos");
  await editTags.click();
  await editor.getByRole("checkbox", { name: "Viagem" }).uncheck();
  await editor.getByRole("button", { name: "Salvar etiquetas", exact: true }).click();
  await expect(editor.getByRole("status")).toHaveText("Etiquetas salvas.");
  await editor.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(editTags).toHaveText("Escritório");
  await page.goto(`/lancamentos?lancamento=${entry}`);
  const detailEditor = page.getByRole("region", { name: "Etiquetas", exact: true });
  await expect(detailEditor.getByRole("checkbox", { name: "Escritório" })).toBeChecked();
  await expect(detailEditor.getByRole("checkbox", { name: "Viagem" })).not.toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
