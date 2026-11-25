const icons = {
  home: '<path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M9 21v-7h6v7"/>',
  list: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h4"/>',
  chart: '<path d="M12 3v9h9A9 9 0 1 1 12 3Z"/><path d="M15 3.55A8 8 0 0 1 20.45 9H15z"/>',
  bank: '<path d="m3 9 9-5 9 5v2H3zm0 11h18M6 11v6m4-6v6m4-6v6m4-6v6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  moon: '<path d="M20.8 14A8.9 8.9 0 0 1 10 3.2 9 9 0 1 0 20.8 14Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  user: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 20v-1.7a6.5 5 0 0 1 13 0V20"/>',
  right: '<path d="M4.5 12h15m-6-6 6 6-6 6"/>',
  left: '<path d="M19.5 12h-15m6-6-6 6 6 6"/>',
  incoming: '<path d="M18 6 6 18m0-8v8h8"/>',
  outgoing: '<path d="M6 18 18 6m-8 0h8v8"/>',
  pulse: '<path d="M3 12h4l2.5-6L14 18l2.5-6H21"/>',
  food: '<path d="M3 4h2l2.5 10h10.8l2-7H6.1"/><circle cx="9" cy="19" r="1.2"/><circle cx="17" cy="19" r="1.2"/>',
  health: '<path d="M8 5h8v4h4v6h-4v4H8v-4H4V9h4z"/>',
  transport: '<path d="m5 10 1.6-5h10.8l1.6 5M4 16h16v-5l-2-1H6l-2 1zm2 0v3m12-3v3M7 13h1m8 0h1"/>',
  wallet: '<path d="M20 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v12H5a2 2 0 0 1-2-2V6"/><path d="M20 12h-5a2 2 0 0 0 0 4h5"/>',
  retail: '<path d="M5 8h14l1 12H4L5 8Zm4 1V7a3 3 0 0 1 6 0v2"/>',
  leisure: '<path d="M15 3 9 9m-2-2-4 4 10 10 4-4m-2-2 6-6M8 8l8 8m-3-11 6 6"/>',
  link: '<path d="M10 13.5 14 10m-6 1-3 3a3.5 3.5 0 0 0 5 5l3-3m-2-8 3-3a3.5 3.5 0 0 1 5 5l-3 3"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  check: '<path d="m5 12 4 4 10-10"/>',
  tag: '<path d="M4 4h8l8 8-8 8-8-8zm4 4h.01"/>',
};

function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
}

const navigation = [
  { route: "visao-geral", label: "Visão geral", icon: "home" },
  { route: "lancamentos", label: "Extrato", icon: "list" },
  { route: "gastos", label: "Gastos", icon: "chart" },
  { route: "contas", label: "Contas", icon: "bank" },
];

const groups = {
  lancamentos: [["lancamentos", "Lançamentos"], ["a-receber", "A receber"]],
  gastos: [["gastos", "Por categoria"], ["gastos/ritmo", "Ritmo de gastos"], ["categorias", "Categorias e regras"]],
  contas: [
    ["contas", "Contas"], ["contas/evolucao", "Evolução"], ["contas/conciliacao", "Conciliação"],
    ["cartoes", "Cartões"], ["conexoes", "Conexões"],
  ],
};

const categories = {
  food: { label: "Alimentação", icon: "food" },
  housing: { label: "Moradia", icon: "home" },
  health: { label: "Saúde", icon: "health" },
  transport: { label: "Transporte", icon: "transport" },
  income: { label: "Receitas", icon: "wallet" },
  leisure: { label: "Lazer", icon: "leisure" },
  retail: { label: "Compras", icon: "retail" },
};

const tags = {
  fixed: "Custo fixo",
  work: "Trabalho",
  shared: "Dividido",
  recurrence: "Recorrente",
  essential: "Essencial",
};

const banks = {
  itau: { name: "Itaú", monogram: "it" },
  nubank: { name: "Nubank", monogram: "nu" },
  inter: { name: "Inter", monogram: "in" },
  other: { name: "Outra instituição" },
};

const demoCards = {
  "itau-4821": { bank: "itau", lastFour: "4821", nov: 248000, oct: 193680 },
  "nubank-7032": { bank: "nubank", lastFour: "7032", nov: 124840, oct: 103620 },
};

const periods = {
  "2026-11": { name: "Novembro de 2026", short: "Novembro", end: "24", balances: [1845000, 2167520, 2219340, 2428470, 2532380, 2684260] },
  "2026-10": { name: "Outubro de 2026", short: "Outubro", end: "31", balances: [1784200, 1845000, 2167520, 2219340, 2428470, 2532380] },
};

