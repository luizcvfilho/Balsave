const paths = {
  statement: "M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3",
  layers: "m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5",
  tag: "M3 12V4h8l9 9-8 8-9-9Zm4-4h.01",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M18 6 6 18",
  down: "m6 9 6 6 6-6",
  right: "m9 6 6 6-6 6",
  check: "m5 12 4 4L19 6",
  search: "M16 16l4 4m-2-9a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
  calendar: "M4 6h16v14H4V6Zm0 4h16M8 4v4m8-4v4",
  sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5m-3 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  moon: "M20.7 14.3A8.8 8.8 0 0 1 9.7 3.3a9 9 0 1 0 11 11Z",
  cart: "M3 4h2l2.3 11h11L21 7H6m3 12h.01m8 0h.01",
  car: "m5 10 2-5h10l2 5m-14 0h14l1 3v5H4v-5l1-3Zm2 4h1m8 0h1M6 18v2m12-2v2",
  food: "M5 3v5a3 3 0 1 0 6 0V3M8 3v18M18 21V3c-3 2-4 5-4 8v3h4",
  book: "M4 5c4-1.4 6-.2 8 1.4C14 4.8 16 3.6 20 5v13c-4-1.4-6-.2-8 1.4C10 17.8 8 16.6 4 18V5Zm8 1.4v13",
  house: "m3 10 9-7 9 7m-2-1v11H5V9m5 11v-6h4v6",
  health: "M9 4h6v5h5v6h-5v5H9v-5H4V9h5V4Z",
  screen: "M3 5h18v12H3V5Zm5 15h8m-4-3v3",
  plane: "m3 13 8 1 6 7 2-1-3-7 4-4c1.5-1.5 1.5-3 .5-4s-2.5-1-4 .5l-4 4-7-3-1 2 4 4-4 1-1 2",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  incoming: "M18 6 6 18m0-8v8h8",
  outgoing: "M6 18 18 6m-8 0h8v8",
  net: "M4 7h16M4 12h16M4 17h10",
  rule: "M12 2 4 13h7l-1 9 10-12h-8l1-8Z",
  reset: "M4 11a8 8 0 1 1 2 6m-2-6V5m0 6h6",
};

const categories = [
  { id: "food", name: "Alimentação", tone: "gold", icon: "food", initial: true },
  { id: "education", name: "Educação", tone: "purple", icon: "book", initial: true },
  { id: "market", name: "Mercado", tone: "green", icon: "cart", initial: true },
  { id: "home", name: "Moradia", tone: "clay", icon: "house", initial: true },
  { id: "health", name: "Saúde", tone: "purple", icon: "health", initial: true },
  { id: "subscriptions", name: "Assinaturas", tone: "teal", icon: "screen", initial: false },
  { id: "transport", name: "Transporte", tone: "blue", icon: "car", initial: true },
  { id: "trip", name: "Viagens", tone: "teal", icon: "plane", initial: true },
];

const tags = [
  { id: "home", name: "Casa", tone: "green" },
  { id: "week", name: "Compra do mês", tone: "clay" },
  { id: "work", name: "Trabalho", tone: "blue" },
  { id: "refund", name: "Reembolsável", tone: "gold" },
  { id: "weekend", name: "Fim de semana", tone: "teal" },
  { id: "monthly", name: "Mensal", tone: "purple" },
  { id: "personal", name: "Pessoal", tone: "gray" },
];

const transactions = [
  { id: "t1", name: "Mercado Pinheiros", date: "2026-11-23", amount: -28670, bank: "Nubank", card: "4821", category: "market", tagIds: ["home", "week"] },
  { id: "t2", name: "Uber", date: "2026-11-22", amount: -3240, bank: "Nubank", card: "4821", category: "transport", tagIds: ["work", "refund"] },
  { id: "t3", name: "Café da Vila", date: "2026-11-21", amount: -4870, bank: "Itaú", card: "3098", category: "food", tagIds: ["weekend"] },
  { id: "t4", name: "Farmácia Central", date: "2026-11-20", amount: -7685, bank: "Inter", card: "", category: "health", tagIds: [] },
  { id: "t5", name: "Spotify", date: "2026-11-19", amount: -2390, bank: "Nubank", card: "4821", category: null, tagIds: ["monthly"] },
  { id: "t6", name: "Livraria da Esquina", date: "2026-11-18", amount: -8900, bank: "Itaú", card: "3098", category: null, tagIds: ["personal"] },
  { id: "t7", name: "Aluguel", date: "2026-11-17", amount: -168000, bank: "Inter", card: "", category: "home", tagIds: ["home", "monthly"] },
  { id: "t8", name: "Salário", date: "2026-11-16", amount: 625000, bank: "Itaú", card: "", category: null, tagIds: [] },
];

const ruleMatches = {
  contains: { label: "Contém", matches: (name, term) => name.includes(term) },
  exact: { label: "É igual a", matches: (name, term) => name === term },
  starts: { label: "Começa com", matches: (name, term) => name.startsWith(term) },
  ends: { label: "Termina com", matches: (name, term) => name.endsWith(term) },
};

