import { createHash, createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const password = "balsave-category-browser-tests-only-password";
const authorization = `Bearer ${createHmac("sha256", password).update("balsave/preview/backend").digest("hex")}`;
const accountId = "10000000-0000-0000-0000-000000000001";
const transactionId = `${accountId}.20000000-0000-0000-0000-000000000001`;
const initialCategories = [
  { id: "30000000-0000-0000-0000-000000000001", code: "food", name: "Alimentação", archived: false },
  { id: "30000000-0000-0000-0000-000000000002", code: "shopping", name: "Compras", archived: false },
];
let categories;
let assignment;
let rules;
let snapshotUnavailable;
let assignmentConflict;

function reset() {
  categories = structuredClone(initialCategories);
  assignment = undefined;
  rules = [];
  snapshotUnavailable = false;
  assignmentConflict = false;
}
reset();

function ruleMatches(rule) {
  if (!rule.enabled || (rule.accountId && rule.accountId !== accountId) || (rule.startsOn && rule.startsOn > "2026-11-15")) return false;
  const description = "loja de equipamentos";
  const pattern = rule.description.toLocaleLowerCase("pt-BR");
  if (rule.matchType === "contains") return description.includes(pattern);
  if (rule.matchType === "starts_with") return description.startsWith(pattern);
  if (rule.matchType === "ends_with") return description.endsWith(pattern);
  return description === pattern;
}

function snapshot() {
  const rule = [...rules].sort((first, second) => first.priority - second.priority).find(item => ruleMatches(item));
  const category = categories.find(item => item.id === (assignment ?? rule?.categoryId)) ?? categories[1];
  return {
    connected: true,
    data: {
      asOf: "2026-11-20",
      accounts: [{ id: accountId, name: "Conta de teste", bank: "Banco fictício", balanceCents: 150000 }],
      cards: [],
      transactions: [{
        id: transactionId, accountId, name: "Loja de equipamentos", date: "2026-11-15", kind: "expense", amountCents: 12500,
        category: category.name, categoryId: category.id, categoryKey: category.code ?? `custom:${category.id}`,
        categorySource: assignment ? "manual" : rule ? "rule" : "pluggy", providerCategoryId: "08020000", providerCategoryName: "Electronics",
        providerCategoryLabel: "Eletrônicos", categoryNeedsReview: false,
      }],
      categories,
      categoryRules: rules,
      balanceSnapshots: [],
      connectionCount: 1,
      failedConnections: 0,
    },
  };
}

function draftRule(body) {
  return {
    id: body.ruleId ?? "draft",
    categoryId: body.categoryId,
    description: body.description.trim(),
    matchType: body.matchType,
    accountId: body.accountId ?? null,
    priority: body.priority,
    startsOn: body.applyToHistory ? null : "2026-11-20",
    enabled: body.enabled ?? true,
  };
}

function rulePreview(body) {
  const rule = draftRule(body);
  const matches = ruleMatches(rule);
  const fingerprint = createHash("sha256").update(JSON.stringify([rule, assignment, rules])).digest("hex");
  return { affectedCount: matches && !assignment ? 1 : 0, manualCount: matches && assignment ? 1 : 0, fingerprint };
}

function respond(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (request.url === "/health") return respond(response, 200, { status: "ok" });
  if (request.url === "/reset" && request.method === "POST") {
    reset();
    return respond(response, 200, { reset: true });
  }
  let body = {};
  if (request.method === "POST") {
    let content = "";
    for await (const chunk of request) content += chunk;
    try { body = JSON.parse(content || "{}"); } catch { return respond(response, 422, { detail: "Invalid JSON" }); }
  }
  if (request.url === "/controls" && request.method === "POST") {
    snapshotUnavailable = body.snapshotUnavailable === true;
    assignmentConflict = body.assignmentConflict === true;
    if (body.assignment !== undefined) assignment = body.assignment;
    return respond(response, 200, { saved: true });
  }
  if (request.headers.authorization !== authorization) return respond(response, 401, { detail: "Authentication required" });
  const path = request.url?.replace("/_internal/pluggy/", "");
  if (path === "snapshot" && request.method === "GET") {
    return snapshotUnavailable ? respond(response, 503, { detail: "Provider unavailable" }) : respond(response, 200, snapshot());
  }
  if (path === "categories" && request.method === "GET") return respond(response, 200, {
    categories, categoryRules: rules, categoryAccounts: [{ id: accountId, label: "Banco fictício · Conta de teste" }],
  });
  if (path === "category-create" && request.method === "POST") {
    if (categories.some(category => category.name.toLocaleLowerCase("pt-BR") === body.name?.trim().toLocaleLowerCase("pt-BR"))) {
      return respond(response, 409, { detail: "Category already exists" });
    }
    const category = { id: randomUUID(), code: null, name: body.name.trim(), archived: false };
    categories.push(category);
    return respond(response, 200, { category });
  }
  if (path === "category-update" && request.method === "POST") {
    const category = categories.find(item => item.id === body.categoryId);
    if (!category) return respond(response, 404, { detail: "Category unavailable" });
    if (body.name !== undefined) category.name = body.name.trim();
    if (body.archived !== undefined) category.archived = body.archived;
    return respond(response, 200, { category });
  }
  if (path === "transaction-category" && request.method === "POST") {
    if (assignmentConflict) return respond(response, 409, { detail: "Transaction changed" });
    if (body.entryId !== transactionId) return respond(response, 404, { detail: "Transaction unavailable" });
    const category = categories.find(item => item.id === body.categoryId && !item.archived);
    if (body.categoryId !== null && !category) return respond(response, 404, { detail: "Category unavailable" });
    assignment = body.categoryId ?? undefined;
    return respond(response, 200, { saved: true });
  }
  if (path === "category-rule-preview" && request.method === "POST") return respond(response, 200, { preview: rulePreview(body) });
  if (path === "category-rule-save" && request.method === "POST") {
    if (body.previewFingerprint !== rulePreview(body).fingerprint) return respond(response, 409, { detail: "Preview expired" });
    const rule = { ...draftRule(body), id: body.ruleId ?? randomUUID() };
    rules = [...rules.filter(item => item.id !== rule.id), rule];
    return respond(response, 200, { rule });
  }
  if (path === "category-rule-update" && request.method === "POST") {
    const rule = rules.find(item => item.id === body.ruleId);
    if (!rule) return respond(response, 404, { detail: "Rule unavailable" });
    if (body.remove) rules = rules.filter(item => item.id !== rule.id);
    else rule.enabled = false;
    return respond(response, 200, { saved: true });
  }
  return respond(response, 404, { detail: "Unknown test endpoint" });
}).listen(8106, "127.0.0.1");