const examples = [
  { id: "mercado", name: "Mercado do Bairro", category: "food", tags: ["essential"], bank: "itau", card: "itau-4821", day: 24, nov: -24680, oct: -22830 },
  { id: "salario", name: "Salário", category: "income", tags: ["work", "recurrence"], bank: "nubank", day: 23, nov: 625000, oct: 625000 },
  { id: "farmacia", name: "Farmácia Central", category: "health", tags: ["shared"], bank: "inter", day: 22, nov: -15490, oct: -10575 },
  { id: "corrida", name: "Aplicativo de mobilidade", category: "transport", tags: [], bank: "nubank", card: "nubank-7032", day: 21, nov: -3820, oct: -4950 },
  { id: "livraria", name: "Livraria da Praça", category: "leisure", tags: ["shared"], bank: "itau", card: "itau-4821", day: 20, nov: -18990, oct: -10680 },
  { id: "almoco", name: "Almoço de domingo", category: "food", tags: ["shared"], bank: "nubank", card: "nubank-7032", day: 18, nov: -7190, oct: -8250 },
  { id: "compra", name: "Loja do Centro", category: "retail", tags: ["essential"], bank: "inter", day: 16, nov: -19990, oct: -33150 },
  { id: "feira", name: "Feira e abastecimento", category: "food", tags: [], bank: "itau", day: 14, nov: -62827, oct: -72150 },
  { id: "reembolso", name: "Reembolso de passagem", category: "income", tags: ["work"], bank: "other", day: 12, nov: 46000, oct: 32500 },
  { id: "moradia", name: "Aluguel do mês", category: "housing", tags: ["fixed", "recurrence"], bank: "itau", day: 5, nov: -185000, oct: -185000 },
];

const main = document.querySelector("main");
const filterState = { search: "", type: "", bank: "", card: "" };
let selectedPeriod = "2026-11";
let currentTheme;
const preference = matchMedia("(prefers-color-scheme: dark)");
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const wholePercent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const money = cents => currency.format(cents / 100);
const signed = cents => `${cents < 0 ? "−" : "+"}${money(Math.abs(cents))}`;
const tile = (shape, tone = "") => `<span class="tile ${tone}" aria-hidden="true">${icon(shape)}</span>`;
const logo = (theme, decorative = false) => `<img class="logo${decorative ? ` logo-${theme}` : ""}" src="balsave-logo-${theme}.svg" alt="${decorative ? "" : "Balsave"}" width="186" height="48">`;
const arrowLink = (href, label) => `<a class="text-link" href="#${href}">${label}${icon("right")}</a>`;

function themePreference() {
  try {
    return localStorage.getItem("balsave-design-theme");
  } catch {
    return null;
  }
}

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  const toggle = document.querySelector("#theme-toggle");
  const dark = theme === "dark";
  toggle.innerHTML = icon(dark ? "sun" : "moon");
  const label = dark ? "Ativar tema claro" : "Ativar tema escuro";
  toggle.setAttribute("aria-label", label);
  toggle.title = label;
}

function selectTheme() {
  const theme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(theme);
  try {
    localStorage.setItem("balsave-design-theme", theme);
  } catch {
    // The theme remains active for this page when browser storage is unavailable.
  }
}

function routeInfo() {
  const [path, query = ""] = location.hash.slice(1).split("?");
  const parts = path.split("/");
  const root = parts[0];
  const allowed = ["visao-geral", "lancamentos", "a-receber", "gastos", "categorias", "contas", "cartoes", "conexoes", "acesso", "identidade"];
  return {
    root: allowed.includes(root) ? root : "visao-geral",
    sub: parts[1],
    query: new URLSearchParams(query),
  };
}

function sectionRoot(root) {
  return Object.entries(groups).find(([, paths]) => paths.some(([path]) => path === root))?.[0] ?? root;
}

function updateNavigation(root) {
  for (const nav of document.querySelectorAll(".desktop-nav, .mobile-nav")) {
    nav.innerHTML = navigation.map(({ route, label, icon: shape }) => {
      const selected = route === sectionRoot(root);
      const mobileLabel = route === "visao-geral" && nav.classList.contains("mobile-nav") ? "Início" : label;
      return `<a href="#${route}" ${selected ? `aria-current="${route === root ? "page" : "true"}"` : ""}>
        <span class="nav-icon">${icon(shape)}</span><span>${mobileLabel}</span></a>`;
    }).join("");
  }
}

function groupNav(route, active) {
  return `<nav class="subnav" aria-label="Nesta seção">${groups[route].map(([path, label]) =>
    `<a href="#${path}" ${path === active ? 'aria-current="page"' : ""}>${label}</a>`
  ).join("")}</nav>`;
}

function periodPicker() {
  return `<label class="field">${icon("calendar")}<select data-period aria-label="Período">
    ${Object.entries(periods).map(([id, period]) => `<option value="${id}" ${selectedPeriod === id ? "selected" : ""}>${period.name}</option>`).join("")}
  </select></label>`;
}