let rules = [
  { id: "r1", categoryId: "subscriptions", term: "Spotify", match: "exact", bank: "Nubank", priority: 50, period: "history", enabled: true },
  { id: "r2", categoryId: "transport", term: "Uber", match: "starts", bank: "", priority: 100, period: "history", enabled: true },
];

const catalogMeta = {
  category: { list: categories, singular: "categoria", plural: "Categorias", route: "categorias", title: "Categorias e regras" },
  tag: { list: tags, singular: "etiqueta", plural: "Etiquetas", route: "etiquetas", title: "Etiquetas" },
};

const tones = ["green", "blue", "purple", "gold", "teal", "clay", "gray"];
const bankLetters = { Nubank: "nu", Itaú: "it", Inter: "in" };
const demoToday = "2026-11-24";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const main = document.querySelector("main");
const picker = document.querySelector("#picker");
const pickerSearch = document.querySelector("#picker-search");
const pickerContent = document.querySelector("#picker-content");
const dialog = document.querySelector("#editor");
const mobile = matchMedia("(max-width: 760px)");
let nextId = 1;
let route;
let pickerState;
let editorInfo;
let lastOpener;
const filters = { search: "", category: "", tag: "" };
const catalogSearch = { categorias: "", regras: "", etiquetas: "" };

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function icon(name) {
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]}"/></svg>`;
}

