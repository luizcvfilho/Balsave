"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import {
  bankTransfersAfterMonth, categoryKeyForLabel, daysInMonth, expensesWithRefunds, previousMonths, spendingByMonth, spendingPace, summarizeBalances,
  type Transaction, transactionCategory, transactionCategoryKey,
} from "../lib/finance";
import { deriveReceivables } from "../lib/receivables";
import { formatDate, formatMoney, formatMonth, formatMonthName, formatShortMonth } from "../lib/format";
import { cardLabel, type FinancialData } from "./financial-data";

function buildReports(data: FinancialData, live: boolean) {
  const { accounts, asOf, balanceSnapshots, cards } = data;
  const tags = data.tags ?? [];
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
  const receivableGroups = data.receivableGroups ?? [];
  const receivables = deriveReceivables(receivableGroups, data.transactions, asOf, live);
  const receivableCredits = new Map<string, { appliedCents: number; surplusCents: number }>();
  for (const group of receivables) for (const receipt of group.receipts) {
    const previous = receivableCredits.get(receipt.creditId) ?? { appliedCents: 0, surplusCents: 0 };
    receivableCredits.set(receipt.creditId, { appliedCents: previous.appliedCents + receipt.appliedCents, surplusCents: previous.surplusCents + receipt.surplusCents });
  }
  const spending = spendingByMonth(data.transactions, asOf, undefined, receivableGroups, live);
  const expenses = expensesWithRefunds(data.transactions, asOf, receivableGroups, live);
  const trackedRefunds = expenses.filter(({ expense, refunds }) => expense.expectsRefund || refunds.length > 0);
  const expenseCategories = [...new Map([
    ...expenses.map(({ expense }) => [transactionCategoryKey(expense), transactionCategory(expense)] as const),
    ...plannedInstallments.map(plan => [plan.categoryKey ?? categoryKeyForLabel(plan.category), plan.category] as const),
  ]).entries()].map(([value, label]) => ({ value, label }))
    .sort((first, second) => first.label.localeCompare(second.label, "pt-BR"));
  const sources = new Map<string, { bank: string; detail: string; label: string; cardEnding?: string }>([...accounts, ...investments].map(({ id, bank, name }) => [id, {
    bank, detail: name, label: `${bank} · ${name}`,
  }]));
  for (const card of cards) {
    const detail = card.lastFour ? `Cartão •••• ${card.lastFour}` : card.name || "Cartão";
    sources.set(card.id, { bank: card.bank, detail, label: cardLabel(card), cardEnding: card.lastFour });
  }

  function paceChartPoints(month: string, monthlySpending = spending) {
    const end = month === currentMonth ? asOf : `${month}-${daysInMonth(month)}`;
    return spendingPace(monthlySpending, end).map(({ day, currentCents, averageCents }) => ({
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
    return sources.get(accountId ?? cardId ?? investmentId ?? "")?.label;
  }

  function transactionInstitution({ accountId, cardId, investmentId }: Transaction) {
    return (cardId && sources.get(cardId)) || sources.get(accountId ?? investmentId ?? "");
  }

  return {
    ...data, tags, investments, positions, receivableGroups, receivables, receivableCredits, live, currentMonth, months, monthOptions, reportedTransactions, spending, expenses, trackedRefunds,
    plannedInstallments, planningMonths, planningMonthOptions, planningMaxDate,
    expenseCategories, paceChartPoints, canCompare, balanceHistory, balanceChartPoint, transactionSource, transactionInstitution,
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
