"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import {
  bankTransfersAfterMonth, daysInMonth, expensesWithRefunds, previousMonths, spendingByMonth, spendingPace, summarizeBalances,
  type Transaction, transactionCategory,
} from "../lib/finance";
import { formatDate, formatMoney, formatMonth, formatMonthName, formatShortMonth } from "../lib/format";
import { cardLabel, type FinancialData } from "./financial-data";

function buildReports(data: FinancialData, live: boolean) {
  const { accounts, asOf, balanceSnapshots, cards } = data;
  const investments = data.investments ?? [];
  const positions = [...accounts, ...investments.filter(position => !position.includedInAccountId)];
  const currentMonth = asOf.slice(0, 7);
  const reportedTransactions = data.transactions.filter(transaction => transaction.date <= asOf);
  const months = data.spendingMonths ?? [...new Set([
    currentMonth, ...reportedTransactions.map(transaction => transaction.date.slice(0, 7)),
  ])].sort().reverse();
  const monthOptions = months.map(month => ({ value: month, label: formatMonth(month) }));
  const plannedInstallments = cards.flatMap(card => card.installments.map(installment => ({
    ...installment, card: cardLabel(card),
  }))).sort((first, second) => first.date.localeCompare(second.date));
  const lastPlannedDate = plannedInstallments.at(-1)?.date;
  let planningMaxDate = asOf;
  if (lastPlannedDate && lastPlannedDate > asOf) planningMaxDate = lastPlannedDate;
  const planningMonths = [...new Set([...months, ...plannedInstallments.map(plan => plan.date.slice(0, 7))])].sort().reverse();
  const planningMonthOptions = planningMonths.map(month => ({ value: month, label: formatMonth(month) }));
  const spending = spendingByMonth(reportedTransactions, asOf);
  const expenses = expensesWithRefunds(reportedTransactions, asOf);
  const trackedRefunds = expenses.filter(({ expense, refunds }) => expense.expectsRefund || refunds.length > 0);
  const expenseCategories = [...new Set(expenses.map(({ expense }) => transactionCategory(expense)))]
    .sort((first, second) => first.localeCompare(second, "pt-BR"));
  const sources = new Map(accounts.map(account => [account.id, `${account.bank} · ${account.name}`]));
  for (const card of cards) {
    sources.set(card.id, cardLabel(card));
  }
  for (const investment of investments) sources.set(investment.id, `${investment.bank} · ${investment.name}`);

  function paceChartPoints(month: string) {
    const end = month === currentMonth ? asOf : `${month}-${daysInMonth(month)}`;
    return spendingPace(spending, end).map(({ day, currentCents, averageCents }) => ({
      axisLabel: String(day).padStart(2, "0"),
      label: `Dia ${day} de ${formatMonthName(month)}`,
      values: [currentCents, averageCents],
    }));
  }

  function canCompare(month: string) {
    const covered = live ? months.slice(0, -1) : months;
    return previousMonths(month, 3).every(previous => covered.includes(previous));
  }

  function balanceHistory(bank?: string) {
    const snapshots = balanceSnapshots.filter(({ month }) => month < currentMonth).map(({ month, accounts }) => ({
      month,
      accounts: accounts.filter(account => !bank || account.bank === bank),
    })).filter(snapshot => snapshot.accounts.length > 0);
    const latestClosed = snapshots.at(-1);
    // Use the same accounts for the entire series so changes reflect movements within a fixed set.
    const comparable = new Set(latestClosed?.accounts.map(account => account.id));
    const points = snapshots.flatMap(({ month, accounts }) => {
      const included = accounts.filter(account => comparable.has(account.id));
      return included.length === comparable.size
        ? [{ month, cents: summarizeBalances(included).totalCents + bankTransfersAfterMonth(reportedTransactions, comparable, month) }]
        : [];
    });
    const available = positions.filter(account => !bank || account.bank === bank).length;
    const partial = comparable.size < available;
    const coverage = partial ? ` O gráfico cobre ${comparable.size} de ${available} contas disponíveis.` : "";
    const investmentCoverage = investments.length ? " Investimentos estimados por fluxo de caixa, com a valorização histórica pendente." : "";
    const description = live && latestClosed
      ? `Saldo no último dia de cada mês, estimado a partir dos lançamentos efetivados.${coverage}${investmentCoverage}`
      : undefined;
    const onlyPoint = points.length === 1 ? points[0] : undefined;
    const emptyMessage = onlyPoint
      ? `${balanceChartPoint(onlyPoint).label}. Saldo de ${formatMoney(onlyPoint.cents)}.`
      : "Ainda não há dados para estimar o fechamento de um mês.";
    return { points, partial, description, emptyMessage };
  }

  function balanceChartPoint({ month, cents }: { month: string; cents: number }) {
    const closingDate = formatDate(`${month}-${daysInMonth(month)}`);
    return {
      axisLabel: formatShortMonth(month),
      label: `${live ? "Fechamento estimado" : "Fechamento"} em ${closingDate}`,
      values: [cents],
    };
  }

  function transactionSource({ accountId, cardId, investmentId }: Transaction) {
    return sources.get(accountId ?? cardId ?? investmentId ?? "");
  }

  return {
    ...data, investments, positions, live, currentMonth, months, monthOptions, reportedTransactions, spending, expenses, trackedRefunds,
    plannedInstallments, planningMonths, planningMonthOptions, planningMaxDate,
    expenseCategories, paceChartPoints, canCompare, balanceHistory, balanceChartPoint, transactionSource,
  };
}

const FinancialReportsContext = createContext<ReturnType<typeof buildReports> | null>(null);

export function FinancialReportsProvider({ data, live, children }: {
  data: FinancialData;
  live: boolean;
  children: ReactNode;
}) {
  const reports = useMemo(() => buildReports(data, live), [data, live]);
  return <FinancialReportsContext.Provider value={reports}>{children}</FinancialReportsContext.Provider>;
}

export function useFinancialReports() {
  const reports = useContext(FinancialReportsContext);
  if (!reports) throw new Error("Financial reports require a data source.");
  return reports;
}
