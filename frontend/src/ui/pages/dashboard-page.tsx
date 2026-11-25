"use client";

import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useState } from "react";
import { MetricCard } from "../../components/cards/metric-card";
import { SectionCard } from "../../components/cards/section-card";
import { LineChart } from "../../components/charts/line-chart";
import { RecentTransactions } from "../../components/dashboard/recent-transactions";
import { SpendingCategories } from "../../components/dashboard/spending-categories";
import { ReportSelect } from "../../components/details/report-filters";
import { FinancialFooter, PageHeading } from "../../components/details/report-layout";
import { useReportQuery } from "../../components/details/report-query";
import { TagFilter, useTagFilter } from "../../components/details/tag-filter";
import { accountBalances, cardLabel } from "../../data/financial-data";
import { useFinancialReports } from "../../data/financial-reports";
import { categoryBreakdown, daysInMonth, matchesTransactionTags, previousMonths, spendingByMonth, summarizeBalances, summarizeCards, transactionTotals } from "../../lib/finance";
import { formatAvailableMoney, formatDate, formatMoney, formatMonthName, formatPercent, formatShortMonth, formatSignedMoney } from "../../lib/format";
import { optionValue, reportHref } from "../../lib/report-links";
import "./dashboard-page.css";

const twoColumns = "repeat(2, minmax(0, 1fr))";

