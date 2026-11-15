import { expect, test } from "@playwright/test";
import {
  categoryBreakdown,
  expensesWithRefunds,
  spendingByMonth,
  spendingPace,
  summarizeBalances,
  summarizeCards,
} from "../src/lib/finance";

test("consolidates accounts by bank and totals card usage and limits separately", () => {
  expect(summarizeBalances([
    { bank: "A", balanceCents: 100001 },
    { bank: "B", balanceCents: 30000 },
    { bank: "A", balanceCents: -1599 },
  ])).toEqual({
    totalCents: 128402,
    banks: [{ bank: "A", balanceCents: 98402 }, { bank: "B", balanceCents: 30000 }],
  });
  expect(summarizeCards([
    { bank: "A", lastFour: "1234", usedCents: 250001, limitCents: 300000 },
    { bank: "A", lastFour: "5678", usedCents: 230002, limitCents: 900000 },
  ])).toEqual({ usedCents: 480003, limitCents: 1200000 });
});

test("shares the net spend with refund tracking and counts only credits received as of the report date", () => {
  const transactions = [
    { id: "stay", name: "Stay", kind: "expense", expectsRefund: true, date: "2026-10-10", amountCents: 10001 },
    { id: "first", name: "Refund", kind: "refund", date: "2026-10-14", expenseId: "stay", amountCents: 3000 },
    { id: "second", name: "Refund", kind: "refund", date: "2026-11-08", expenseId: "stay", amountCents: 4501 },
    { id: "last", name: "Refund", kind: "refund", date: "2026-11-20", expenseId: "stay", amountCents: 2600 },
  ] as const;
  expect(expensesWithRefunds(transactions, "2026-10-13")[0]).toMatchObject({ status: "pending", receivedCents: 0, netCents: 10001 });
  expect(expensesWithRefunds(transactions, "2026-11-14")[0]).toMatchObject({ status: "partial", receivedCents: 7501, netCents: 2500 });
  expect(expensesWithRefunds(transactions, "2026-11-20")[0]).toMatchObject({ status: "completed", receivedCents: 10101, netCents: 0 });
  expect(categoryBreakdown(spendingByMonth(transactions, "2026-11-14"), "2026-10").totalCents).toBe(2500);
});

test("combines bank and card expenses by category and excludes transfers and future entries", () => {
  const spending = spendingByMonth([
    { id: "hotel", name: "Hotel", kind: "expense", merchantType: "hotel", date: "2026-10-05", amountCents: 85000 },
    { id: "refund", name: "Refund", kind: "refund", expenseId: "hotel", date: "2026-11-02", amountCents: 60000 },
    { id: "late-refund", name: "Refund", kind: "refund", expenseId: "hotel", date: "2026-11-20", amountCents: 25000 },
    { id: "market", name: "Market", kind: "expense", merchantType: "groceries", accountId: "checking", date: "2026-10-10", amountCents: 28500 },
    { id: "restaurant", name: "Restaurant", kind: "expense", category: "Alimentação", cardId: "card", date: "2026-10-12", amountCents: 14501 },
    { id: "other", name: "Other", kind: "expense", merchantType: "unknown", date: "2026-10-12", amountCents: 1000 },
    { id: "payment", name: "Card payment", kind: "transfer", date: "2026-10-13", amountCents: 150000 },
    { id: "self-transfer", name: "Pix between own accounts", kind: "transfer", direction: "out", date: "2026-10-13", amountCents: 30000 },
    { id: "investment", name: "BB Rende Fácil", kind: "transfer", direction: "out", date: "2026-10-13", amountCents: 50000 },
    { id: "salary", name: "Salary", kind: "income", date: "2026-10-14", amountCents: 700000 },
    { id: "future", name: "Market", kind: "expense", merchantType: "groceries", date: "2026-11-20", amountCents: 5000 },
  ], "2026-11-14");

  expect(categoryBreakdown(spending, "2026-10")).toEqual({
    month: "2026-10",
    totalCents: 69001,
    categories: [
      { name: "Alimentação", cents: 43001 },
      { name: "Viagem", cents: 25000 },
      { name: "Sem categoria", cents: 1000 },
    ],
  });
  expect(categoryBreakdown(spending, "2026-11")).toEqual({
    month: "2026-11", totalCents: 0, categories: [],
  });
});

test("compares the same calendar day across a year boundary and stops actuals at the reporting date", () => {
  const spending = spendingByMonth([
    { id: "oct", name: "Rent", kind: "expense", date: "2025-10-10", amountCents: 30000 },
    { id: "nov", name: "Rent", kind: "expense", date: "2025-11-10", amountCents: 60001 },
    { id: "dec", name: "Rent", kind: "expense", date: "2025-12-10", amountCents: 90000 },
    { id: "dec-end", name: "Market", kind: "expense", date: "2025-12-31", amountCents: 30002 },
    { id: "jan", name: "Rent", kind: "expense", date: "2026-01-11", amountCents: 20000 },
  ], "2026-01-14");

  const points = spendingPace(spending, "2026-01-14");
  expect(points).toHaveLength(31);
  expect(points[8]).toEqual({ day: 9, currentCents: 0, averageCents: 0 });
  expect(points[9]).toEqual({ day: 10, currentCents: 0, averageCents: 60000 });
  expect(points[13]).toEqual({ day: 14, currentCents: 20000, averageCents: 60000 });
  expect(points[14]).toEqual({ day: 15, currentCents: null, averageCents: 60000 });
  expect(points[30]).toEqual({ day: 31, currentCents: null, averageCents: 70001 });
});
