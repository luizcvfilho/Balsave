import { expect, test } from "@playwright/test";
import {
  bankBalanceImpact,
  bankTransfersAfterMonth,
  categoryBreakdown,
  expensesWithRefunds,
  ledgerBalanceImpact,
  spendingByMonth,
  spendingPace,
  summarizeBalances,
  summarizeCards,
  transactionCategoryKey,
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

test("keeps individual bank movements and removes paired transfers from consolidated month-end changes", () => {
  const sent = {
    id: "sent", name: "Pix sent", kind: "transfer", direction: "out", internalTransfer: "account", reconciliation: "automatic",
    accountId: "bank-a", transferAccountId: "bank-b", date: "2026-10-31", amountCents: 50000, balanceImpactCents: -50000,
  } as const;
  const received = {
    id: "received", name: "Pix received", kind: "transfer", direction: "in", internalTransfer: "account", reconciliation: "automatic",
    accountId: "bank-b", transferAccountId: "bank-a", date: "2026-11-01", amountCents: 50000, balanceImpactCents: 50000,
  } as const;
  const other = { ...received, id: "other", internalTransfer: "investment", transferAccountId: undefined } as const;
  const movements = [sent, received, other];
  const bothBanks = new Set(["bank-a", "bank-b"]);
  expect(bankBalanceImpact(sent)).toBe(-50000);
  expect(ledgerBalanceImpact(sent)).toBe(0);
  expect(ledgerBalanceImpact(other)).toBe(0);
  expect(bankBalanceImpact(other)).toBe(50000);
  expect(bankTransfersAfterMonth(movements, bothBanks, "2026-09")).toBe(0);
  expect(bankTransfersAfterMonth(movements, bothBanks, "2026-10")).toBe(50000);
  expect(bankTransfersAfterMonth(movements, bothBanks, "2026-11")).toBe(0);
  expect(bankTransfersAfterMonth(movements, new Set(["bank-b"]), "2026-10")).toBe(0);
});

test("reconciles an investment redemption across month-end while preserving its tax difference", () => {
  const redemption = {
    id: "redemption", name: "Redemption", kind: "transfer", direction: "out", investmentId: "fund",
    transferAccountId: "bank", date: "2026-10-31", amountCents: 10200, balanceImpactCents: -10200,
    transferCashCents: -10000, reconciliation: "automatic",
  } as const;
  const bankCredit = {
    id: "credit", name: "Credit", kind: "transfer", direction: "in", accountId: "bank",
    transferAccountId: "fund", date: "2026-11-01", amountCents: 10000, balanceImpactCents: 10000,
    transferCashCents: 10000, reconciliation: "automatic",
  } as const;
  const movements = [redemption, bankCredit];
  expect(movements.reduce((sum, movement) => sum + bankBalanceImpact(movement), 0)).toBe(-200);
  expect(bankTransfersAfterMonth(movements, new Set(["bank", "fund"]), "2026-10")).toBe(10000);
  expect(bankTransfersAfterMonth(movements, new Set(["bank", "fund"]), "2026-09")).toBe(0);
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
    installmentCents: 0,
    categories: [
      { key: "food", name: "Alimentação", cents: 43001 },
      { key: "travel", name: "Viagem", cents: 25000 },
      { key: "uncategorized", name: "Sem categoria", cents: 1000 },
    ],
  });
  expect(categoryBreakdown(spending, "2026-11")).toEqual({
    month: "2026-11", totalCents: 0, installmentCents: 0, categories: [],
  });
});

test("counts only installments dated in the selected month in its net installment subtotal", () => {
  const spending = spendingByMonth([
    { id: "purchase-1", name: "Purchase", kind: "expense", category: "Compras", date: "2026-10-10", amountCents: 2001, installment: { number: 1, count: 3 } },
    { id: "final", name: "Completed purchase", kind: "expense", category: "Compras", date: "2026-10-27", amountCents: 1700, installment: { number: 6, count: 6 } },
    { id: "purchase-2", name: "Purchase", kind: "expense", category: "Compras", date: "2026-11-10", amountCents: 2000, installment: { number: 2, count: 3 } },
    { id: "purchase-3", name: "Purchase", kind: "expense", category: "Compras", date: "2026-12-13", amountCents: 2000, installment: { number: 3, count: 3 } },
    { id: "refund", name: "Refund", kind: "refund", expenseId: "purchase-2", date: "2026-11-12", amountCents: 300 },
    { id: "other", name: "Other", kind: "expense", category: "Compras", date: "2026-11-11", amountCents: 5000 },
    { id: "bill", name: "Bill payment", kind: "transfer", date: "2026-11-13", amountCents: 7000 },
  ], "2026-11-14");

  expect(categoryBreakdown(spending, "2026-10").installmentCents).toBe(3701);
  expect(categoryBreakdown(spending, "2026-11")).toEqual({
    month: "2026-11", totalCents: 6700, installmentCents: 1700,
    categories: [{ key: "shopping", name: "Compras", cents: 6700 }],
  });
  expect(categoryBreakdown(spending, "2026-12").installmentCents).toBe(0);
  expect(spendingPace(spending, "2026-10-31")[26].currentCents).toBe(3701);
});

test("keeps category identity on rename and preserves net spend and balances when reclassified", () => {
  const original = {
    id: "purchase", name: "Equipment", kind: "expense", category: "Compras", categoryKey: "shopping",
    accountId: "account", date: "2026-11-10", amountCents: 10001,
  } as const;
  const renamed = { ...original, category: "Aquisições" };
  expect(transactionCategoryKey(renamed)).toBe(transactionCategoryKey(original));
  const refund = { id: "refund", name: "Refund", kind: "refund", expenseId: "purchase", date: "2026-11-12", amountCents: 3000 } as const;
  const changed = { ...original, category: "Escritório", categoryKey: "custom:office" };
  const before = categoryBreakdown(spendingByMonth([original, refund], "2026-11-20"), "2026-11");
  const after = categoryBreakdown(spendingByMonth([changed, refund], "2026-11-20"), "2026-11");
  expect(before.totalCents).toBe(7001);
  expect(after.totalCents).toBe(before.totalCents);
  expect(after.categories).toEqual([{ key: "custom:office", name: "Escritório", cents: 7001 }]);
  expect(bankBalanceImpact(changed)).toBe(bankBalanceImpact(original));
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
