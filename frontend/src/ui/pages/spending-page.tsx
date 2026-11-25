"use client";

import Link from "next/link";
import { useState } from "react";
import { BreakdownList } from "../../components/cards/breakdown-list";
import { SectionCard } from "../../components/cards/section-card";
import { LineChart } from "../../components/charts/line-chart";
import { SpendingCategoryList } from "../../components/dashboard/spending-categories";
import { matchesSearch, PeriodFields, ReportMultiSelect, ReportSelect, SearchField, usePeriod } from "../../components/details/report-filters";
import { ReportLayout, ReportNavigation } from "../../components/details/report-layout";
import { ReportMetrics } from "../../components/details/report-metrics";
import { useReportQuery } from "../../components/details/report-query";
import { TagFilter, useTagFilter } from "../../components/details/tag-filter";
import { orderOptions, useCategoryOptions } from "../../components/details/transaction-filters";
import { orderedTransactions, TransactionTable } from "../../components/details/transaction-table";
import { useFinancialReports } from "../../data/financial-reports";
import { categoryKeyForLabel, matchesTransactionTags, spendingByMonth, transactionCategory, transactionCategoryKey } from "../../lib/finance";
import { formatDate, formatMoney, formatMonthName, formatNumericDate } from "../../lib/format";
import { optionValue, optionValues, reportHref } from "../../lib/report-links";

const purchaseTypeOptions = [
  { value: "parcelada", label: "Parceladas" },
  { value: "sem-parcelas", label: "Sem parcelas identificadas" },
];

export function SpendingPage() {
  const { params, href, update } = useReportQuery();
  const tagFilter = useTagFilter(params);
  const rhythm = params.get("aba") === "ritmo";
  const dashboardMonth = params.get("painelMes");
  const period = usePeriod(params, undefined, true);

  return (
    <ReportLayout title={rhythm ? "Ritmo de gastos" : "Gastos por categoria"}
      description="Entenda como as despesas se distribuem ao longo do mês."
      dashboardMonth={dashboardMonth} dashboardTags={tagFilter.query}
      controls={(!rhythm || tagFilter.tags.length > 0) && (
        <div className="report-filters report-heading-filters">
          {!rhythm && <PeriodFields period={period} update={update} compact />}
          <TagFilter tags={tagFilter.tags} selected={tagFilter.selected} update={update} />
        </div>
      )}>
      <ReportNavigation label="Detalhes de gastos" options={[
        { label: "Por categoria", href: href({ aba: undefined }), active: !rhythm },
        { label: "Ritmo de gastos", href: href({ aba: "ritmo" }), active: rhythm },
      ]} />
      {rhythm ? <SpendingRhythm tagFilter={tagFilter} /> : <CategoryExpenses period={period} tagFilter={tagFilter} />}
    </ReportLayout>
  );
}

