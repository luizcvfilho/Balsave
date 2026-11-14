import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { BreakdownList } from "../../components/cards/breakdown-list";
import { MetricCard } from "../../components/cards/metric-card";
import { SectionCard } from "../../components/cards/section-card";
import { LineChart } from "../../components/charts/line-chart";
import { RecentTransactions } from "../../components/dashboard/recent-transactions";
import { SpendingCategories } from "../../components/dashboard/spending-categories";
import {
  categoryBreakdown,
  spendingByMonth,
  spendingPace,
  summarizeBalances,
  summarizeCards,
} from "../../lib/finance";
import {
  formatDate,
  formatMonth,
  formatMonthName,
  formatMoney,
  formatPercent,
  formatShortDate,
  formatShortMonth,
} from "../../lib/format";
import {
  mockAccounts,
  mockAsOf,
  mockBalanceHistory,
  mockCards,
  mockSpendingMonths,
  mockTransactions,
} from "../../data/mock-data";

const currentMonth = mockAsOf.slice(0, 7);
const currentDay = Number(mockAsOf.slice(8));
const balances = summarizeBalances(mockAccounts);
const cards = summarizeCards(mockCards);
const spending = spendingByMonth(mockTransactions, mockAsOf);
const categoryPeriods = mockSpendingMonths.map(month => categoryBreakdown(spending, month));
const pacePoints = spendingPace(spending, mockAsOf).map(({ day, currentCents, averageCents }) => ({
  axisLabel: String(day).padStart(2, "0"),
  label: `Dia ${day} de ${formatMonthName(currentMonth)}`,
  values: [currentCents, averageCents],
}));
const balancePoints = [
  ...mockBalanceHistory.map(({ month, cents }) => ({
    axisLabel: formatShortMonth(month),
    label: formatMonth(month),
    values: [cents],
  })),
  {
    axisLabel: formatShortMonth(currentMonth),
    label: `${formatMonth(currentMonth)} · até dia ${currentDay}`,
    values: [balances.totalCents],
  },
];
const recentTransactions = mockTransactions.filter(transaction => transaction.date.startsWith(currentMonth)).reverse();
const hotelExpense = mockTransactions.find(transaction => transaction.id === "hotel");
const hotelRefund = mockTransactions.find(transaction => transaction.id === "hotel-refund");

const twoColumns = "repeat(2, minmax(0, 1fr))";

export function DashboardPage() {
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
          value={formatMoney(balances.totalCents)}
          highlighted
          rows={balances.banks.map(({ bank, balanceCents }) => ({
            key: bank,
            label: bank,
            value: formatMoney(balanceCents),
          }))}
        />
        <MetricCard
          id="cartoes"
          title="Limite usado nos cartões"
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
          rows={mockCards.map(({ bank, lastFour, usedCents, limitCents }) => ({
            key: `${bank}-${lastFour}`,
            label: <>{bank} <span aria-hidden="true">·</span> <span className="sr-only">final </span>{lastFour}</>,
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
            axisLabel="Dia do mês no gráfico de ritmo de gastos"
            zeroBased
            compareToReference
          />
        </SectionCard>
        <SpendingCategories periods={categoryPeriods} asOf={mockAsOf} />
      </Box>

      <SectionCard
        id="evolucao"
        title="Evolução do saldo em contas"
        description="Saldo no fechamento de cada mês e saldo atual do mês em andamento"
      >
        <LineChart
          points={balancePoints}
          series={[{ label: "Saldo consolidado", style: "actual" }]}
          axisIndices={balancePoints.map((_, index) => index)}
          initialIndex={balancePoints.length - 1}
          axisLabel="Mês no gráfico de evolução do saldo"
          partialLastPoint
        />
      </SectionCard>

      <Box sx={{ display: "grid", gap: "inherit", alignItems: "start", gridTemplateColumns: { sm: twoColumns } }}>
        <RecentTransactions transactions={recentTransactions} />
        {hotelExpense && hotelRefund && (
          <SectionCard id="reembolsos" title="Reembolsos" description={hotelExpense.name}>
            <BreakdownList rows={[
              { key: "original", label: "Valor original", value: formatMoney(hotelExpense.amountCents) },
              { key: "received", label: `Recebido em ${formatShortDate(hotelRefund.date)}`, value: formatMoney(hotelRefund.amountCents) },
              { key: "pending", label: "Saldo pendente", value: formatMoney(hotelExpense.amountCents - hotelRefund.amountCents) },
            ]} />
          </SectionCard>
        )}
      </Box>
    </Container>
  );
}
