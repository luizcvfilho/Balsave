import Image from "next/image";
import logoDark from "../../../assets/balsave-logo-dark.svg";
import logoLight from "../../../assets/balsave-logo-light.svg";

const transactions = [
  { name: "Salário", category: "Receitas", date: "05 nov", amount: 685000 },
  { name: "Aluguel", category: "Moradia", date: "06 nov", amount: -185000 },
  { name: "Mercado", category: "Alimentação", date: "07 nov", amount: -24580 },
  { name: "Cinema", category: "Lazer", date: "08 nov", amount: -7200 },
  { name: "Hotel", category: "Viagem", date: "09 nov", amount: -80000 },
  { name: "Reembolso do hotel", category: "Reembolso", date: "11 nov", amount: 50000 },
];

const expenses = transactions.filter(({ amount }) => amount < 0);
const totalExpenses = expenses.reduce((total, { amount }) => total - amount, 0);
const totalIncome = transactions
  .filter(({ category }) => category === "Receitas")
  .reduce((total, { amount }) => total + amount, 0);
const expenseByCategory = Map.groupBy(expenses, ({ category }) => category);
const categories = Array.from(expenseByCategory, ([category, entries]) => ({
  category,
  total: entries.reduce((total, { amount }) => total - amount, 0),
})).sort((first, second) => second.total - first.total);

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatMoney = (cents: number) => currency.format(cents / 100);

export default function Dashboard() {
  return (
    <>
      <header className="site-header">
        <div className="page-width header-content">
          <a className="brand" href="#painel">
            <picture>
              <source media="(prefers-color-scheme: dark)" srcSet={logoDark.src} />
              <Image src={logoLight} alt="Balsave" width={150} height={50} />
            </picture>
          </a>
          <nav aria-label="Navegação principal">
            <a href="#painel">Painel</a>
            <a href="#lancamentos">Lançamentos</a>
            <a href="#reembolsos">Reembolsos</a>
          </nav>
        </div>
      </header>

      <main className="page-width py-8 sm:py-12" id="painel">
        <div className="dashboard-heading">
          <h1>Painel financeiro</h1>
          <p>Novembro de 2026 · Dados fictícios</p>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="financial-card net-worth">
            <dt>Patrimônio líquido</dt>
            <dd>{formatMoney(4285000)}</dd>
          </div>
          <div className="financial-card metric">
            <dt>Receitas</dt>
            <dd>{formatMoney(totalIncome)}</dd>
          </div>
          <div className="financial-card metric">
            <dt>Despesas brutas</dt>
            <dd>{formatMoney(totalExpenses)}</dd>
          </div>
        </dl>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section className="financial-card" id="lancamentos" aria-labelledby="transactions-title">
            <h2 id="transactions-title">Lançamentos recentes</h2>
            {/* biome-ignore lint/a11y/noRedundantRoles: Preserve list semantics in Safari when list markers are hidden. */}
            <ul className="transaction-list" role="list">
              {[...transactions].reverse().map(({ name, category, date, amount }) => (
                <li key={name}>
                  <div>
                    <p className="font-medium">{name}</p>
                    <p className="muted text-sm">{category} · {date}</p>
                  </div>
                  <span className={amount > 0 ? "money positive" : "money"}>{formatMoney(amount)}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="grid gap-5">
            <section className="financial-card" aria-labelledby="categories-title">
              <h2 id="categories-title">Despesas por categoria</h2>
              {/* biome-ignore lint/a11y/noRedundantRoles: Preserve list semantics in Safari when list markers are hidden. */}
              <ul className="category-list" role="list">
                {categories.map(({ category, total }) => (
                  <li key={category}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span>{category}</span>
                      <span className="money">{formatMoney(total)}</span>
                    </div>
                    <div className="category-track" aria-hidden="true">
                      <div style={{ width: `${(total / totalExpenses) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="financial-card" id="reembolsos" aria-labelledby="refunds-title">
              <h2 id="refunds-title">Reembolsos</h2>
              <p className="mt-3 font-medium">Hotel</p>
              <dl className="refund-list">
                <div>
                  <dt>Valor original</dt>
                  <dd>{formatMoney(80000)}</dd>
                </div>
                <div>
                  <dt>Recebido em 11 nov</dt>
                  <dd>{formatMoney(50000)}</dd>
                </div>
                <div>
                  <dt>Saldo pendente</dt>
                  <dd>{formatMoney(30000)}</dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