function CategoryExpenses({ period, tagFilter }: { period: ReturnType<typeof usePeriod>; tagFilter: ReturnType<typeof useTagFilter> }) {
  const { params, href, update } = useReportQuery();
  const { asOf, expenses, live, plannedInstallments, receivableGroups } = useFinancialReports();
  const gross = params.get("valor") === "bruto";
  const hideTracked = params.get("acompanhamento") === "ocultar";
  const tracked = new Set(receivableGroups.map(group => group.expenseId));
  const expenseCategoryOptions = useCategoryOptions();
  const selectedCategories = optionValues(params, "categoria", expenseCategoryOptions);
  const purchaseTypes = optionValues(params, "compra", purchaseTypeOptions);
  const installmentsOnly = purchaseTypes.size === 1 && purchaseTypes.has("parcelada");
  const order = optionValue(params.get("ordem"), orderOptions.map(option => option.value), "recent");
  const [search, setSearch] = useState("");
  const matching = expenses.filter(({ expense, refunds, netCents }) => (gross || netCents > 0)
    && (!hideTracked || (!tracked.has(expense.id) && !expense.expectsRefund && refunds.length === 0))
    && period.includes(expense.date)
    && matchesTransactionTags(expense, tagFilter.selected)
    && (!purchaseTypes.size || purchaseTypes.has(expense.installment ? "parcelada" : "sem-parcelas"))
    && matchesSearch(search, expense.name));
  const results = matching.filter(({ expense }) => !selectedCategories.size || selectedCategories.has(transactionCategoryKey(expense)));
  const distribution = new Map<string, { key: string; name: string; cents: number }>();
  let distributionCents = 0;
  for (const { expense, netCents } of matching) {
    const key = transactionCategoryKey(expense);
    const cents = gross ? expense.amountCents : netCents;
    distribution.set(key, { key, name: transactionCategory(expense), cents: (distribution.get(key)?.cents ?? 0) + cents });
    distributionCents += cents;
  }
  const categories = [...distribution.values()].sort((first, second) => second.cents - first.cents);
  const activeCategory = selectedCategories.size === 1
    ? expenseCategoryOptions.find(option => selectedCategories.has(option.value))?.label : undefined;
  const rows = orderedTransactions(results.map(({ expense, receivedCents, netCents }) => ({
    transaction: expense, receivedCents: gross ? 0 : receivedCents, netCents: gross ? expense.amountCents : netCents,
  })), order);
  const total = results.reduce((sum, row) => sum + (gross ? row.expense.amountCents : row.netCents), 0);
  const dashboardMonth = params.get("painelMes") ?? undefined;
  const plansInPeriod = tagFilter.selected.size || (purchaseTypes.size && !purchaseTypes.has("parcelada"))
    ? [] : plannedInstallments.filter(plan => period.includes(plan.date));
  const plans = plansInPeriod.filter(plan =>
    (!selectedCategories.size || selectedCategories.has(plan.categoryKey ?? categoryKeyForLabel(plan.category)))
    && matchesSearch(search, plan.name),
  );
  const plannedCents = plans.reduce((sum, plan) => sum + plan.amountCents, 0);
  const transactionHref = (id: string) => reportHref("/lancamentos", {
    painelMes: dashboardMonth, etiquetas: tagFilter.query, lancamento: id,
  });

  return (
    <>
      <section className="report-panel-stack" aria-label="Compras no período">
        <div className="report-columns">
          <SectionCard id="distribuicao-gastos" title="Distribuição dos gastos" description="Selecione uma categoria para filtrar as compras.">
            {categories.length > 0 ? <SpendingCategoryList categories={categories} totalCents={distributionCents} active={selectedCategories}
              getHref={key => href({ categoria: key })} /> : <p className="report-muted">Nenhum gasto registrado neste período.</p>}
          </SectionCard>
          <SectionCard id="resumo-gastos" title={activeCategory ?? "Gastos no período"} highlighted>
            <div className="spending-report-metrics">
              <ReportMetrics items={[
                { label: gross ? "Gasto bruto" : "Gasto líquido", value: formatMoney(total) },
                { label: "Compras", value: String(rows.length) },
              ]} />
            </div>
            {selectedCategories.size > 0 && <Link className="report-link report-action" href={href({ categoria: undefined })}>
              Limpar categorias →
            </Link>}
          </SectionCard>
        </div>
        <SectionCard id="gastos-filtrados" title={activeCategory ? `Compras em ${activeCategory}` : "Compras registradas"}>
          <div className="report-filters">
            <ReportMultiSelect label="Categoria" placeholder="Todas as categorias" selectionLabel="Categorias"
              selected={selectedCategories} options={expenseCategoryOptions} onChange={values => update({ categoria: values })} labeled />
            <ReportMultiSelect label="Tipo de compra" placeholder="Todas as compras" selectionLabel="Tipos de compra"
              options={purchaseTypeOptions} selected={purchaseTypes} onChange={values => update({ compra: values })} labeled />
            <ReportSelect label="Valor" value={gross ? "bruto" : "liquido"} options={[
              { value: "liquido", label: "Líquido" }, { value: "bruto", label: "Bruto" },
            ]} onChange={value => update({ valor: value === "bruto" ? value : undefined })} />
            <ReportSelect label="Despesas acompanhadas" value={hideTracked ? "ocultar" : "mostrar"} options={[
              { value: "mostrar", label: "Mostrar todas" }, { value: "ocultar", label: "Ocultar acompanhadas" },
            ]} onChange={value => update({ acompanhamento: value === "ocultar" ? value : undefined })} />
            <SearchField value={search} onChange={setSearch} />
            <ReportSelect label="Ordenar por" value={order} options={orderOptions} onChange={value => update({ ordem: value })} />
          </div>
          {live && <p className="report-muted">Os gastos incluem compras da fatura aberta até a data da consulta. Créditos sem vínculo com a compra aparecem em “Lançamentos”.</p>}
          <TransactionTable
            label="Compras por categoria"
            rows={rows}
            getHref={transactionHref}
            amountHeading={gross ? "Gasto bruto" : "Gasto líquido"}
            showPaymentMethod
            empty={installmentsOnly ? "Nenhuma parcela para os filtros selecionados." : undefined}
          />
        </SectionCard>
      </section>
      {plansInPeriod.length > 0 && (
        <SectionCard id="parcelas-previstas" title="Parcelas previstas" description="Datas e valores estimados a partir da última parcela registrada de cada compra.">
          {plans.length > 0 ? (
            <>
              <ReportMetrics items={[{ label: "Total previsto", value: formatMoney(plannedCents) }]} />
              <BreakdownList rows={plans.map(plan => ({
                key: plan.id,
                label: (
                  <>
                    {plan.transactionId ? <Link className="report-link report-action" href={transactionHref(plan.transactionId)}>{plan.name}</Link> : plan.name}
                    <span className="report-cell-detail">
                      {plan.number}/{plan.count} · {formatNumericDate(plan.date)} · {plan.category}
                    </span>
                    <span className="report-cell-detail">
                      {plan.date <= asOf ? "Aguardando lançamento" : "Parcela prevista"} · {plan.card}
                    </span>
                  </>
                ),
                value: formatMoney(plan.amountCents),
              }))} />
            </>
          ) : <p className="report-muted">Nenhuma parcela prevista para os filtros selecionados.</p>}
        </SectionCard>
      )}
    </>
  );
}

