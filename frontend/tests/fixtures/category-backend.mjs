import { createHash, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { createServer } from "node:http";
import { Pool } from "pg";

const password = "balsave-category-browser-tests-only-password";
const internalSecret = "balsave-browser-tests-only-internal-secret";
const emailDomain = "@category-e2e.example.test";
const connectedUser = `browser-owner${emailDomain}`;
const pool = new Pool({ connectionString: process.env.BALSAVE_TEST_DATABASE_URL });
const salt = randomBytes(16);
const key = scryptSync(password, salt, 32, { N: 65536, r: 8, p: 2, maxmem: 80 * 2 ** 20 });
const legacyHash = `scrypt-v1$${salt.toString("hex")}$${key.toString("hex")}`;
let connectedOwner;
const accountId = "10000000-0000-0000-0000-000000000001";
const transactionId = `${accountId}.20000000-0000-0000-0000-000000000001`;
const investmentId = "10000000-0000-0000-0000-000000000002";
const bankMovementId = `${accountId}.20000000-0000-0000-0000-000000000007`;
const fundMovementId = `${investmentId}.20000000-0000-0000-0000-000000000008`;
const automaticInvestmentId = `${accountId}.20000000-0000-0000-0000-000000000009`;
const reconciliationEntries = [
  { id: bankMovementId, accountId, name: "Envio para o fundo", date: "2026-11-13", direction: "out", amountCents: 25000 },
  { id: fundMovementId, investmentId, name: "Aplicação no fundo", date: "2026-11-14", direction: "in", amountCents: 25000 },
  { id: automaticInvestmentId, accountId, name: "Resgate automático pendente", date: "2026-11-16", direction: "in", amountCents: 10000 },
  { id: `${accountId}.20000000-0000-0000-0000-000000000010`, accountId, name: "Aplicação reconhecida", date: "2026-11-17",
    direction: "out", amountCents: 10000, reconciliation: "automatic" },
];
const reconciliationCandidates = [
  { entryId: bankMovementId, counterpartId: fundMovementId },
  { entryId: automaticInvestmentId, counterpartId: null },
];
const receivableEntries = [
  [2, "Jantar dividido", "2026-10-30", "expense", 10000],
  [3, "Pix da Ana", "2026-11-10", "income", 4000],
  [4, "Pix do Bruno", "2026-11-11", "income", 3000],
  [5, "Compra da empresa", "2026-10-28", "expense", 500000],
  [6, "Crédito da empresa", "2026-11-12", "credit", 500000],
].map(([suffix, name, date, kind, amountCents]) => ({
  id: `${accountId}.20000000-0000-0000-0000-00000000000${suffix}`,
  accountId, name, date, kind, amountCents, receivableEligible: true,
}));
const initialCategories = [
  { id: "30000000-0000-0000-0000-000000000001", code: "food", name: "Alimentação", archived: false },
  { id: "30000000-0000-0000-0000-000000000002", code: "shopping", name: "Compras", archived: false },
];
let categories;
let assignment;
let assignmentHistory;
let rules;
let tags;
let transactionTags;
let snapshotUnavailable;
let assignmentConflict;
let receivableGroups;
let receivablesEnabled;
let missingCredit;
let reconciliationEnabled;
let includedInAccountId;
let confirmedMovements;

async function reset() {
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    const removed = await connection.query(
      'DELETE FROM balsave_identity."user" WHERE email LIKE $1 RETURNING owner_id', [`%${emailDomain}`],
    );
    await connection.query("DELETE FROM balsave.users WHERE id = ANY($1::uuid[])", [removed.rows.map(row => row.owner_id)]);
    const { rows: [identity] } = await connection.query(
      'INSERT INTO balsave_identity."user" (email, name) VALUES ($1, $2) RETURNING id, owner_id',
      [connectedUser, "Browser test owner"],
    );
    await connection.query(
      `INSERT INTO balsave_identity.account ("accountId", "providerId", "userId", password)
       VALUES ($1::uuid::text, 'credential', $1::uuid, $2)`, [identity.id, legacyHash],
    );
    await connection.query("COMMIT");
    connectedOwner = identity.owner_id;
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
  categories = structuredClone(initialCategories);
  assignment = undefined;
  assignmentHistory = [];
  rules = [];
  tags = [];
  transactionTags = [];
  snapshotUnavailable = false;
  assignmentConflict = false;
  receivableGroups = [];
  receivablesEnabled = false;
  missingCredit = false;
  reconciliationEnabled = false;
  includedInAccountId = undefined;
  confirmedMovements = new Map();
}
await reset();

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
  const category = assignment === null ? null : categories.find(item => item.id === (assignment ?? rule?.categoryId)) ?? categories[1];
  const movements = reconciliationEnabled ? reconciliationEntries.map(entry => ({
    ...entry, kind: "transfer", internalTransfer: "investment",
    ...(confirmedMovements.has(entry.id) && { reconciliation: "confirmed", counterpartId: confirmedMovements.get(entry.id) }),
  })) : [];
  return {
    connected: true,
    data: {
      asOf: "2026-11-20",
      accounts: [{ id: accountId, name: "Conta de teste", bank: "Banco fictício", balanceCents: 150000 }],
      investments: reconciliationEnabled ? [{ id: investmentId, name: "Fundo de teste", bank: "Banco fictício", balanceCents: 40000,
        asOf: "2026-11-19", includedInAccountId }] : [],
      reconciliationCandidates: reconciliationEnabled ? reconciliationCandidates.filter(candidate => !confirmedMovements.has(candidate.entryId)) : [],
      cards: [],
      transactions: [{
        id: transactionId, accountId, name: "Loja de equipamentos", date: "2026-11-15", kind: "expense", amountCents: 12500,
        category: category?.name ?? "Sem categoria", categoryId: category?.id ?? null,
        categoryKey: category ? category.code ?? `custom:${category.id}` : "uncategorized",
        categorySource: assignment !== undefined ? "manual" : rule ? "rule" : "pluggy", providerCategoryId: "08020000", providerCategoryName: "Electronics",
        providerCategoryLabel: "Eletrônicos", categoryNeedsReview: false, tagIds: transactionTags,
      }, ...receivablesEnabled ? receivableEntries.filter(entry => !missingCredit || entry !== receivableEntries[2]) : [], ...movements],
      receivableGroups,
      categories,
      tags,
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
  return { affectedCount: matches && assignment === undefined ? 1 : 0, manualCount: matches && assignment !== undefined ? 1 : 0, fingerprint };
}

function respond(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (request.url === "/health") return respond(response, 200, { status: "ok" });
  if (request.url === "/reset" && request.method === "POST") {
    await reset();
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
    if (body.receivablesEnabled !== undefined) receivablesEnabled = body.receivablesEnabled;
    if (body.missingCredit !== undefined) missingCredit = body.missingCredit;
    if (body.assignment !== undefined) assignment = body.assignment;
    if (body.reconciliationEnabled !== undefined) reconciliationEnabled = body.reconciliationEnabled;
    return respond(response, 200, { saved: true });
  }
  if (request.headers["x-balsave-internal"] !== internalSecret) return respond(response, 403, { detail: "Internal access required" });
  if (request.url === "/_internal/auth/attempt") {
    if (body.password !== undefined || !body.email?.endsWith(emailDomain)) {
      return respond(response, 422, { detail: "Invalid test authentication attempt" });
    }
    response.writeHead(204).end();
    return;
  }
  const id = /^Bearer ([a-f0-9-]{36})$/.exec(request.headers.authorization ?? "")?.[1];
  if (!id) return respond(response, 401, { detail: "Authentication required" });
  const { rows: [session] } = await pool.query(
    `SELECT identity.owner_id FROM balsave_identity.session AS session
     JOIN balsave_identity."user" AS identity ON identity.id = session."userId"
     WHERE session.id = $1 AND session."expiresAt" > now()`, [id],
  );
  if (!session) return respond(response, 401, { detail: "Authentication required" });
  const path = request.url?.replace("/_internal/pluggy/", "");
  if (session.owner_id !== connectedOwner) {
    if (path === "snapshot") return respond(response, 200, { connected: false });
    return respond(response, 404, { detail: "Resource unavailable" });
  }
  if (path === "snapshot" && request.method === "GET") {
    return snapshotUnavailable ? respond(response, 503, { detail: "Provider unavailable" }) : respond(response, 200, snapshot());
  }
  if (path === "position-links" && request.method === "POST" && reconciliationEnabled) {
    if (body.investmentId !== investmentId || ![null, accountId].includes(body.accountId)) {
      return respond(response, 404, { detail: "Position unavailable" });
    }
    includedInAccountId = body.accountId ?? undefined;
    return respond(response, 200, { saved: true });
  }
  if (path === "reconciliation" && request.method === "POST" && reconciliationEnabled) {
    const { entryId, counterpartId, remove } = body;
    if (remove && confirmedMovements.has(entryId)) {
      confirmedMovements.delete(confirmedMovements.get(entryId));
      confirmedMovements.delete(entryId);
      return respond(response, 200, { saved: true });
    }
    if (!remove && reconciliationCandidates.some(candidate => candidate.entryId === entryId && candidate.counterpartId === counterpartId)) {
      confirmedMovements.set(entryId, counterpartId);
      if (counterpartId) confirmedMovements.set(counterpartId, entryId);
      return respond(response, 200, { saved: true });
    }
    return respond(response, 409, { detail: "Candidate unavailable" });
  }
  if (path === "categories" && request.method === "GET") return respond(response, 200, {
    categories, categoryRules: rules, categoryAccounts: [{ id: accountId, label: "Banco fictício · Conta de teste" }],
  });
  if (path === "tags" && request.method === "GET") return respond(response, 200, {
    tags, usageByTag: Object.fromEntries(tags.map(tag => [tag.id, Number(transactionTags.includes(tag.id))])),
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
  if (path === "category-delete" && request.method === "POST") {
    const category = categories.find(item => item.id === body.categoryId);
    if (!category) return respond(response, 404, { detail: "Category unavailable" });
    if (category.code) return respond(response, 409, { detail: "Initial categories cannot be deleted" });
    categories = categories.filter(item => item.id !== category.id);
    if (assignment === category.id) {
      const previous = assignmentHistory.shift();
      assignment = categories.find(item => item.id === previous)?.id ?? null;
    }
    rules = rules.filter(rule => rule.categoryId !== category.id);
    return respond(response, 200, { deleted: true });
  }
  if (path === "transaction-category" && request.method === "POST") {
    if (assignmentConflict) return respond(response, 409, { detail: "Transaction changed" });
    if (body.entryId !== transactionId) return respond(response, 404, { detail: "Transaction unavailable" });
    const category = categories.find(item => item.id === body.categoryId && !item.archived);
    if (body.categoryId !== null && !category) return respond(response, 404, { detail: "Category unavailable" });
    const nextAssignment = body.unclassified ? null : body.categoryId ?? undefined;
    if (nextAssignment === undefined) assignmentHistory = [];
    else if (nextAssignment !== assignment) assignmentHistory.unshift(snapshot().data.transactions[0].categoryId);
    assignment = nextAssignment;
    return respond(response, 200, { saved: true });
  }
  if (path === "tag-create" && request.method === "POST") {
    if (tags.some(tag => tag.name.toLocaleLowerCase("pt-BR") === body.name?.trim().toLocaleLowerCase("pt-BR"))) return respond(response, 409, { detail: "Tag already exists" });
    const tag = { id: randomUUID(), name: body.name.trim() };
    tags.push(tag);
    return respond(response, 200, { tag });
  }
  if (path === "tag-update" && request.method === "POST") {
    const tag = tags.find(item => item.id === body.tagId);
    if (!tag) return respond(response, 404, { detail: "Tag unavailable" });
    if (tags.some(item => item.id !== tag.id && item.name.toLocaleLowerCase("pt-BR") === body.name?.trim().toLocaleLowerCase("pt-BR"))) return respond(response, 409, { detail: "Tag already exists" });
    tag.name = body.name.trim();
    return respond(response, 200, { tag });
  }
  if (path === "tag-delete" && request.method === "POST") {
    if (!tags.some(tag => tag.id === body.tagId)) return respond(response, 404, { detail: "Tag unavailable" });
    tags = tags.filter(tag => tag.id !== body.tagId);
    transactionTags = transactionTags.filter(id => id !== body.tagId);
    return respond(response, 200, { deleted: true });
  }
  if (path === "transaction-tags" && request.method === "POST") {
    const tagIds = body.tagIds ?? [body.tagId];
    if (body.entryId !== transactionId || !tagIds.every(id => tags.some(tag => tag.id === id))) return respond(response, 404, { detail: "Resource unavailable" });
    if (body.tagIds) transactionTags = body.tagIds;
    else if (body.assigned) transactionTags = [...new Set([...transactionTags, body.tagId])];
    else transactionTags = transactionTags.filter(id => id !== body.tagId);
    return respond(response, 200, { saved: true });
  }
  if (receivablesEnabled && request.method === "POST" && ["receivable-plan", "receivable-link"].includes(path)) {
    let group = receivableGroups.find(item => item.expenseId === body.expenseId);
    if (!group) {
      group = { expenseId: body.expenseId, expectations: [], receipts: [] };
      receivableGroups.push(group);
    }
    if (path === "receivable-plan") {
      group.expectations = body.expectations;
      for (const receipt of group.receipts) {
        if (!group.expectations.some(item => item.id === receipt.expectationId)) receipt.expectationId = null;
      }
    } else {
      const previous = receivableGroups.find(item => item.expenseId === body.previousExpenseId) ?? group;
      previous.receipts = previous.receipts.filter(item => item.creditId !== body.creditId);
      if (body.amountCents > 0) group.receipts.push({
        creditId: body.creditId, expectationId: body.expectationId, amountCents: body.amountCents,
      });
    }
    receivableGroups = receivableGroups.filter(item => item.expectations.length || item.receipts.length);
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
