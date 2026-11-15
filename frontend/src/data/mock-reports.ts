import { daysInMonth, expensesWithRefunds, spendingByMonth, spendingPace, summarizeBalances } from "../lib/finance";
import { formatDate, formatMonth, formatMonthName, formatShortMonth } from "../lib/format";
import { mockAccounts, mockAsOf, mockBalanceSnapshots, mockCards, mockTransactions } from "./mock-data";

export const currentMonth = mockAsOf.slice(0, 7);
export const reportedTransactions = mockTransactions.filter(transaction => transaction.date <= mockAsOf);
export const spending = spendingByMonth(reportedTransactions, mockAsOf);
export const expenses = expensesWithRefunds(reportedTransactions, mockAsOf);
export const trackedRefunds = expenses.filter(({ expense, refunds }) => expense.expectsRefund || refunds.length > 0);

export function paceChartPoints(month: string) {
  const end = month === currentMonth ? mockAsOf : `${month}-${daysInMonth(month)}`;
  return spendingPace(spending, end).map(({ day, currentCents, averageCents }) => ({
    axisLabel: String(day).padStart(2, "0"),
    label: `Dia ${day} de ${formatMonthName(month)}`,
    values: [currentCents, averageCents],
  }));
}

export function balanceHistory(bank?: string) {
  return mockBalanceSnapshots.map(({ month, accounts }) => ({
    month,
    cents: summarizeBalances(accounts.filter(account => !bank || account.bank === bank)).totalCents,
  }));
}

export function balanceChartPoint({ month, cents }: ReturnType<typeof balanceHistory>[number]) {
  return {
    axisLabel: formatShortMonth(month),
    label: month === currentMonth ? `Saldo em ${formatDate(mockAsOf)}` : formatMonth(month),
    values: [cents],
  };
}

export function transactionSource({ accountId, cardId }: (typeof mockTransactions)[number]) {
  const account = mockAccounts.find(account => account.id === accountId);
  if (account) return `${account.bank} · ${account.name}`;
  const card = mockCards.find(card => card.id === cardId);
  if (card) return `${card.bank} · Cartão final ${card.lastFour}`;
}
