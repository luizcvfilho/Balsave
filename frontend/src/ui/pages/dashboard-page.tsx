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
import { mockAccounts, mockAsOf, mockCards, mockSpendingMonths } from "../../data/mock-data";
import {
  balanceChartPoint, balanceHistory, currentMonth, paceChartPoints, reportedTransactions, spending,
} from "../../data/mock-reports";
import { categoryBreakdown, summarizeBalances, summarizeCards } from "../../lib/finance";
import { formatDate, formatMoney, formatMonthName, formatPercent } from "../../lib/format";
import { optionValue, reportHref } from "../../lib/report-links";

const currentDay = Number(mockAsOf.slice(8));
const balances = summarizeBalances(mockAccounts);
const cards = summarizeCards(mockCards);
const categoryPeriods = mockSpendingMonths.map(month => categoryBreakdown(spending, month));
const pacePoints = paceChartPoints(currentMonth);
const history = balanceHistory().slice(1);
const balancePoints = history.map(balanceChartPoint);
const recentTransactions = reportedTransactions.filter(transaction => transaction.date.startsWith(currentMonth)).reverse();

const twoColumns = "repeat(2, minmax(0, 1fr))";

export function DashboardPage() {
  const { params, update } = useReportQuery();
  const month = optionValue(params.get("mes"), mockSpendingMonths, currentMonth);
  const [paceIndex, setPaceIndex] = useState(currentDay - 1);
  const [balanceIndex, setBalanceIndex] = useState(history.length - 1);

  function details(path: string, values: Record<string, string | undefined> = {}) {
    return reportHref(path, { painelMes: month === currentMonth ? undefined : month, ...values });
  }

  const cardUsage = cards.limitCents > 0 ? cards.usedCents / cards.limitCents : 0;

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
            <time dateTime={mockAsOf}>{formatDate(mockAsOf)}</time>
          </Typography>
        </div>
        <Chip
          label="Dados fictícios"
          size="small"
          sx={{ bgcolor: "var(--surface-muted)", color: "var(--text-secondary)", fontWeight: 600 }}
        />
      </Stack>

      <Box sx={{ display: "grid", gap: "inherit", gridTemplateColumns: { sm: twoColumns } }}>
        <MetricCard
          id="contas"
          title="Saldo em contas"
          href={details("/contas")}
          value={formatMoney(balances.totalCents)}
          highlighted
          rows={balances.banks.map(({ bank, balanceCents }) => ({
            key: bank,
            label: <Link className="report-link report-action" href={details("/contas", { banco: bank })}>{bank}</Link>,
            value: formatMoney(balanceCents),
          }))}
        />
        <MetricCard
          id="cartoes"
          title="Limite usado nos cartões"
          href={details("/cartoes")}
          value={formatMoney(cards.usedCents)}
          detail={`de ${formatMoney(cards.limitCents)}`}
          indicator={
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
          }
          rows={mockCards.map(({ id, bank, lastFour, usedCents, limitCents }) => ({
            key: `${bank}-${lastFour}`,
            label: (
              <Link className="report-link report-action" href={details("/cartoes", { cartao: id })}>
                <span>{bank} <span aria-hidden="true">·</span> <span className="sr-only">final </span>{lastFour}</span>
              </Link>
            ),
            value: (
              <>
                {formatMoney(usedCents)}{" "}
                <Typography component="span" variant="inherit" color="var(--text-secondary)" sx={{ fontWeight: 400 }}>
                  / {formatMoney(limitCents)}
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
              { label: "Média dos 3 meses anteriores", style: "reference" },
            ]}
            axisIndices={[0, 6, 13, 20, pacePoints.length - 1]}
            initialIndex={currentDay - 1}
            onSelect={setPaceIndex}
            axisLabel="Dia do mês no gráfico de ritmo de gastos"
            zeroBased
            compareToReference
          />
        </SectionCard>
        <SpendingCategories
          periods={categoryPeriods}
          asOf={mockAsOf}
          month={month}
          onMonthChange={value => update({ mes: value === currentMonth ? undefined : value })}
          getHref={category => details("/gastos", { mes: month, categoria: category })}
        />
      </Box>

      <SectionCard
        id="evolucao"
        title="Evolução do saldo em contas"
        href={details("/contas", { aba: "evolucao", ponto: history[balanceIndex].month })}
        description="Saldo no fechamento de cada mês e saldo atual do mês em andamento"
      >
        <LineChart
          points={balancePoints}
          series={[{ label: "Saldo consolidado", style: "actual" }]}
          axisIndices={balancePoints.map((_, index) => index)}
          initialIndex={balancePoints.length - 1}
          onSelect={setBalanceIndex}
          axisLabel="Mês no gráfico de evolução do saldo"
          partialLastPoint
        />
      </SectionCard>

      <RecentTransactions
        transactions={recentTransactions}
        getHref={id => details("/lancamentos", { lancamento: id })}
      />
    </Container>
  );
}