function heading(title, description, period = true) {
  document.title = `${title} · Balsave`;
  return `<section class="page-heading"><div><h1 tabindex="-1">${title}</h1>${description ? `<p>${description}</p>` : ""}</div>
    ${period ? periodPicker() : ""}</section>`;
}

function panelHeader(title, subtitle = "", link = "") {
  return `<div class="panel-heading"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div>${link}</div>`;
}

function categoryChip(id) {
  const category = categories[id];
  return `<span class="chip category ${id}">${icon(category.icon)}${category.label}</span>`;
}

function classifications(row, extra = "") {
  return `<span class="chip-group ${extra}">${categoryChip(row.category)}
    ${row.tags.map(tag => `<span class="chip tag ${tag}">${tags[tag]}</span>`).join("")}</span>`;
}

function bankBadge(id) {
  const bank = banks[id];
  return `<span class="bank"><span class="bank-mark ${id}" aria-hidden="true">${bank.monogram ?? icon("bank")}</span>
    <span class="bank-name">${bank.name}</span></span>`;
}

function transactions() {
  return examples.map(row => ({ ...row, cents: selectedPeriod === "2026-11" ? row.nov : row.oct }));
}

function totals(rows) {
  return rows.reduce((sum, { cents }) => {
    sum[cents > 0 ? "income" : "expenses"] += Math.abs(cents);
    return sum;
  }, { income: 0, expenses: 0 });
}

function transactionTable(rows, live = false) {
  return `<div class="transaction-rail">
    <table class="transaction-table" aria-label="Lançamentos no período" ${live ? 'data-table' : ""} ${rows.length ? "" : "hidden"}>
      <thead><tr><th scope="col">Lançamento</th><th scope="col" class="desktop-only">Classificação</th><th scope="col" class="desktop-only">Banco / cartão</th><th scope="col">Valor</th></tr></thead>
      <tbody>${tableRows(rows)}</tbody>
    </table>
    <p class="empty" data-empty role="status" ${rows.length ? "hidden" : ""}>Nenhum lançamento com esses filtros.</p>
  </div>`;
}

function tableRows(rows) {
  const month = selectedPeriod.slice(5);
  return rows.map(row => {
    const incoming = row.cents > 0;
    const card = demoCards[row.card];
    const cardLabel = card ? `Cartão •••• ${card.lastFour}` : "";
    return `<tr><td><a class="table-name" href="#lancamentos/${row.id}">${tile(categories[row.category].icon)}
      <span><strong>${row.name}</strong><span class="table-meta">${row.day}/${month}<span class="compact-only"> · ${banks[row.bank].name}${card ? ` •••• ${card.lastFour}` : ""}</span></span></span></a>
      ${classifications(row, "compact-only")}</td>
      <td class="desktop-only">${classifications(row)}</td>
      <td class="desktop-only">${bankBadge(row.bank)}${card ? `<span class="table-meta">${cardLabel}</span>` : ""}</td>
      <td><span class="table-value ${incoming ? "positive" : ""}" title="${incoming ? "Entrada" : "Saída"}">
      ${icon(incoming ? "incoming" : "outgoing")}${signed(row.cents)}</span></td></tr>`;
  }).join("");
}

function categoryList(rows, limit) {
  const sum = totals(rows).expenses;
  const values = Object.keys(categories).map(id => ({
    id, cents: rows.filter(row => row.category === id && row.cents < 0).reduce((value, row) => value - row.cents, 0),
  })).filter(row => row.cents).sort((a, b) => b.cents - a.cents).slice(0, limit);
  return `<ul class="category-list">${values.map(({ id, cents }) => `<li>
    <a class="category-link" href="#gastos?categoria=${id}">
      ${tile(categories[id].icon)}<span class="category-breakdown"><span class="category-name">${categories[id].label}</span>
      <span class="category-bar" aria-hidden="true"><span style="width:${Math.round(cents * 100 / sum)}%"></span></span></span>
      <span class="category-value">${money(cents)}</span>
    </a></li>`).join("")}</ul>`;
}

