"use client";

import { DemoRefunds } from "../../components/details/demo-refunds";
import { ReceivablesList } from "../../components/details/receivable-view";
import { ReportLayout, ReportNavigation } from "../../components/details/report-layout";
import { useReportQuery } from "../../components/details/report-query";
import { useTagFilter } from "../../components/details/tag-filter";
import { useFinancialReports } from "../../data/financial-reports";
import { reportHref } from "../../lib/report-links";

export default function ReceivablesPage() {
  const { params } = useReportQuery();
  const { live } = useFinancialReports();
  const tagFilter = useTagFilter(params);
  const statementQuery = new URLSearchParams(params);
  statementQuery.delete("status");

  function transactionHref(id: string) {
    const query = new URLSearchParams(params);
    query.set("lancamento", id);
    query.set("origem", "a-receber");
    return reportHref("/lancamentos", query);
  }

  return <ReportLayout title="A receber" description="Acompanhe valores esperados e reembolsos."
    dashboardMonth={params.get("painelMes")} dashboardTags={tagFilter.query}>
    <ReportNavigation label="Detalhes do extrato" options={[
      { label: "Lançamentos", href: reportHref("/lancamentos", statementQuery), active: false },
      { label: "A receber", href: reportHref("/a-receber", new URLSearchParams(params)), active: true },
    ]} />
    {live ? <ReceivablesList transactionHref={transactionHref} /> : <DemoRefunds transactionHref={transactionHref} />}
  </ReportLayout>;
}
