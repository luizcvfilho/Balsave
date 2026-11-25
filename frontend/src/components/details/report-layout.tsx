import Link from "next/link";
import type { ReactNode } from "react";
import { useFinancialReports } from "../../data/financial-reports";
import { optionValue, reportHref } from "../../lib/report-links";

export function PageHeading({ title, description, controls }: { title: string; description?: string; controls?: ReactNode }) {
  return (
    <header className="balsave-page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {controls}
    </header>
  );
}

export function FinancialFooter({ live, children }: { live: boolean; children?: ReactNode }) {
  return <footer className="balsave-financial-footer">
    <span>{live ? "Dados do Meu Pluggy" : "Dados fictícios"}</span>
    {children}
  </footer>;
}

export function ReportLayout({ title, description, controls, dashboardMonth, dashboardTags, children, back }: {
  title: string;
  description?: string;
  controls?: ReactNode;
  dashboardMonth: string | null;
  dashboardTags?: string;
  children: ReactNode;
  back?: { href: string; label: string };
}) {
  const { live, planningMonths, failedConnections, failedInvestments, categoryCatalogStale } = useFinancialReports();
  const month = optionValue(dashboardMonth, planningMonths);
  return (
    <main className="balsave-shell report-layout">
      {back && <Link href={back.href} className="report-link report-back">← {back.label}</Link>}
      <PageHeading title={title} description={description} controls={controls} />
      {failedConnections > 0 && <p className="report-muted" role="status">Algumas conexões estão indisponíveis. Os totais podem estar incompletos.</p>}
      {!!failedInvestments && <p className="report-muted" role="status">Alguns investimentos estão indisponíveis. O saldo consolidado pode estar incompleto.</p>}
      {categoryCatalogStale && <p className="report-muted" role="status">Não foi possível atualizar o catálogo de categorias. Suas escolhas foram preservadas e as categorias disponíveis continuam em uso.</p>}
      {children}
      <FinancialFooter live={live}>
        {!back && <Link href={reportHref("/", { mes: month, etiquetas: dashboardTags })} className="report-link report-back">← Voltar ao painel</Link>}
      </FinancialFooter>
    </main>
  );
}

export function ReportNavigation({ label, options }: {
  label: string;
  options: { label: string; href: string; active: boolean }[];
}) {
  return (
    <nav className="report-navigation" aria-label={label}>
      {options.map(option => (
        <Link key={option.label} href={option.href} aria-current={option.active ? "page" : undefined}>
          {option.label}
        </Link>
      ))}
    </nav>
  );
}