function trend(graph, labels, range, axis, legend) {
  const points = graph.map((cents, index) => ({
    x: 3 + 94 * index / (graph.length - 1),
    y: 92 - 84 * (cents - range[0]) / (range[1] - range[0]),
  }));
  const path = points.map(({ x, y }) => `${x},${y}`).join(" ");
  const final = points.at(-1);
  return `<figure class="chart" aria-label="${legend}">
    <div class="chart-plot">
      <div class="axis" aria-hidden="true">${axis.map((label, index) => `<span style="top:${8 + index * 28}%">${label}</span>`).join("")}</div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        ${[8, 36, 64, 92].map(y => `<line class="chart-grid" x1="0" y1="${y}" x2="100" y2="${y}"/>`).join("")}
        <polygon class="chart-fill" points="3,92 ${path} 97,92"/>
        <polyline class="chart-line" points="${path}"/>
      </svg>
      <span class="chart-guide" style="left:${final.x}%"></span>
      <span class="chart-dot" style="left:${final.x}%;top:${final.y}%"></span>
    </div>
    <div class="chart-dots">${graph.map((cents, index) => `
      <button type="button" aria-pressed="${index === graph.length - 1}" data-chart-point
       data-x="${points[index].x}" data-y="${points[index].y}"
       aria-label="${labels[index]}, ${money(cents)}">${labels[index]}</button>`).join("")}
    </div>
    <p class="chart-readout muted" aria-live="polite">${labels.at(-1)}, ${money(graph.at(-1))}</p>
  </figure>`;
}

function balancePanel() {
  const { balances } = periods[selectedPeriod];
  const labels = selectedPeriod === "2026-11" ? ["Jun", "Jul", "Ago", "Set", "Out", "Nov"] : ["Mai", "Jun", "Jul", "Ago", "Set", "Out"];
  const value = balances.at(-1);
  const variation = wholePercent.format((value - balances.at(-2)) * 100 / balances.at(-2));
  return `<section class="panel balance">
    ${panelHeader("Saldo consolidado", "Contas e investimentos acompanhados", arrowLink("contas", "Ver contas"))}
    <p class="amount-large">${money(value)}</p>
    <div class="balance-meta"><span class="delta">${icon("outgoing")} +${variation}%</span><span class="muted">em relação ao mês anterior</span></div>
    ${trend(balances, labels, [1600000, 2800000], ["R$ 28 mil", "R$ 24 mil", "R$ 20 mil", "R$ 16 mil"], "Evolução do saldo em seis meses")}
  </section>`;
}

function overview() {
  const all = transactions();
  const { name, end, short } = periods[selectedPeriod];
  const { income, expenses } = totals(all);
  const metrics = [
    { label: "Entradas", icon: "incoming", tone: "in", value: signed(income) },
    { label: "Saídas", icon: "outgoing", tone: "out", value: signed(-expenses) },
    { label: "Saldo do mês", icon: "pulse", tone: "", value: money(income - expenses) },
  ];
  return `${heading("Visão geral", "Acompanhe suas contas, seus gastos e a evolução do saldo.")}
    <div class="overview-grid">
      ${balancePanel()}
      <section class="panel panel-tinted monthly">${panelHeader("Resumo do mês", `1 a ${end} de ${short.toLowerCase()}`)}
        <dl class="monthly-list">${metrics.map(metric => `<div>${tile(metric.icon, metric.tone)}<dt>${metric.label}</dt>
          <dd class="summary-amount ${metric.tone === "in" ? "positive" : ""}">${metric.value}</dd></div>`).join("")}</dl>
        ${arrowLink("lancamentos", "Explorar extrato")}
      </section>
      <section class="panel transactions-panel">${panelHeader("Lançamentos recentes", name, arrowLink("lancamentos", "Ver extrato"))}
        ${transactionTable(all.slice(0, 4))}
      </section>
      <section class="panel">${panelHeader("Gastos por categoria", "Maiores despesas do período", arrowLink("gastos", "Ver gastos"))}
        ${categoryList(all, 4)}
      </section>
    </div>`;
}

function reportMetrics(metrics) {
  return `<div class="report-metrics">${metrics.map(([label, value]) => `
    <div class="report-metric"><span>${label}</span><strong class="summary-amount">${value}</strong></div>`).join("")}</div>`;
}

