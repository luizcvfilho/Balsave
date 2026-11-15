"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
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
import { useReportQuery } from "../../components/details/report-query";
import { accountBalances, cardLabel } from "../../data/financial-data";
import { useFinancialReports } from "../../data/financial-reports";
import { categoryBreakdown, summarizeBalances, summarizeCards } from "../../lib/finance";
import { formatAvailableMoney, formatDate, formatMoney, formatMonthName, formatPercent } from "../../lib/format";
import { optionValue, reportHref } from "../../lib/report-links";

const twoColumns = "repeat(2, minmax(0, 1fr))";

export function DashboardPage() {
  const { params, update } = useReportQuery();
  const {
    accounts, asOf, cards: cardList, planningMonths, plannedInstallments, currentMonth, reportedTransactions, spending, paceChartPoints, canCompare,
    balanceHistory, balanceChartPoint, failedConnections, live,
  } = useFinancialReports();
  const currentDay = Number(asOf.slice(8));
  const balances = summarizeBalances(accountBalances(accounts));
  const cards = summarizeCards(cardList);
  const categoryPeriods = planningMonths.map(month => categoryBreakdown(spending, month));
  const pacePoints = paceChartPoints(currentMonth);
  const comparison = canCompare(currentMonth);
  const history = balanceHistory().slice(1);
  const balancePoints = history.map(balanceChartPoint);
  const latest = reportedTransactions.filter(transaction => transaction.date.startsWith(currentMonth)).reverse();
  const recentTransactions = live ? latest.slice(0, 10) : latest;
  const month = optionValue(params.get("mes"), planningMonths, currentMonth);
  const plannedCents = plannedInstallments.reduce((sum, plan) => sum + (plan.date.startsWith(month) ? plan.amountCents : 0), 0);
  const [paceIndex, setPaceIndex] = useState(currentDay - 1);
  const [balanceIndex, setBalanceIndex] = useState(history.length - 1);

  function details(path: string, values: Record<string, string | undefined> = {}) {
    return reportHref(path, { painelMes: month === currentMonth ? undefined : month, ...values });
  }

  const cardUsage = cards.usedCents !== null && cards.limitCents !== null && cards.limitCents > 0
    ? cards.usedCents / cards.limitCents : null;

  return (
    <Container
      component="main"
      maxWidth="lg"
      sx={{ display: "grid", gap: 2.5, py: { xs: 3, md: 6 } }}
    >
      <Stack direction="row" useFlexGap spacing={1} sx={{ justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <Typography variant="h1" color="primary.main">Painel financeiro</Typography>
          <Typography variant="body2" color="var(--text-secondary)" sx={{ mt: 1 }}>
            <time dateTime={asOf}>{formatDate(asOf)}</time>
          </Typography>
        </div>
        <Chip
          label={live ? "Dados do Meu Pluggy" : "Dados fictícios"}
          size="small"
          sx={{ bgcolor: "var(--surface-muted)", color: "var(--text-secondary)", fontWeight: 600 }}
        />
      </Stack>

      {failedConnections > 0 && (
        <p className="report-muted" role="status">Algumas conexões estão indisponíveis. Os totais podem estar incompletos.</p>
      )}

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

      <Box sx={{ display: "grid", gap: "inherit", gridTemplateColumns: { md: "minmax(0, 1.45fr) minmax(0, 1fr)" } }}>
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
        <SpendingCategories
          periods={categoryPeriods}
          asOf={asOf}
          month={month}
          onMonthChange={value => update({ mes: value === currentMonth ? undefined : value })}
          getHref={category => details("/gastos", { mes: month, categoria: category })}
          installmentsHref={details("/gastos", { mes: month, compra: "parcelada" })}
          plannedCents={plannedCents}
          plannedHref={`${details("/gastos", { mes: month, compra: "parcelada" })}#parcelas-previstas`}
        />
      </Box>

      <SectionCard
        id="evolucao"
        title="Evolução do saldo em contas"
        href={details("/contas", { aba: "evolucao", ponto: history[balanceIndex]?.month })}
        description={history.length ? "Saldo no fechamento de cada mês e saldo atual do mês em andamento" : undefined}
      >
        {balancePoints.length > 1 ? <LineChart
          points={balancePoints}
          series={[{ label: "Saldo consolidado", style: "actual" }]}
          axisIndices={balancePoints.map((_, index) => index)}
          initialIndex={balancePoints.length - 1}
          onSelect={setBalanceIndex}
          axisLabel="Mês no gráfico de evolução do saldo"
          partialLastPoint
        /> : <p className="report-muted">Histórico de saldos mensais indisponível para estas conexões.</p>}
      </SectionCard>

      <RecentTransactions
        transactions={recentTransactions}
        getHref={id => details("/lancamentos", { lancamento: id })}
      />
    </Container>
  );
}
