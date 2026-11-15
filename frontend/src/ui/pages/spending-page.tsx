"use client";

import Link from "next/link";
import { useState } from "react";
import { BreakdownList } from "../../components/cards/breakdown-list";
import { SectionCard } from "../../components/cards/section-card";
import { LineChart } from "../../components/charts/line-chart";
import { matchesSearch, PeriodFields, usePeriod, ReportSelect, SearchField } from "../../components/details/report-filters";
import { ReportLayout, ReportNavigation } from "../../components/details/report-layout";
import { ReportMetrics } from "../../components/details/report-metrics";
import { useReportQuery } from "../../components/details/report-query";
import { orderOptions, useCategoryOptions } from "../../components/details/transaction-filters";
import { orderedTransactions, TransactionTable } from "../../components/details/transaction-table";
import { useFinancialReports } from "../../data/financial-reports";
import { transactionCategory } from "../../lib/finance";
import { formatDate, formatMoney, formatMonthName } from "../../lib/format";
import { optionValue, reportHref } from "../../lib/report-links";

export function SpendingPage() {
  const { params, href } = useReportQuery();
  const rhythm = params.get("aba") === "ritmo";
  const dashboardMonth = params.get("painelMes");

  return (
    <ReportLayout title={rhythm ? "Ritmo de gastos" : "Gastos por categoria"} dashboardMonth={dashboardMonth}>
      <ReportNavigation label="Detalhes de gastos" options={[
        { label: "Por categoria", href: href({ aba: undefined }), active: !rhythm },
        { label: "Ritmo de gastos", href: href({ aba: "ritmo" }), active: rhythm },
      ]} />
      {rhythm ? <SpendingRhythm /> : <CategoryExpenses />}
    </ReportLayout>
  );
}

function CategoryExpenses() {
  const { params, update } = useReportQuery();
  const period = usePeriod(params);
  const { expenses, live } = useFinancialReports();
  const expenseCategoryOptions = useCategoryOptions();
  const category = optionValue(params.get("categoria"), expenseCategoryOptions.map(option => option.value));
  const order = optionValue(params.get("ordem"), orderOptions.map(option => option.value), "recent");
  const [search, setSearch] = useState("");
  const results = expenses.filter(({ expense }) => period.includes(expense.date)
    && (!category || transactionCategory(expense) === category)
    && matchesSearch(search, expense.name));
  const rows = orderedTransactions(results.map(({ expense, receivedCents, netCents }) => ({
    transaction: expense, receivedCents, netCents,
  })), order);
  const total = results.reduce((sum, row) => sum + row.netCents, 0);
  const dashboardMonth = params.get("painelMes") ?? undefined;

  return (
    <SectionCard id="gastos-filtrados" title="Compras no período">
      <div className="report-filters">
        <PeriodFields period={period} update={update} />
        <ReportSelect label="Categoria" value={category} options={expenseCategoryOptions} onChange={value => update({ categoria: value })} />
        <SearchField value={search} onChange={setSearch} />
        <ReportSelect label="Ordenar por" value={order} options={orderOptions} onChange={value => update({ ordem: value })} />
      </div>
      {live && <p className="report-muted">Os gastos consideram lançamentos efetivados. Créditos sem vínculo com a compra aparecem em “Lançamentos”.</p>}
      <ReportMetrics items={[
        { label: "Gasto líquido", value: formatMoney(total) },
        { label: "Compras", value: String(rows.length) },
      ]} />
      <TransactionTable
        label="Compras por categoria"
        rows={rows}
        getHref={id => reportHref("/lancamentos", { painelMes: dashboardMonth, lancamento: id })}
      />
    </SectionCard>
  );
}

function SpendingRhythm() {
  const { params, update } = useReportQuery();
  const { monthOptions, months, currentMonth, asOf, expenses, paceChartPoints, canCompare } = useFinancialReports();
  const month = optionValue(params.get("ritmoMes"), months,
    optionValue(params.get("mes"), months, currentMonth));
  const points = paceChartPoints(month);
  const lastReported = month === currentMonth ? Number(asOf.slice(8)) : points.length;
  const requestedDay = Number(params.get("dia"));
  const day = Number.isInteger(requestedDay) && requestedDay >= 1 && requestedDay <= points.length ? requestedDay : lastReported;
  const available = day <= lastReported;
  const date = `${month}-${String(day).padStart(2, "0")}`;
  const comparison = canCompare(month);
  const categories = new Map<string, number>();
  const dailyRows = [];
  for (const { expense, netCents, receivedCents } of expenses) {
    if (!expense.date.startsWith(month) || expense.date > date) continue;
    if (expense.date === date) dailyRows.push({ transaction: expense, netCents, receivedCents });
    if (netCents === 0) continue;
    const category = transactionCategory(expense);
    categories.set(category, (categories.get(category) ?? 0) + netCents);
  }

  const dashboardMonth = params.get("painelMes") ?? undefined;
  return (
    <>
      <SectionCard id="ritmo-detalhe" title="Gasto líquido acumulado">
        <div className="report-filters">
          <ReportSelect label="Mês" value={month} options={monthOptions} onChange={value => update({ ritmoMes: value, dia: undefined })} />
        </div>
        {!comparison && <p className="report-muted">A comparação fica disponível quando há dados dos três meses anteriores.</p>}
        <LineChart
          points={points}
          series={[
            { label: formatMonthName(month), style: "actual" },
            ...(comparison ? [{ label: "Média dos 3 meses anteriores", style: "reference" } as const] : []),
          ]}
          axisIndices={[0, 6, 13, 20, points.length - 1]}
          initialIndex={day - 1}
          selectedIndex={day - 1}
          onSelect={index => update({ dia: String(index + 1) })}
          axisLabel="Dia do mês no gráfico de ritmo de gastos"
          compareToReference={comparison}
          zeroBased
        />
      </SectionCard>
      <SectionCard id="gastos-do-dia" title="Gastos do dia" description={formatDate(date)}>
        {available ? (
          <TransactionTable
            label="Lançamentos do dia"
            rows={orderedTransactions(dailyRows)}
            getHref={id => reportHref("/lancamentos", { painelMes: dashboardMonth, lancamento: id })}
            empty="Nenhum gasto neste dia."
          />
        ) : <p className="report-muted">Dados disponíveis até {formatDate(asOf)}.</p>}
      </SectionCard>
      {available && (
        <SectionCard id="acumulado-categoria" title="Categorias no acumulado">
          {categories.size > 0 ? (
            <BreakdownList rows={Array.from(categories.entries()).sort((first, second) => second[1] - first[1])
              .map(([name, cents]) => ({
                key: name,
                label: (
                  <Link className="report-link report-action" href={reportHref("/gastos", {
                    mes: "personalizado", de: `${month}-01`, ate: date, categoria: name, painelMes: dashboardMonth,
                  })}>{name}</Link>
                ),
                value: formatMoney(cents),
              }))} />
          ) : <p className="report-muted">Nenhum gasto líquido acumulado até este dia.</p>}
        </SectionCard>
      )}
    </>
  );
}
