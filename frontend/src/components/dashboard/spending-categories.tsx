import LinearProgress from "@mui/material/LinearProgress";
import Link from "next/link";
import type { categoryBreakdown } from "../../lib/finance";
import { formatMoney, formatPercent } from "../../lib/format";
import { SectionCard } from "../cards/section-card";
import { CategoryIcon } from "../details/transaction-classification";

type Category = ReturnType<typeof categoryBreakdown>["categories"][number];

export function SpendingCategoryList({ categories, totalCents, getHref, active }: {
  categories: Category[];
  totalCents: number;
  getHref: (key: string) => string;
  active?: string;
}) {
  return (
    // biome-ignore lint/a11y/noRedundantRoles: Safari can omit the list role when markers are hidden.
    <ul role="list" className="spending-category-list">
      {categories.map(({ key, name, cents }) => {
        const share = totalCents > 0 ? cents / totalCents : 0;
        return (
          <li key={key}>
            <Link href={getHref(key)} className="spending-category-link" aria-current={active === key ? "true" : undefined}>
              <span className="spending-category-tile"><CategoryIcon categoryKey={key} /></span>
              <span className="spending-category-breakdown">
                <span>{name}</span>
                <LinearProgress value={share * 100} aria-hidden="true" sx={{
                  height: 3, bgcolor: "var(--line)", "& .MuiLinearProgress-bar": { bgcolor: "var(--green-border)" },
                }} />
              </span>
              <span>{formatMoney(cents)}<span className="sr-only"> · {formatPercent(share)}</span></span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function SpendingCategories({ period, getHref, installmentsHref, plannedCents, plannedHref }: {
  period: ReturnType<typeof categoryBreakdown>;
  getHref: (category?: string) => string;
  installmentsHref: string;
  plannedCents: number;
  plannedHref: string;
}) {
  const { categories, totalCents } = period;
  return (
    <SectionCard id="categorias" title="Gastos por categoria" description="Maiores despesas do período" href={getHref()} linkLabel="Ver gastos">
      <div aria-live="polite">
        {categories.length ? <>
          <SpendingCategoryList categories={categories.slice(0, 4)} totalCents={totalCents} getHref={getHref} />
          {categories.length > 4 && <details className="dashboard-category-more">
            <summary>Todas as categorias</summary>
            <SpendingCategoryList categories={categories.slice(4)} totalCents={totalCents} getHref={getHref} />
          </details>}
        </> : <p className="report-muted">Nenhum gasto registrado neste mês.</p>}
        <div className="dashboard-category-totals">
          <span className="dashboard-category-total">Gasto líquido <strong>{formatMoney(totalCents)}</strong></span>
          {period.installmentCents > 0 && <Link href={installmentsHref} className="report-link report-action">
            Parcelas incluídas · {formatMoney(period.installmentCents)}
          </Link>}
          {plannedCents > 0 && <Link href={plannedHref} className="report-link report-action">
            Parcelas previstas · {formatMoney(plannedCents)}
          </Link>}
        </div>
      </div>
    </SectionCard>
  );
}