function normalize(text) {
  return text.trim().normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

function orderByName(first, second) {
  return first.name.localeCompare(second.name, "pt-BR");
}

function categoryFor(transaction, activeRules = rules) {
  if (Object.hasOwn(transaction, "categoryOverride")) return transaction.categoryOverride;
  if (transaction.amount >= 0) return null;
  const enabledRules = activeRules.filter(rule => rule.enabled).sort((a, b) => a.priority - b.priority);
  const match = enabledRules.find(rule => ruleApplies(rule, transaction));
  return match?.categoryId ?? transaction.category;
}

function ruleApplies(rule, transaction) {
  return transaction.amount < 0
    && (rule.period === "history" || transaction.date >= demoToday)
    && (!rule.bank || rule.bank === bankKey(transaction))
    && ruleMatches[rule.match].matches(normalize(transaction.name), normalize(rule.term));
}

function bankKey(transaction) {
  return transaction.card ? `${transaction.bank} ${transaction.card}` : transaction.bank;
}

function byId(kind, id) {
  return catalogMeta[kind].list.find(item => item.id === id);
}

function chip(item, kind, opts = {}) {
  const prefix = kind === "tag" ? '<span class="dot" aria-hidden="true"></span>' : icon(item.icon ?? "grid");
  const content = `${prefix}<span>${escapeHTML(item.name)}</span>`;
  const classes = `chip ${kind}`;
  return opts.remove
    ? `<button class="${classes} remove-chip" data-tone="${item.tone}" type="button" data-picker-action="toggle" data-id="${item.id}" aria-label="Remover etiqueta ${escapeHTML(item.name)}">${content}${icon("close")}</button>`
    : `<span class="${classes}" data-tone="${item.tone}">${content}</span>`;
}

function pageHeading(title, description, action = "") {
  return `<header class="page-heading"><div><h1>${title}</h1><p>${description}</p></div>${action}</header>`;
}

function searchField(id, placeholder, value) {
  return `<label class="search-field">${icon("search")}<span class="sr-only">${placeholder}</span>
    <input type="search" id="${id}" placeholder="${placeholder}" value="${escapeHTML(value)}" autocomplete="off"></label>`;
}

function filterSelect(kind, placeholder, value) {
  const items = catalogMeta[kind].list.slice().sort(orderByName);
  return `<label class="filter-select"><span class="sr-only">Filtrar por ${catalogMeta[kind].singular}</span>
    <select data-filter="${kind}"><option value="">${placeholder}</option>${items.map(item =>
      `<option value="${item.id}"${item.id === value ? " selected" : ""}>${escapeHTML(item.name)}</option>`).join("")}</select>
    ${icon("down")}</label>`;
}

function numberLabel(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function renderStatement() {
  main.innerHTML = `${pageHeading("Lançamentos", "Clique em uma classificação ou etiqueta para editar o lançamento.", `<span class="period">${icon("calendar")} Novembro de 2026</span>`)}
    <section class="metrics" id="metrics" aria-label="Resumo dos lançamentos filtrados"></section>
    <section class="panel" aria-labelledby="ledger-title">
      <header class="panel-top">
        <div><h2 id="ledger-title">Histórico de lançamentos</h2><p class="result-count" id="ledger-count"></p></div>
        <div class="filters" aria-label="Filtros">
          ${searchField("transaction-search", "Buscar lançamento", filters.search)}
          ${filterSelect("category", "Todas as categorias", filters.category)}
          ${filterSelect("tag", "Todas as etiquetas", filters.tag)}
        </div>
      </header>
      <table class="ledger" role="table" aria-labelledby="ledger-title">
        <colgroup><col class="entry-col"><col class="category-col"><col class="tag-col"><col class="bank-col"><col class="amount-col"></colgroup>
        <thead role="rowgroup"><tr role="row">
          <th role="columnheader" scope="col">Lançamento</th><th role="columnheader" scope="col">Classificações</th>
          <th role="columnheader" scope="col">Etiquetas</th><th role="columnheader" scope="col">Banco / cartão</th><th role="columnheader" scope="col">Valor</th>
        </tr></thead>
        <tbody role="rowgroup" id="ledger-rows"></tbody>
      </table>
      <p class="empty" id="ledger-empty" hidden>Nenhum lançamento para os filtros selecionados.</p>
    </section>`;
  renderRows();
}

function cellEditor(transaction, kind, items) {
  const expanded = pickerState?.kind === kind && pickerState.transaction === transaction;
  const label = kind === "category" ? "Categoria" : "Etiquetas";
  const emptyText = kind === "category" ? "Adicionar categoria" : "Adicionar etiquetas";
  const actionLabel = `${label} de ${transaction.name}${items.length ? `: ${items.map(item => item.name).join(", ")}` : ""}`;
  return `<button class="cell-editor" type="button" data-kind="${kind}" data-entry="${transaction.id}" aria-haspopup="dialog"
      aria-controls="picker" aria-expanded="${expanded}" aria-label="${escapeHTML(actionLabel)}">${items.length
        ? `${items.map(item => chip(item, kind)).join("")}<span class="edit-icon">${icon(kind === "category" ? "down" : "plus")}</span>`
        : `<span class="add-chip">${icon("plus")} ${emptyText}</span>`}</button>`;
}

function ledgerRow(transaction) {
  const category = byId("category", categoryFor(transaction));
  const appliedTags = transaction.tagIds.map(id => byId("tag", id)).filter(Boolean);
  const incoming = transaction.amount > 0;
  const date = transaction.date.split("-").reverse().join("/");
  return `<tr role="row">
    <td class="entry-cell" role="cell"><div class="entry">
      <span class="tile" data-tone="${category?.tone ?? (incoming ? "green" : "gray")}">${icon(category?.icon ?? (incoming ? "incoming" : "grid"))}</span>
      <div class="entry-text"><strong>${transaction.name}</strong><span><time datetime="${transaction.date}">${date}</time></span></div>
    </div></td>
    <td class="category-cell" role="cell"><span class="cell-label" aria-hidden="true">Classificações</span>${incoming
      ? chip({ name: "Entrada", tone: "green", icon: "incoming" }, "category")
      : cellEditor(transaction, "category", category ? [category] : [])}</td>
    <td class="tag-cell" role="cell"><span class="cell-label" aria-hidden="true">Etiquetas</span>${cellEditor(transaction, "tag", appliedTags)}</td>
    <td class="bank-cell" role="cell"><div class="institution">
      <span class="bank" data-bank="${bankLetters[transaction.bank]}" aria-hidden="true">${bankLetters[transaction.bank]}</span>
      <div class="institution-text">${transaction.bank}<span>${transaction.card ? `•••• ${transaction.card}` : "Conta"} </span></div>
    </div></td>
    <td class="amount ${incoming ? "positive" : ""}" role="cell">${incoming ? "+" : "−"} ${money.format(Math.abs(transaction.amount) / 100)}</td>
  </tr>`;
}

function renderRows() {
  const rows = transactions.filter(transaction => {
    const categoryId = categoryFor(transaction);
    const words = [transaction.name, transaction.bank, byId("category", categoryId)?.name ?? "",
      ...transaction.tagIds.map(id => byId("tag", id).name)];
    return (!filters.category || categoryId === filters.category)
      && (!filters.tag || transaction.tagIds.includes(filters.tag))
      && words.some(word => normalize(word).includes(normalize(filters.search)));
  });
  const incoming = rows.reduce((total, item) => total + Math.max(0, item.amount), 0);
  const outgoing = rows.reduce((total, item) => total - Math.min(0, item.amount), 0);
  const metrics = [
    ["Entradas", incoming, "incoming", "positive"],
    ["Saídas", outgoing, "outgoing", "negative"],
    ["Total líquido", incoming - outgoing, "net", incoming >= outgoing ? "positive" : "negative"],
  ];
  document.querySelector("#metrics").innerHTML = metrics.map(([label, amount, symbol, tone]) =>
    `<div class="metric"><span class="metric-icon ${symbol === "net" ? "" : tone}">${icon(symbol)}</span>
      <span class="metric-label">${label}</span><strong class="metric-value ${symbol === "net" ? tone : ""}">${money.format(amount / 100)}</strong></div>`).join("");
  document.querySelector("#ledger-count").textContent = numberLabel(rows.length, "lançamento", "lançamentos");
  document.querySelector("#ledger-rows").innerHTML = rows.map(ledgerRow).join("");
  document.querySelector(".ledger").hidden = rows.length === 0;
  document.querySelector("#ledger-empty").hidden = rows.length > 0;
}

function catalogTabs() {
  return `<nav class="tabs" aria-label="Categorias e regras">
    <a href="#categorias"${route === "categorias" ? ' aria-current="page"' : ""}>${icon("layers")} Categorias</a>
    <a href="#regras"${route === "regras" ? ' aria-current="page"' : ""}>${icon("rule")} Regras</a>
  </nav>`;
}

function renderCatalog() {
  const isRules = route === "regras";
  const kind = isRules ? "rule" : route === "etiquetas" ? "tag" : "category";
  const name = isRules ? "regra" : catalogMeta[kind].singular;
  const plural = isRules ? "Regras" : catalogMeta[kind].plural;
  const title = isRules ? "Categorias e regras" : catalogMeta[kind].title;
  const description = kind === "tag"
    ? "Organize as etiquetas que você usa nos lançamentos."
    : "Gerencie as categorias dos lançamentos e as regras de classificação automática.";
  main.innerHTML = `${pageHeading(title, description, `<button class="button primary" type="button" data-edit-kind="${kind}">${icon("plus")} Nova ${name}</button>`)}
    ${kind === "tag" ? "" : catalogTabs()}
    <section class="panel ${isRules ? "rules" : kind === "tag" ? "tag-catalog" : ""}" aria-labelledby="catalog-title">
      <header class="panel-top">
        <div><h2 id="catalog-title">${plural}</h2><p class="result-count" id="catalog-count"></p></div>
        ${searchField("catalog-search", `Buscar ${plural.toLocaleLowerCase("pt-BR")}`, catalogSearch[route])}
      </header>
      <div class="catalog-heading" aria-hidden="true">
        <span>${isRules ? "Critério" : "Nome"}</span><span>${isRules ? "Categoria" : "Em uso"}</span>${kind === "tag" ? "" : "<span>Situação</span>"}<span></span>
      </div>
      <ul class="catalog" role="list" id="catalog-list"></ul>
      <p class="empty" id="catalog-empty" hidden>Nenhuma ${name} encontrada.</p>
    </section>`;
  renderCatalogRows();
}

function renderCatalogRows() {
  const query = normalize(catalogSearch[route]);
  const isRules = route === "regras";
  const kind = isRules ? "rule" : route === "etiquetas" ? "tag" : "category";
  const list = isRules
    ? rules.filter(rule => normalize(rule.term).includes(query) || normalize(byId("category", rule.categoryId)?.name ?? "").includes(query))
      .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.priority - b.priority)
    : catalogMeta[kind].list.filter(item => normalize(item.name).includes(query))
      .sort((a, b) => Number(Boolean(a.archived)) - Number(Boolean(b.archived)) || orderByName(a, b));
  document.querySelector("#catalog-count").textContent = isRules ? numberLabel(list.length, "regra", "regras")
    : numberLabel(list.length, catalogMeta[kind].singular, catalogMeta[kind].plural.toLocaleLowerCase("pt-BR"));
  document.querySelector("#catalog-empty").hidden = list.length > 0;
  document.querySelector("#catalog-list").innerHTML = list.map(item => {
    let first;
    let second;
    let active;
    if (isRules) {
      first = `<span><strong>${ruleMatches[item.match].label} “${escapeHTML(item.term)}”</strong><span class="catalog-sub">Prioridade ${item.priority}</span></span>`;
      second = chip(byId("category", item.categoryId), "category");
      active = item.enabled;
    } else {
      first = `<span>${chip(item, kind)}${kind === "category" ? `<span class="catalog-sub">${item.initial ? "Categoria inicial" : "Categoria personalizada"}</span>` : ""}</span>`;
      const uses = transactions.filter(transaction =>
        kind === "tag" ? transaction.tagIds.includes(item.id) : categoryFor(transaction) === item.id).length;
      second = `<span class="catalog-count">${numberLabel(uses, "lançamento", "lançamentos")}</span>`;
      active = !item.archived;
    }
    return `<li><button class="catalog-row" type="button" data-edit-kind="${kind}" data-id="${item.id}" aria-haspopup="dialog">
      ${first}${second}${kind === "tag" ? "" : `<span class="catalog-status${active ? "" : " inactive"}">${active ? "Ativa" : isRules ? "Desativada" : "Arquivada"}</span>`}${icon("right")}
    </button></li>`;
  }).join("");
}

function renderRoute() {
  const hash = location.hash.slice(1);
  route = ["categorias", "regras", "etiquetas"].includes(hash) ? hash : "extrato";
  closePicker(false);
  if (dialog.open) dialog.close();
  const navRoute = route === "regras" ? "categorias" : route;
  document.querySelectorAll("[data-nav]").forEach(link => {
    if (link.dataset.nav === navRoute) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.title = `${route === "extrato" ? "Lançamentos" : route === "etiquetas" ? "Etiquetas" : "Categorias e regras"} · Balsave`;
  if (route === "extrato") renderStatement();
  else renderCatalog();
}

function triggerForPicker() {
  if (!pickerState) return null;
  const { kind, transaction } = pickerState;
  return main.querySelector(`[data-kind="${kind}"][data-entry="${transaction.id}"]`);
}

function announce(message) {
  document.querySelector("#announcement").textContent = message;
}

function newItem(kind, name) {
  const list = catalogMeta[kind].list;
  const item = { id: `new-${nextId++}`, name, tone: tones[list.length % tones.length], icon: "grid" };
  list.push(item);
  return item;
}

function refreshFilters() {
  for (const [kind, label] of [["category", "Todas as categorias"], ["tag", "Todas as etiquetas"]]) {
    main.querySelector(`[data-filter="${kind}"]`).parentElement.outerHTML = filterSelect(kind, label, filters[kind]);
  }
}

function openPicker(trigger) {
  if (trigger === triggerForPicker()) {
    closePicker();
    return;
  }
  closePicker(false);
  const { kind, entry } = trigger.dataset;
  const transaction = transactions.find(item => item.id === entry);
  pickerState = { kind, transaction };
  trigger.setAttribute("aria-expanded", "true");
  picker.querySelector("#picker-title").textContent = kind === "category" ? "Classificação" : "Etiquetas";
  picker.querySelector("#picker-transaction").textContent = transaction.name;
  pickerSearch.value = "";
  pickerSearch.placeholder = kind === "category" ? "Buscar ou criar categoria" : "Buscar ou criar etiqueta";
  pickerSearch.setAttribute("aria-label", pickerSearch.placeholder);
  const manage = picker.querySelector("#picker-manage");
  manage.href = `#${catalogMeta[kind].route}`;
  manage.innerHTML = `${icon(kind === "category" ? "layers" : "tag")} Gerenciar ${catalogMeta[kind].plural.toLocaleLowerCase("pt-BR")}`;
  picker.hidden = false;
  renderPicker();
  (mobile.matches ? picker.querySelector(".picker-close") : pickerSearch).focus({ preventScroll: true });
}

function closePicker(restoreFocus = true) {
  const trigger = triggerForPicker();
  trigger?.setAttribute("aria-expanded", "false");
  if (restoreFocus) (trigger ?? main.querySelector("#transaction-search"))?.focus({ preventScroll: true });
  picker.hidden = true;
  pickerState = undefined;
}

function positionPicker() {
  if (!pickerState) return;
  picker.style.removeProperty("max-height");
  if (mobile.matches) {
    picker.style.removeProperty("left");
    picker.style.removeProperty("top");
    return;
  }
  const trigger = triggerForPicker();
  if (!trigger) return;
  const { left, top, bottom } = trigger.getBoundingClientRect();
  const width = picker.offsetWidth;
  const height = picker.offsetHeight;
  const below = innerHeight - bottom - 16;
  const above = top - 16;
  const opensBelow = height <= below || (height > above && below >= above);
  const maxHeight = Math.max(260, opensBelow ? below : above);
  picker.style.maxHeight = `${Math.min(maxHeight, height)}px`;
  const preferredTop = opensBelow ? bottom + 6 : top - picker.offsetHeight - 6;
  picker.style.left = `${Math.max(10, Math.min(left, document.documentElement.clientWidth - width - 10))}px`;
  picker.style.top = `${Math.max(10, Math.min(preferredTop, innerHeight - picker.offsetHeight - 10))}px`;
}

function renderPicker(keepScroll = false) {
  const { kind, transaction } = pickerState;
  const isTag = kind === "tag";
  const current = isTag ? transaction.tagIds : [categoryFor(transaction)].filter(Boolean);
  const name = pickerSearch.value.trim();
  const query = normalize(name);
  const catalog = catalogMeta[kind].list;
  const matches = catalog.filter(item => !item.archived && normalize(item.name).includes(query)).sort(orderByName);
  const exact = catalog.find(item => normalize(item.name) === query);
  const activeTags = isTag && current.length
    ? `<div class="picker-selection"><p class="picker-label picker-selection-label">Aplicadas neste lançamento</p>
      ${current.map(id => chip(byId(kind, id), kind, { remove: true })).join("")}</div>` : "";
  const options = matches.length ? `<p class="picker-label">${isTag ? "Etiquetas disponíveis" : "Escolher uma categoria"}</p>
    <ul class="picker-options" role="list">${matches.map(item => {
      const selected = current.includes(item.id);
      return `<li><button class="picker-option" type="button" data-picker-action="toggle" data-id="${item.id}" aria-pressed="${selected}">
        ${chip(item, kind)}${selected ? icon("check") : ""}</button></li>`;
    }).join("")}</ul>` : '<p class="no-options">Nenhuma opção encontrada.</p>';
  const actions = [];
  if (query && !exact) {
    actions.push(`<button class="picker-option create-option" type="button" data-picker-action="create">
      ${icon("plus")} <span>Criar “${escapeHTML(name)}”</span></button>`);
  }
  if (exact?.archived) actions.push('<p class="no-options">Essa opção está arquivada. Reative-a no catálogo para usar novamente.</p>');
  if (!isTag && !query && current.length) {
    actions.push(`<button class="picker-option remove-category" type="button" data-picker-action="remove-category">
      ${icon("close")} Remover categoria</button>`);
  }
  if (!isTag && !query && Object.hasOwn(transaction, "categoryOverride")) {
    actions.push(`<button class="picker-option" type="button" data-picker-action="reset-category">${icon("reset")} Usar classificação automática</button>`);
  }
  const scrollPosition = keepScroll ? pickerContent.scrollTop : 0;
  pickerContent.innerHTML = activeTags + options + (actions.length ? `<div class="picker-actions">${actions.join("")}</div>` : "");
  pickerContent.scrollTop = scrollPosition;
  positionPicker();
}

function changePicker(action, id) {
  const { transaction, kind } = pickerState;
  let message;
  const isTag = kind === "tag";
  if (action === "create") {
    const name = pickerSearch.value.trim();
    if (!normalize(name) || catalogMeta[kind].list.some(item => normalize(item.name) === normalize(name))) return;
    id = newItem(kind, name).id;
    refreshFilters();
  }
  if (isTag) {
    const exists = transaction.tagIds.includes(id);
    transaction.tagIds = exists ? transaction.tagIds.filter(tag => tag !== id) : [...transaction.tagIds, id];
    message = action === "create" ? "Etiqueta criada e aplicada." : exists ? "Etiqueta removida do lançamento." : "Etiqueta aplicada.";
  } else if (action === "reset-category") {
    delete transaction.categoryOverride;
    message = "Classificação automática restaurada.";
  } else {
    transaction.categoryOverride = action === "remove-category" ? null : id;
    message = action === "create" ? "Categoria criada e aplicada." : id ? "Categoria atualizada." : "Categoria removida da compra.";
  }
  renderRows();
  announce(message);
  if (!isTag || !triggerForPicker()) {
    closePicker();
    return;
  }
  if (action === "create") pickerSearch.value = "";
  renderPicker(action !== "create");
  const option = pickerContent.querySelector(`.picker-option[data-id="${id}"]`);
  (action === "create" || !option ? pickerSearch : option).focus({ preventScroll: true });
}

function dialogHeader(title, description) {
  return `<header class="dialog-header">
    <div><h2 id="editor-title">${title}</h2><p>${description}</p></div>
    <button class="icon-button" type="button" data-editor-action="close" aria-label="Fechar janela">${icon("close")}</button>
  </header>`;
}

function submitFooter(label, secondary = "", disabled = false) {
  return `<footer class="dialog-footer">${secondary}
    <button type="button" class="button" data-editor-action="close">Cancelar</button>
    <button type="submit" class="button primary"${disabled ? " disabled" : ""}>${label}</button>
  </footer>`;
}

function catalogEditor(kind, item) {
  const { singular } = catalogMeta[kind];
  const name = item?.name ?? "";
  const isCategory = kind === "category";
  const archive = item && isCategory
    ? `<button type="button" class="text-button secondary-action" data-editor-action="archive">${item.archived ? "Reativar" : "Arquivar"} categoria</button>` : "";
  const help = item
    ? isCategory ? "O novo nome aparecerá nas compras e nos relatórios." : "O novo nome aparecerá nos lançamentos que usam esta etiqueta."
    : isCategory ? "A categoria ficará disponível no extrato e nas regras." : "A etiqueta ficará disponível para adicionar aos lançamentos.";
  return `${dialogHeader(`${item ? "Editar" : "Nova"} ${singular}`, help)}
    <form id="editor-form">
      <div class="dialog-body">
        <label class="field"><span>Nome da ${singular}</span>
          <input name="name" maxlength="80" value="${escapeHTML(name)}" required autofocus aria-describedby="name-error"></label>
        <p class="form-error" id="name-error" role="alert" hidden></p>
        <div class="dialog-preview"><span>Prévia no extrato</span><span id="chip-preview">${chip(
          item ?? { name: isCategory ? "Nova categoria" : "Nova etiqueta", tone: tones[catalogMeta[kind].list.length % tones.length] }, kind,
        )}</span></div>
        ${item?.archived ? '<p class="form-hint">Categoria arquivada. Ela continua visível nas compras anteriores.</p>' : ""}
      </div>
      ${submitFooter(item ? "Salvar alterações" : `Criar ${singular}`, archive)}
    </form>`;
}

function selectField(label, name, options, selected) {
  return `<label class="field"><span>${label}</span><select name="${name}" required>
    ${options.map(([value, text]) => `<option value="${escapeHTML(value)}"${value === selected ? " selected" : ""}>${escapeHTML(text)}</option>`).join("")}
  </select></label>`;
}

function ruleEditor(item) {
  const rule = item ?? { categoryId: "", term: "", match: "contains", bank: "", priority: 100, period: "future", enabled: true };
  const options = categories.filter(category => !category.archived || category.id === rule.categoryId).sort(orderByName)
    .map(category => [category.id, category.name + (category.archived ? " (arquivada)" : "")]);
  const banks = [...new Map(transactions.map(transaction => [bankKey(transaction),
    transaction.card ? `${transaction.bank} •••• ${transaction.card}` : `${transaction.bank} · Conta`]))].sort();
  const bankOptions = [["all", "Todas as contas e cartões"], ...banks];
  return `${dialogHeader(item ? "Editar regra" : "Nova regra", "Classifique automaticamente compras que correspondam aos critérios.")}
    <form id="editor-form">
      <div class="dialog-body">
        ${selectField("Categoria da regra", "categoryId", [["", "Selecione uma categoria"], ...options], rule.categoryId)}
        <div class="form-grid">
          ${selectField("Descrição da compra", "match", Object.entries(ruleMatches).map(([value, option]) => [value, option.label]), rule.match)}
          <label class="field"><span>Texto para identificar a compra</span>
            <input name="term" value="${escapeHTML(rule.term)}" maxlength="200" required autofocus></label>
          ${selectField("Conta ou cartão", "bank", bankOptions, rule.bank || "all")}
          <label class="field"><span>Prioridade</span><input name="priority" type="number" value="${rule.priority}" min="1" max="1000" required></label>
        </div>
        ${selectField("Aplicar a compras de", "period", [["future", "Compras a partir de hoje"], ["history", "Todo o histórico disponível"]], rule.period)}
        <label class="check-field"><input name="enabled" type="checkbox"${rule.enabled ? " checked" : ""}> Regra ativa</label>
        <p class="form-hint">O menor número tem prioridade. Escolhas manuais prevalecem.</p>
        <div><button class="button" type="button" data-editor-action="preview">Revisar compras afetadas</button></div>
        <p class="rule-preview" id="rule-preview" role="status" hidden></p>
        <div id="rule-remove" hidden>
          <p class="form-hint">As compras voltarão a seguir as demais classificações automáticas.</p>
          <button class="button danger" type="button" data-editor-action="remove-rule">Confirmar remoção</button>
        </div>
      </div>
      ${submitFooter(item ? "Salvar regra" : "Criar regra", item
        ? '<button class="text-button secondary-action" type="button" data-editor-action="confirm-rule-removal" aria-expanded="false" aria-controls="rule-remove">Remover regra</button>' : "", true)}
    </form>`;
}

function openEditor(opener) {
  const { editKind: kind, id } = opener.dataset;
  const item = kind === "rule" ? rules.find(rule => rule.id === id) : byId(kind, id);
  editorInfo = { kind, item };
  lastOpener = opener;
  dialog.innerHTML = kind === "rule" ? ruleEditor(item) : catalogEditor(kind, item);
  dialog.showModal();
}

function ruleDraft(form, item) {
  const data = new FormData(form);
  return {
    id: item?.id,
    categoryId: data.get("categoryId"),
    term: data.get("term").trim(),
    match: data.get("match"),
    bank: data.get("bank") === "all" ? "" : data.get("bank"),
    priority: Number(data.get("priority")),
    period: data.get("period"),
    enabled: data.has("enabled"),
  };
}

function withRule(candidate) {
  return candidate.id
    ? rules.map(rule => rule.id === candidate.id ? candidate : rule)
    : [...rules, candidate];
}

function previewRule() {
  const form = dialog.querySelector("form");
  const term = form.elements.namedItem("term");
  term.setCustomValidity(term.value.trim() ? "" : "Informe o texto para identificar a compra.");
  if (!form.reportValidity()) return;
  const candidate = ruleDraft(form, editorInfo.item);
  const proposed = withRule(candidate);
  const count = transactions.filter(transaction => categoryFor(transaction) !== categoryFor(transaction, proposed)).length;
  const manual = transactions.filter(transaction => candidate.enabled
    && Object.hasOwn(transaction, "categoryOverride") && ruleApplies(candidate, transaction)).length;
  const preview = dialog.querySelector("#rule-preview");
  preview.textContent = `${numberLabel(count, "compra será reclassificada", "compras serão reclassificadas")}. ${numberLabel(manual, "escolha manual será preservada", "escolhas manuais serão preservadas")}.`;
  preview.hidden = false;
  form.querySelector('[type="submit"]').disabled = false;
}

function finishEditor(message) {
  dialog.close();
  renderCatalogRows();
  announce(message);
}

dialog.addEventListener("submit", event => {
  event.preventDefault();
  const { kind, item } = editorInfo;
  if (kind === "rule") {
    if (event.target.querySelector('[type="submit"]').disabled) return;
    const candidate = ruleDraft(event.target, item);
    rules = withRule(candidate);
    if (!candidate.id) candidate.id = `rule-${nextId++}`;
    finishEditor(item ? "Regra atualizada." : "Regra criada.");
    return;
  }
  const input = event.target.elements.namedItem("name");
  const name = input.value.trim();
  const duplicate = catalogMeta[kind].list.some(option => option !== item && normalize(option.name) === normalize(name));
  if (!normalize(name) || duplicate) {
    const error = dialog.querySelector("#name-error");
    error.textContent = duplicate ? "Já existe uma opção com esse nome." : "Informe um nome.";
    error.hidden = false;
    input.setAttribute("aria-invalid", "true");
    input.focus();
    return;
  }
  if (item) item.name = name;
  else newItem(kind, name);
  finishEditor(item ? "Nome atualizado." : kind === "category" ? "Categoria criada." : "Etiqueta criada.");
});

dialog.addEventListener("input", event => {
  const { kind, item } = editorInfo;
  if (kind === "rule") {
    dialog.querySelector('[type="submit"]').disabled = true;
    dialog.querySelector("#rule-preview").hidden = true;
    if (event.target.name === "term") event.target.setCustomValidity("");
    return;
  }
  if (event.target.name !== "name") return;
  const nameInput = event.target;
  const preview = dialog.querySelector("#chip-preview");
  const option = item ?? { tone: tones[catalogMeta[kind].list.length % tones.length] };
  preview.innerHTML = chip({ ...option, name: nameInput.value.trim() || `Nova ${catalogMeta[kind].singular}` }, kind);
  nameInput.removeAttribute("aria-invalid");
  dialog.querySelector("#name-error").hidden = true;
});

dialog.addEventListener("click", event => {
  if (event.target === dialog) {
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    return;
  }
  const button = event.target.closest("[data-editor-action]");
  if (!button) return;
  const action = button.dataset.editorAction;
  if (action === "close") dialog.close();
  if (action === "preview") previewRule();
  if (action === "archive") {
    editorInfo.item.archived = !editorInfo.item.archived;
    finishEditor(editorInfo.item.archived ? "Categoria arquivada." : "Categoria reativada.");
  }
  if (action === "confirm-rule-removal") {
    const confirmation = dialog.querySelector("#rule-remove");
    confirmation.hidden = !confirmation.hidden;
    button.setAttribute("aria-expanded", String(!confirmation.hidden));
    if (!confirmation.hidden) confirmation.querySelector("button").focus();
  }
  if (action === "remove-rule") {
    rules = rules.filter(rule => rule.id !== editorInfo.item.id);
    finishEditor("Regra removida.");
  }
});

dialog.addEventListener("close", () => {
  if (lastOpener) {
    const { editKind: kind, id } = lastOpener.dataset;
    const moved = id && main.querySelector(`[data-edit-kind="${kind}"][data-id="${id}"]`);
    const create = main.querySelector(`[data-edit-kind="${kind}"]:not([data-id])`);
    (lastOpener.isConnected ? lastOpener : moved || create)?.focus({ preventScroll: true });
  }
  lastOpener = undefined;
  editorInfo = undefined;
});

main.addEventListener("click", event => {
  const trigger = event.target.closest("[data-kind]");
  const edit = event.target.closest("[data-edit-kind]");
  if (trigger) openPicker(trigger);
  if (edit) openEditor(edit);
});

main.addEventListener("input", event => {
  if (event.target.id === "transaction-search") {
    filters.search = event.target.value;
    renderRows();
  }
  if (event.target.id === "catalog-search") {
    catalogSearch[route] = event.target.value;
    renderCatalogRows();
  }
});

main.addEventListener("change", event => {
  if (event.target.dataset.filter) {
    filters[event.target.dataset.filter] = event.target.value;
    renderRows();
  }
});

pickerSearch.addEventListener("input", () => renderPicker());
picker.addEventListener("click", event => {
  const action = event.target.closest("[data-picker-action]");
  if (!action) return;
  if (action.dataset.pickerAction === "close") closePicker();
  else changePicker(action.dataset.pickerAction, action.dataset.id);
});

document.addEventListener("pointerdown", event => {
  if (pickerState && !picker.contains(event.target) && !event.target.closest("[data-kind]")) closePicker(false);
});
document.addEventListener("keydown", event => {
  if (!pickerState) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closePicker();
    return;
  }
  if (!picker.contains(event.target)) return;
  const options = [...pickerContent.querySelectorAll("button.picker-option")];
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    const current = options.indexOf(document.activeElement);
    const index = event.key === "ArrowDown" ? Math.min(options.length - 1, current + 1) : current - 1;
    event.preventDefault();
    (options[index] ?? pickerSearch).focus();
  }
  if (event.key === "Enter" && event.target === pickerSearch) {
    const query = normalize(pickerSearch.value);
    const { kind } = pickerState;
    const exact = query && catalogMeta[kind].list.find(item => !item.archived && normalize(item.name) === query);
    const match = exact && pickerContent.querySelector(`.picker-option[data-id="${exact.id}"]`);
    event.preventDefault();
    (match || pickerContent.querySelector(".create-option") || options[0])?.click();
  }
});

picker.addEventListener("focusout", event => {
  if (event.relatedTarget && !picker.contains(event.relatedTarget) && event.relatedTarget !== triggerForPicker()) closePicker(false);
});

const themeToggle = document.querySelector("#theme-toggle");
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute("aria-label", theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro");
  themeToggle.innerHTML = icon(theme === "dark" ? "sun" : "moon");
}
themeToggle.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

document.querySelectorAll("[data-icon]").forEach(element => { element.innerHTML = icon(element.dataset.icon); });
picker.querySelector(".picker-close").innerHTML = icon("close");
setTheme("light");
renderRoute();
window.addEventListener("hashchange", () => {
  renderRoute();
  window.scrollTo(0, 0);
  if (location.hash !== "#conteudo") main.focus({ preventScroll: true });
});
window.addEventListener("resize", positionPicker);
window.addEventListener("scroll", positionPicker, { passive: true });