function SpendingRhythm({ tagFilter }: { tagFilter: ReturnType<typeof useTagFilter> }) {
  const { params, update } = useReportQuery();
  const { monthOptions, months, currentMonth, asOf, expenses, spending, reportedTransactions, receivableGroups, live, paceChartPoints, canCompare } = useFinancialReports();
  const month = optionValue(params.get("ritmoMes"), months,
    optionValue(params.get("mes"), months, currentMonth));
  const gross = params.get("valor") === "bruto";
  const hideTracked = params.get("acompanhamento") === "ocultar";
  const tracked = new Set(receivableGroups.map(group => group.expenseId));
  const monthlySpending = tagFilter.selected.size || gross || hideTracked
    ? spendingByMonth(reportedTransactions, asOf, tagFilter.selected, receivableGroups, live, gross ? "gross" : "net", hideTracked) : spending;
  const points = paceChartPoints(month, monthlySpending);
  const lastReported = month === currentMonth ? Number(asOf.slice(8)) : points.length;
  const requestedDay = Number(params.get("dia"));
  const day = Number.isInteger(requestedDay) && requestedDay >= 1 && requestedDay <= points.length ? requestedDay : lastReported;
  const available = day <= lastReported;
  const date = `${month}-${String(day).padStart(2, "0")}`;
  const comparison = canCompare(month);
  const categories = new Map<string, { name: string; cents: number }>();
  const dailyRows = [];
  for (const row of expenses) {
    const { expense, refunds } = row;
    const netCents = gross ? expense.amountCents : row.netCents;
    const receivedCents = gross ? 0 : row.receivedCents;
    if ((hideTracked && (tracked.has(expense.id) || expense.expectsRefund || refunds.length > 0)) || !expense.date.startsWith(month) || expense.date > date || !matchesTransactionTags(expense, tagFilter.selected)) continue;
    if (expense.date === date && netCents > 0) dailyRows.push({ transaction: expense, netCents, receivedCents });
    if (netCents === 0) continue;
    const category = transactionCategoryKey(expense);
    categories.set(category, { name: transactionCategory(expense), cents: (categories.get(category)?.cents ?? 0) + netCents });
  }

  const dashboardMonth = params.get("painelMes") ?? undefined;
  return (
    <>
      <SectionCard id="ritmo-detalhe" title={gross ? "Gasto bruto acumulado" : "Gasto líquido acumulado"}>
        <div className="report-filters">
          <ReportSelect label="Mês" value={month} options={monthOptions} onChange={value => update({ ritmoMes: value, dia: undefined })} />
          <ReportSelect label="Valor" value={gross ? "bruto" : "liquido"} options={[
            { value: "liquido", label: "Líquido" }, { value: "bruto", label: "Bruto" },
          ]} onChange={value => update({ valor: value === "bruto" ? value : undefined })} />
          <ReportSelect label="Despesas acompanhadas" value={hideTracked ? "ocultar" : "mostrar"} options={[
            { value: "mostrar", label: "Mostrar todas" }, { value: "ocultar", label: "Ocultar acompanhadas" },
          ]} onChange={value => update({ acompanhamento: value === "ocultar" ? value : undefined })} />
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
            amountHeading={gross ? "Gasto bruto" : "Gasto líquido"}
            getHref={id => reportHref("/lancamentos", { painelMes: dashboardMonth, etiquetas: tagFilter.query, lancamento: id })}
            empty="Nenhum gasto neste dia."
          />
        ) : <p className="report-muted">Dados disponíveis até {formatDate(asOf)}.</p>}
      </SectionCard>
      {available && (
        <SectionCard id="acumulado-categoria" title="Categorias no acumulado">
          {categories.size > 0 ? (
            <BreakdownList rows={Array.from(categories.entries()).sort((first, second) => second[1].cents - first[1].cents)
              .map(([key, { name, cents }]) => ({
                key,
                label: (
                  <Link className="report-link report-action" href={reportHref("/gastos", {
                    mes: "personalizado", de: `${month}-01`, ate: date, categoria: key, painelMes: dashboardMonth, etiquetas: tagFilter.query, valor: gross ? "bruto" : undefined, acompanhamento: hideTracked ? "ocultar" : undefined,
                  })}>{name}</Link>
                ),
                value: formatMoney(cents),
              }))} />
          ) : <p className="report-muted">Nenhum gasto acumulado até este dia.</p>}
        </SectionCard>
      )}
    </>
  );
}