export function DashboardPage() {
  const { params, update } = useReportQuery();
  const tagFilter = useTagFilter(params);
  const {
    accounts, asOf, cards: cardList, positions, planningMonths, planningMonthOptions, plannedInstallments, currentMonth, reportedTransactions, receivableGroups, spending, paceChartPoints, canCompare,
    balanceHistory, balanceChartPoint, failedConnections, failedInvestments, live,
  } = useFinancialReports();
  const currentDay = Number(asOf.slice(8));
  const balances = summarizeBalances(accountBalances(accounts));
  const cards = summarizeCards(cardList);
  const monthlySpending = tagFilter.selected.size ? spendingByMonth(reportedTransactions, asOf, tagFilter.selected, receivableGroups, live) : spending;
  const pacePoints = paceChartPoints(currentMonth, monthlySpending);
  const comparison = canCompare(currentMonth);
  const evolution = balanceHistory();
  const month = optionValue(params.get("mes"), planningMonths, currentMonth);
  const categoryPeriod = categoryBreakdown(monthlySpending, month);
  const monthTransactions = reportedTransactions.filter(transaction => transaction.date.startsWith(month)
    && matchesTransactionTags(transaction, tagFilter.selected));
  const consolidatedBalance = positions.length && positions.every(position => position.balanceCents !== null)
    ? summarizeBalances(accountBalances(positions)).totalCents : null;
  const currentPoint = consolidatedBalance !== null && !evolution.partial && month >= currentMonth
    ? { month: currentMonth, cents: consolidatedBalance } : undefined;
  const history = evolution.points.filter(point => point.month <= month);
  if (currentPoint) history.push(currentPoint);
  const balanceSeries = history.slice(-6);
  const balancePoints = balanceSeries.map(point => point === currentPoint ? {
    axisLabel: formatShortMonth(currentMonth),
    label: `Saldo em ${formatDate(asOf)}`,
    values: [point.cents],
  } : balanceChartPoint(point));
  const lastBalance = balanceSeries.at(-1);
  const previousBalance = balanceSeries.at(-2);
  const displayedBalance = month >= currentMonth ? consolidatedBalance : lastBalance?.month === month ? lastBalance.cents : null;
  const variation = displayedBalance !== null && lastBalance && previousBalance && previousBalance.cents > 0
    && previousMonths(lastBalance.month, 1)[0] === previousBalance.month
    && (month < currentMonth || currentPoint)
    ? (displayedBalance - previousBalance.cents) / previousBalance.cents : null;
  const plannedCents = tagFilter.selected.size ? 0
    : plannedInstallments.reduce((sum, plan) => sum + (plan.date.startsWith(month) ? plan.amountCents : 0), 0);
  const [paceIndex, setPaceIndex] = useState(currentDay - 1);
  const [selectedBalanceMonth, setSelectedBalanceMonth] = useState<string>();
  const selectedBalanceIndex = balanceSeries.findIndex(point => point.month === selectedBalanceMonth);
  const balanceIndex = selectedBalanceIndex >= 0 ? selectedBalanceIndex : balanceSeries.length - 1;
  const selectedChartMonth = balanceSeries[balanceIndex]?.month;

  function details(path: string, values: Record<string, string | undefined> = {}) {
    return reportHref(path, {
      painelMes: month === currentMonth ? undefined : month,
      etiquetas: path === "/gastos" || path === "/lancamentos" ? tagFilter.query : undefined,
      ...values,
    });
  }

  const monthlyTotals = transactionTotals(monthTransactions);
  const ledgerValues = { mes: month >= currentMonth ? undefined : month };
  const monthlyDescription = month <= currentMonth
    ? `1 a ${month === currentMonth ? currentDay : daysInMonth(month)} de ${formatMonthName(month)}`
    : formatMonthName(month);

  const cardUsage = cards.usedCents !== null && cards.limitCents !== null && cards.limitCents > 0
    ? cards.usedCents / cards.limitCents : null;

  return (
    <main className="balsave-shell dashboard-layout">
      <PageHeading title="Visão geral" description="Acompanhe suas contas, seus gastos e a evolução do saldo."
        controls={<ReportSelect label="Período" variant="period" value={month} options={planningMonthOptions}
          onChange={value => {
            setSelectedBalanceMonth(undefined);
            update({ mes: value === currentMonth ? undefined : value });
          }} />} />

      {failedConnections > 0 && (
        <p className="report-muted" role="status">Algumas conexões estão indisponíveis. Os totais podem estar incompletos.</p>
      )}
      {!!failedInvestments && <p className="report-muted" role="status">Alguns investimentos estão indisponíveis. O saldo consolidado pode estar incompleto.</p>}

      <TagFilter tags={tagFilter.tags} selected={tagFilter.selected} update={update} />
      <div className="dashboard-overview">
        <SectionCard
          id="evolucao"
          className="dashboard-balance"
          title={month < currentMonth && evolution.partial ? "Saldo das contas com histórico" : "Saldo consolidado"}
          href={details("/contas", { aba: "evolucao", ponto: selectedChartMonth === currentMonth ? undefined : selectedChartMonth })}
          linkLabel="Ver contas"
          description="Contas e investimentos acompanhados"
        >
          <p className="dashboard-balance-amount">{formatAvailableMoney(displayedBalance)}</p>
          {variation !== null && (
            <p className="dashboard-balance-change">
              <span data-loss={variation < 0 || undefined}><span aria-hidden="true">{variation < 0 ? "↘" : "↗"}</span> {variation > 0 ? "+" : ""}{formatPercent(variation)}</span>
              em relação ao mês anterior
            </p>
          )}
          {balancePoints.length > 1 ? <LineChart
            points={balancePoints}
            series={[{ label: evolution.partial ? "Saldo das contas com histórico" : "Saldo consolidado", style: "actual" }]}
            axisIndices={balancePoints.map((_, index) => index)}
            initialIndex={balancePoints.length - 1}
            selectedIndex={balanceIndex}
            onSelect={index => setSelectedBalanceMonth(balanceSeries[index].month)}
            axisLabel="Mês no gráfico de evolução do saldo"
            periodButtons
          /> : <p className="report-muted">{evolution.emptyMessage}</p>}
          {evolution.description && <p className="dashboard-balance-note">{evolution.description}</p>}
        </SectionCard>

        <SectionCard id="resumo-mes" className="dashboard-summary" title="Resumo do mês" description={monthlyDescription} highlighted>
          <dl className="dashboard-monthly">
            <div><dt><span aria-hidden="true">↙</span>Entradas</dt><dd>{formatSignedMoney(monthlyTotals.incomingCents)}</dd></div>
            <div><dt><span aria-hidden="true">↗</span>Saídas</dt><dd>{formatSignedMoney(-monthlyTotals.outgoingCents)}</dd></div>
            <div><dt><span aria-hidden="true"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2.5-6L14 18l2.5-6H21" /></svg></span>Saldo do mês</dt><dd>{formatMoney(monthlyTotals.netCents)}</dd></div>
          </dl>
          <Link className="report-link financial-panel-link dashboard-summary-link" href={details("/lancamentos", ledgerValues)}>
            Explorar extrato <span aria-hidden="true">→</span>
          </Link>
        </SectionCard>
        <RecentTransactions
          month={month}
          transactions={monthTransactions}
          getHref={id => details("/lancamentos", { ...ledgerValues, lancamento: id })}
        />
        <SpendingCategories
          period={categoryPeriod}
          getHref={category => details("/gastos", { mes: month, categoria: category })}
          installmentsHref={details("/gastos", { mes: month, compra: "parcelada" })}
          plannedCents={plannedCents}
          plannedHref={`${details("/gastos", { mes: month, compra: "parcelada" })}#parcelas-previstas`}
        />
      </div>

      <Box sx={{ display: "grid", gap: "inherit", gridTemplateColumns: { sm: twoColumns } }}>
        <MetricCard
          id="contas"
          title="Saldo em contas"
          href={details("/contas")}
          value={accounts.length && accounts.every(account => account.balanceCents !== null)
            ? formatMoney(balances.totalCents) : "Indisponível"}
          highlighted
          rows={balances.banks.map(({ bank, balanceCents }) => ({
            key: bank,
            label: <Link className="report-link report-action" href={details("/contas", { banco: bank })}>{bank}</Link>,
            value: formatAvailableMoney(accounts.some(account => account.bank === bank && account.balanceCents === null)
              ? null : balanceCents),
          }))}
        />
        <MetricCard
          id="cartoes"
          title="Limite usado nos cartões"
          href={details("/cartoes")}
          value={formatAvailableMoney(cardList.length ? cards.usedCents : null)}
          detail={cardList.length && cards.limitCents !== null ? `de ${formatMoney(cards.limitCents)}` : undefined}
          indicator={cardUsage !== null && (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <LinearProgress
                aria-label="Proporção do limite total dos cartões usada"
                aria-valuetext={formatPercent(cardUsage)}
                value={Math.max(0, Math.min(cardUsage, 1)) * 100}
                sx={{ flex: 1 }}
              />
              <Typography variant="body2" color="var(--text-secondary)" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {formatPercent(cardUsage)}
              </Typography>
            </Stack>
          )}
          rows={cardList.map(card => ({
            key: card.id,
            label: (
              <Link className="report-link report-action" href={details("/cartoes", { cartao: card.id })}>
                {cardLabel(card)}
              </Link>
            ),
            value: (
              <>
                {formatAvailableMoney(card.usedCents)}{" "}
                <Typography component="span" variant="inherit" color="var(--text-secondary)" sx={{ fontWeight: 400 }}>
                  / {formatAvailableMoney(card.limitCents)}
                </Typography>
              </>
            ),
          }))}
        />
      </Box>

      <SectionCard
        id="ritmo"
        title="Ritmo de gastos"
        href={details("/gastos", { aba: "ritmo", dia: String(paceIndex + 1) })}
        description="Gasto líquido acumulado por dia do mês"
      >
        <LineChart
          points={pacePoints}
          series={[
            { label: formatMonthName(currentMonth), style: "actual" },
            ...(comparison ? [{ label: "Média dos 3 meses anteriores", style: "reference" } as const] : []),
          ]}
          axisIndices={[0, 6, 13, 20, pacePoints.length - 1]}
          initialIndex={currentDay - 1}
          onSelect={setPaceIndex}
          axisLabel="Dia do mês no gráfico de ritmo de gastos"
          zeroBased
          compareToReference={comparison}
        />
      </SectionCard>
      <FinancialFooter live={live} />
    </main>
  );
}