function normalized(text) {
  return text.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function filteredTransactions() {
  const term = normalized(filterState.search.trim());
  return transactions().filter(row => {
    const text = [row.name, categories[row.category].label, banks[row.bank].name, demoCards[row.card]?.lastFour, ...row.tags.map(tag => tags[tag])].join(" ");
    const matchesType = filterState.type === "" || (filterState.type === "in" ? row.cents > 0 : row.cents < 0);
    return matchesType
      && (!filterState.bank || row.bank === filterState.bank)
      && (!filterState.card || row.card === filterState.card)
      && normalized(text).includes(term);
  });
}

function updateCardFilter() {
  const select = main.querySelector("[data-filter-card]");
  const choices = Object.entries(demoCards).filter(([, card]) => !filterState.bank || card.bank === filterState.bank);
  if (!choices.some(([id]) => id === filterState.card)) filterState.card = "";
  const defaultLabel = choices.length ? "Todos os cartões" : "Sem cartões";
  select.innerHTML = `<option value="">${defaultLabel}</option>` + choices.map(([id, card]) =>
    `<option value="${id}">${banks[card.bank].name} •••• ${card.lastFour}</option>`
  ).join("");
  select.value = filterState.card;
  select.disabled = choices.length === 0;
}

function refreshStatement() {
  const rows = filteredTransactions();
  const table = main.querySelector("[data-table]");
  table.hidden = rows.length === 0;
  table.tBodies[0].innerHTML = tableRows(rows);
  main.querySelector("[data-empty]").hidden = rows.length > 0;
  const { income, expenses } = totals(rows);
  main.querySelector("[data-statement-totals]").innerHTML = reportMetrics([
    ["Entradas", money(income)], ["Saídas", money(expenses)], ["Total líquido", money(income - expenses)],
  ]);
}

function statement() {
  return `${heading("Lançamentos", "Consulte entradas, saídas e classificações.")}
    ${groupNav("lancamentos", "lancamentos")}
    <div class="report-stack">
      <div class="filters">
        <label class="field search">${icon("search")}<input type="search" data-filter-search aria-label="Buscar no extrato" placeholder="Buscar"></label>
        <label class="field"><select data-filter-type aria-label="Tipo de movimento">
          <option value="">Todos os tipos</option><option value="in">Entradas</option><option value="out">Saídas</option>
        </select></label>
        <label class="field"><select data-filter-bank aria-label="Banco">
          <option value="">Todos os bancos</option>
          ${Object.entries(banks).map(([id, bank]) => `<option value="${id}">${bank.name}</option>`).join("")}
        </select></label>
        <label class="field"><select data-filter-card aria-label="Cartão"></select></label>
      </div>
      <div data-statement-totals aria-live="polite"></div>
      <section class="panel transactions-panel">${panelHeader("Histórico de lançamentos")}${transactionTable(filteredTransactions(), true)}</section>
    </div>`;
}

function transactionDetail(id) {
  const row = transactions().find(transaction => transaction.id === id);
  if (!row) return `${heading("Lançamento indisponível", "", false)}${arrowLink("lancamentos", "Abrir extrato")}`;
  const card = demoCards[row.card];
  const previous = history.state?.from;
  const back = previous === "a-receber" ? "a-receber" : "lancamentos";
  return `<a class="text-link detail-back" href="#${back}">${icon("left")} ${back === "a-receber" ? "Voltar para A receber" : "Voltar ao extrato"}</a>
    ${heading(row.name, `${row.day}/${selectedPeriod.slice(5)}/2026 · Detalhe do lançamento`, false)}
    <section class="panel preview-narrow">
      ${panelHeader(row.cents > 0 ? "Entrada" : "Saída")}
      <div class="panel-padding section-copy">
        <div class="balance-meta">${tile(row.cents > 0 ? "incoming" : "outgoing", row.cents > 0 ? "in" : "out")}<strong class="summary-amount">${signed(row.cents)}</strong></div>
        <p>Instituição</p>${bankBadge(row.bank)}
        ${card ? `<p>Cartão •••• ${card.lastFour}</p>` : ""}
        <p>Categoria e etiquetas</p>${classifications(row)}
      </div>
    </section>`;
}

function spending(query, rhythm) {
  const all = transactions();
  const category = Object.hasOwn(categories, query.get("categoria")) ? query.get("categoria") : "";
  const filtered = all.filter(row => row.cents < 0 && (!category || row.category === category));
  const title = rhythm ? "Ritmo de gastos" : "Gastos por categoria";
  const content = rhythm ? rhythmChart(all) : `<div class="report-columns">
    <section class="panel">${panelHeader("Distribuição dos gastos", "Selecione uma categoria para filtrar as compras.")}${categoryList(all, 8)}</section>
    <section class="panel panel-tinted">
      ${panelHeader(category ? categories[category].label : "Gasto líquido")}
      <div class="panel-padding section-copy"><strong class="amount-large">${money(totals(filtered).expenses)}</strong>
        <p>${filtered.length} compras no período</p>
        ${category ? arrowLink("gastos", "Limpar categoria") : arrowLink("categorias", "Gerenciar categorias")}
      </div>
    </section>
  </div>
  <section class="panel transactions-panel">${panelHeader(category ? `Compras em ${categories[category].label}` : "Compras no período")}
    ${transactionTable(filtered)}</section>`;
  return `${heading(title, "Entenda como as despesas se distribuem ao longo do mês.")}
    ${groupNav("gastos", rhythm ? "gastos/ritmo" : "gastos")}<div class="report-stack">${content}</div>`;
}

function rhythmChart(all) {
  const days = [1, 7, 14, 21, Number(periods[selectedPeriod].end)];
  const accumulated = days.map(day => totals(all.filter(row => row.day <= day)).expenses);
  const last = accumulated.at(-1);
  return `<section class="panel balance">
    ${panelHeader("Gasto acumulado", "Despesas registradas até cada dia da seleção.")}
    <p class="amount-large">${money(last)}</p>
    ${trend(accumulated, days.map(String), [0, 450000], ["R$ 4,5 mil", "R$ 3 mil", "R$ 1,5 mil", "R$ 0"], "Gasto acumulado por dia")}
  </section>`;
}

function categorySettings() {
  const rules = [
    ["Mercado no nome do lançamento", "food"], ["Aluguel no nome do lançamento", "housing"], ["Farmácia no nome do lançamento", "health"],
  ];
  return `${heading("Categorias e regras", "Veja como as transações são classificadas.", false)}
    ${groupNav("gastos", "categorias")}
    <div class="report-columns">
      <section class="panel">${panelHeader("Minhas categorias")}
        <ul class="report-list">${Object.keys(categories).map(id => `<li>${categoryChip(id)}</li>`).join("")}</ul>
      </section>
      <section class="panel">${panelHeader("Minhas regras", "Exemplos de classificação automática")}
        <ul class="report-list">${rules.map(([rule, id]) => `<li><span>${rule}</span><span class="end">${categoryChip(id)}</span></li>`).join("")}</ul>
      </section>
    </div>`;
}

function receivables() {
  return `${heading("A receber", "Acompanhe valores esperados e reembolsos.")}
    ${groupNav("lancamentos", "a-receber")}
    <div class="report-stack">
      ${reportMetrics([["Pendente", money(82000)], ["Recebido", money(selectedPeriod === "2026-11" ? 46000 : 32500)], ["Itens em aberto", "1"]])}
      <section class="panel">${panelHeader("Reembolsos")}
        <ul class="report-list">
          <li>${tile("wallet")}<div><strong>Despesas compartilhadas</strong><p class="muted">Pendente</p></div><strong class="end">${money(82000)}</strong></li>
          <li>${tile("incoming", "in")}<div><a href="#lancamentos/reembolso" data-from-receivables><strong>Reembolso de passagem</strong></a><p class="muted">Recebido</p></div><strong class="end">${money(selectedPeriod === "2026-11" ? 46000 : 32500)}</strong></li>
        </ul>
      </section>
    </div>`;
}

const accountExamples = [
  { bank: "itau", account: "Conta corrente", nov: 742015, oct: 691140 },
  { bank: "itau", account: "Poupança", nov: 200000, oct: 200000 },
  { bank: "nubank", account: "Conta digital", nov: 612250, oct: 595240 },
  { bank: "inter", account: "Conta digital", nov: 320000, oct: 305000 },
];

function accounts(sub, query) {
  const bank = accountExamples.some(item => item.bank === query.get("banco")) ? query.get("banco") : "";
  const monthKey = selectedPeriod === "2026-11" ? "nov" : "oct";
  const visible = accountExamples.filter(item => !bank || item.bank === bank);
  const accountTotal = accountExamples.reduce((sum, item) => sum + item[monthKey], 0);
  const investments = periods[selectedPeriod].balances.at(-1) - accountTotal;
  const bankPanel = `<section class="panel">${panelHeader("Saldos por conta", bank ? banks[bank].name : "Instituições acompanhadas")}
    <ul class="report-list">${visible.map(item => `<li>${bankBadge(item.bank)}<div><a href="#contas?banco=${item.bank}">${item.account}</a></div><strong class="end">${money(item[monthKey])}</strong></li>`).join("")}</ul>
    ${bank ? `<div class="panel-padding">${arrowLink("contas", "Todas as instituições")}</div>` : ""}
  </section>`;
  const overview = `${reportMetrics([["Saldo em contas", money(accountTotal)], ["Investimentos", money(investments)], ["Saldo consolidado", money(accountTotal + investments)]])}
    <div class="report-columns">${bankPanel}
      <section class="panel panel-tinted">${panelHeader("Investimentos", "Posições acompanhadas")}
        <ul class="report-list">
          <li>${tile("wallet")}<span>Renda fixa</span><strong class="end">${money(investments)}</strong></li>
        </ul>
      </section>
    </div>
    ${bank ? `<section class="panel">${panelHeader("Extrato da instituição")}${transactionTable(transactions().filter(row => row.bank === bank))}</section>` : ""}`;
  const reconciliation = `<section class="panel">${panelHeader("Movimentações do período", "Exemplo de conferência de entradas e saídas.")}
    ${transactionTable(transactions().slice(0, 5))}</section>`;
  const tab = sub === "evolucao" || sub === "conciliacao" ? sub : "";
  const title = tab === "evolucao" ? "Evolução do saldo" : tab === "conciliacao" ? "Conciliação" : "Contas";
  return `${heading(title, "Veja seus saldos, investimentos e movimentações.")}
    ${groupNav("contas", tab ? `contas/${tab}` : "contas")}
    <div class="report-stack">${tab === "evolucao" ? balancePanel() : tab === "conciliacao" ? reconciliation : overview}</div>`;
}

function cards() {
  const monthKey = selectedPeriod === "2026-11" ? "nov" : "oct";
  const cards = Object.values(demoCards);
  const total = cards.reduce((sum, card) => sum + card[monthKey], 0);
  return `${heading("Cartões", "Consulte seus limites e acompanhe as faturas.")}
    ${groupNav("contas", "cartoes")}
    <div class="report-stack">
      ${reportMetrics([["Limite total", money(1500000)], ["Limite usado", money(total)], ["Limite disponível", money(1500000 - total)]])}
      <div class="report-columns">${cards.map(card => `<section class="panel">
        ${panelHeader(`Cartão •••• ${card.lastFour}`, "Fatura aberta", bankBadge(card.bank))}
        <ul class="report-list">
          <li><span>Valor da fatura</span><strong class="end">${money(Math.round(card[monthKey] / 2))}</strong></li>
          <li><span>Limite utilizado</span><strong class="end">${money(card[monthKey])}</strong></li>
        </ul>
      </section>`).join("")}</div>
    </div>`;
}

function connections() {
  return `${heading("Conexões", "Acompanhe as instituições conectadas pelo Open Finance.", false)}
    ${groupNav("contas", "conexoes")}
    <section class="panel preview-narrow">${panelHeader("Instituições conectadas", "Estados ilustrativos do Meu Pluggy")}
      <ul class="report-list">${["itau", "nubank", "inter"].map(id => `<li>${bankBadge(id)}
        <span class="end status${id === "inter" ? " attention" : ""}">${id === "inter" ? "Requer atenção" : "Sincronizada"}</span></li>`).join("")}</ul>
      <div class="panel-padding"><button class="button" type="button" data-connection-demo>${icon("link")} Conectar instituição</button>
        <p class="subtext" data-connection-status role="status"></p></div>
    </section>`;
}

function access() {
  return `${heading("Acesse sua conta", "Controle, patrimônio e evolução.", false)}
    <section class="panel preview-narrow"><div class="panel-padding section-copy">
      <h2 class="panel-title">Área de acesso</h2><p>Esta demonstração usa dados fictícios e está pronta para explorar.</p>
      <div class="button-stack"><a class="button primary" href="#visao-geral">Explorar demonstração ${icon("right")}</a></div>
    </div></section>`;
}

function identity() {
  const palette = [["Branco", "#FFFFFF"], ["Grafite", "#101211"], ["Verde", "#246546"], ["Verde claro", "#A6DBB9"]];
  const destinations = {
    "visao-geral": [["visao-geral", "Painel financeiro"]],
    ...groups,
  };
  return `${heading("Identidade visual", "Controle, patrimônio e evolução.", false)}
    <div class="report-stack brand-board">
      <div class="report-columns">
        <div class="brand-sample light">${logo("light")}<a download href="balsave-logo-light.svg">Baixar logo para fundo claro</a></div>
        <div class="brand-sample dark">${logo("dark")}<a download href="balsave-logo-dark.svg">Baixar logo para fundo escuro</a></div>
      </div>
      <section class="panel"><div class="panel-padding section-copy">
        <h2 class="panel-title">Marca e cores</h2>
        <p>O monograma combina o B de Balsave com uma seta ascendente. Playfair Display dá presença aos títulos e Inter mantém os números e controles legíveis.</p>
        <div class="swatches">${palette.map(([name, hex]) => `<div class="swatch"><span style="background:${hex}"></span><strong>${name}</strong><br>${hex}</div>`).join("")}</div>
        <div class="button-stack"><a class="button" download href="balsave-symbol.svg">Baixar símbolo do app</a></div>
      </div></section>
      <section class="panel"><div class="panel-padding section-copy">
        <h2 class="panel-title">Categorias, etiquetas e bancos</h2>
        <p>Categorias usam fundo colorido e ícone. Etiquetas usam contorno e formato arredondado. As duas podem aparecer juntas no mesmo lançamento.</p>
        ${classifications({ category: "food", tags: ["essential", "shared"] })}
        ${classifications({ category: "income", tags: ["work", "recurrence"] })}
        <p>Setas e sinais diferenciam entrada e saída. As instituições têm identificadores compactos e mantêm o nome visível.</p>
        <div class="button-stack">${Object.keys(banks).map(bankBadge).join("")}</div>
      </div></section>
      <section class="panel"><div class="panel-padding">
        <div class="section-copy"><h2 class="panel-title">Mapa de navegação</h2>
          <p>Os quatro destinos ficam no cabeçalho do desktop e na barra inferior do iPhone. O menu de perfil dá acesso à conta.</p>
        </div>
        <ul class="navigation-map">${navigation.map(({ route, label, icon: shape }) => `<li>
          <strong>${icon(shape)}${label}</strong>
          <ul>${destinations[route].map(([path, item]) => `<li><a href="#${path}">${item}</a></li>`).join("")}</ul>
        </li>`).join("")}</ul>
      </div></section>
      <section class="panel"><div class="panel-padding section-copy">
        <h2 class="panel-title">Referências</h2>
        <ul class="references">
          <li>Categorias ligadas aos lançamentos. <a href="https://ajuda.pierre.finance/pt-BR/articles/17694932-como-mudar-a-categoria-de-um-gasto">Pierre</a></li>
          <li>Painel com acesso direto ao detalhamento e aos relatórios. <a href="https://www.meudinheiro.net/">Meu Dinheiro</a></li>
          <li>Conexões organizadas por instituição. <a href="https://meu.pluggy.ai/">Meu Pluggy</a> e <a href="https://v2.docs.pluggy.ai/en/docs/guides/dashboard-connectors">Pluggy Dashboard</a></li>
          <li>Cabeçalho com poucos destinos e navegação inferior no iPhone. <a href="https://www.apple.com/br/">Apple Brasil</a> e <a href="https://developer.apple.com/design/human-interface-guidelines/tab-bars">Diretrizes de navegação da Apple</a></li>
        </ul>
      </div></section>
    </div>`;
}

function render(focus = false) {
  const { root, sub, query } = routeInfo();
  const pages = {
    "visao-geral": overview,
    lancamentos: () => sub ? transactionDetail(sub) : statement(),
    "a-receber": receivables,
    gastos: () => spending(query, sub === "ritmo"),
    categorias: categorySettings,
    contas: () => accounts(sub, query),
    cartoes: cards,
    conexoes: connections,
    acesso: access,
    identidade: identity,
  };
  updateNavigation(root);
  main.innerHTML = pages[root]();
  if (root === "lancamentos" && !sub) {
    main.querySelector("[data-filter-search]").value = filterState.search;
    main.querySelector("[data-filter-type]").value = filterState.type;
    main.querySelector("[data-filter-bank]").value = filterState.bank;
    updateCardFilter();
    refreshStatement();
  }
  if (focus) {
    main.querySelector("h1")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

document.querySelector(".brand").innerHTML = logo("light", true) + logo("dark", true);
const profile = document.querySelector(".profile");
profile.querySelector("summary").innerHTML = icon("user");
document.querySelector("#theme-toggle").addEventListener("click", selectTheme);
applyTheme(themePreference() ?? (preference.matches ? "dark" : "light"));
preference.addEventListener("change", event => {
  if (!themePreference()) applyTheme(event.matches ? "dark" : "light");
});

document.querySelector(".skip").addEventListener("click", event => {
  event.preventDefault();
  main.focus();
});
window.addEventListener("hashchange", () => {
  profile.open = false;
  render(true);
});
document.addEventListener("click", event => {
  if (profile.open && !profile.contains(event.target)) profile.open = false;
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && profile.open) {
    profile.open = false;
    profile.querySelector("summary").focus();
  }
});

main.addEventListener("change", event => {
  const target = event.target;
  if (target.matches("[data-period]")) {
    selectedPeriod = target.value;
    render();
    main.querySelector("[data-period]")?.focus();
  } else if (target.matches("[data-filter-type]")) {
    filterState.type = target.value;
    refreshStatement();
  } else if (target.matches("[data-filter-bank]")) {
    filterState.bank = target.value;
    updateCardFilter();
    refreshStatement();
  } else if (target.matches("[data-filter-card]")) {
    filterState.card = target.value;
    refreshStatement();
  }
});
main.addEventListener("input", event => {
  if (event.target.matches("[data-filter-search]")) {
    filterState.search = event.target.value;
    refreshStatement();
  }
});
main.addEventListener("click", event => {
  const receives = event.target.closest("[data-from-receivables]");
  if (receives) {
    event.preventDefault();
    history.pushState({ from: "a-receber" }, "", receives.hash);
    render(true);
    return;
  }
  if (event.target.closest("[data-connection-demo]")) {
    main.querySelector("[data-connection-status]").textContent = "Conexões bancárias estão disponíveis no Balsave com uma sessão ativa.";
  }
  const point = event.target.closest("[data-chart-point]");
  if (!point) return;
  const chart = point.closest(".chart");
  for (const button of chart.querySelectorAll("[data-chart-point]")) {
    button.setAttribute("aria-pressed", String(button === point));
  }
  const dot = chart.querySelector(".chart-dot");
  dot.style.left = `${point.dataset.x}%`;
  dot.style.top = `${point.dataset.y}%`;
  chart.querySelector(".chart-guide").style.left = `${point.dataset.x}%`;
  chart.querySelector(".chart-readout").textContent = point.getAttribute("aria-label");
});

render();
