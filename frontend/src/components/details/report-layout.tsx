import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import type { ReactNode } from "react";
import { useFinancialReports } from "../../data/financial-reports";
import { optionValue, reportHref } from "../../lib/report-links";

export function ReportLayout({ title, dashboardMonth, children, back }: {
  title: string;
  dashboardMonth: string | null;
  children: ReactNode;
  back?: { href: string; label: string };
}) {
  const { live, months, failedConnections, failedInvestments } = useFinancialReports();
  const month = optionValue(dashboardMonth, months);
  const backLink = back ?? { href: reportHref("/", { mes: month }), label: "Voltar ao painel" };

  return (
    <Container component="main" maxWidth="lg" className="report-layout">
      <header className="report-header">
        <Link href={backLink.href} className="report-link report-back">← {backLink.label}</Link>
        <div className="report-title">
          <Typography variant="h1" color="primary.main">{title}</Typography>
          <Chip label={live ? "Dados do Meu Pluggy" : "Dados fictícios"} size="small" sx={{ bgcolor: "var(--surface-muted)", color: "var(--text-secondary)" }} />
        </div>
      </header>
      {failedConnections > 0 && <p className="report-muted" role="status">Algumas conexões estão indisponíveis. Os totais podem estar incompletos.</p>}
      {!!failedInvestments && <p className="report-muted" role="status">Alguns investimentos estão indisponíveis. O saldo consolidado pode estar incompleto.</p>}
      {children}
    </Container>
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
