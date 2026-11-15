"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import {
  daysInMonth, expensesWithRefunds, previousMonths, spendingByMonth, spendingPace, summarizeBalances,
  type Transaction, transactionCategory,
} from "../lib/finance";
import { formatDate, formatMonth, formatMonthName, formatShortMonth } from "../lib/format";
import { cardLabel, type FinancialData } from "./financial-data";

function buildReports(data: FinancialData, live: boolean) {
  const { accounts, asOf, balanceSnapshots, cards } = data;
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
    return balanceSnapshots.map(({ month, accounts }) => ({
      month,
      cents: summarizeBalances(accounts.filter(account => !bank || account.bank === bank)).totalCents,
    }));
  }

  function balanceChartPoint({ month, cents }: ReturnType<typeof balanceHistory>[number]) {
    return {
      axisLabel: formatShortMonth(month),
      label: month === currentMonth ? `Saldo em ${formatDate(asOf)}` : formatMonth(month),
      values: [cents],
    };
  }

  function transactionSource({ accountId, cardId }: Transaction) {
    return sources.get(accountId ?? cardId ?? "");
  }

  return {
    ...data, live, currentMonth, months, monthOptions, reportedTransactions, spending, expenses, trackedRefunds,
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
