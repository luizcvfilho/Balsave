export type AccountBalance = {
  bank: string;
  balanceCents: number;
};

export type CreditCard = {
  bank: string;
  lastFour: string;
  usedCents: number;
  limitCents: number;
};

export type Transaction = {
  id: string;
  date: string;
  name: string;
  amountCents: number;
  accountId?: string;
  cardId?: string;
} & (
  | { kind: "expense"; merchantType?: string; expectsRefund?: boolean }
  | { kind: "refund"; expenseId: string }
  | { kind: "income" }
  | { kind: "transfer"; direction?: "in" | "out" }
);

export type Expense = Extract<Transaction, { kind: "expense" }>;
type Refund = Extract<Transaction, { kind: "refund" }>;

export const transactionKindLabels = {
  expense: "Despesa",
  income: "Receita",
  refund: "Reembolso",
  transfer: "Transferência",
} satisfies Record<Transaction["kind"], string>;

export function isIncoming(transaction: Transaction) {
  return transaction.kind === "income" || transaction.kind === "refund"
    || (transaction.kind === "transfer" && transaction.direction === "in");
}

const categoriesByMerchantType: ReadonlyMap<string, string> = new Map([
  ["rent", "Moradia"],
  ["groceries", "Alimentação"],
  ["restaurant", "Alimentação"],
  ["ride", "Transporte"],
  ["fuel", "Transporte"],
  ["cinema", "Lazer"],
  ["pharmacy", "Saúde"],
  ["medical", "Saúde"],
  ["hotel", "Viagem"],
]);

export function transactionCategory(transaction: Transaction) {
  switch (transaction.kind) {
    case "expense":
      return categoriesByMerchantType.get(transaction.merchantType ?? "") ?? "Sem categoria";
    case "income":
      return "Receitas";
    case "refund":
      return "Reembolso";
    case "transfer":
      return "Transferência";
  }
}

export function summarizeBalances(accounts: readonly AccountBalance[]) {
  const banks = new Map<string, number>();
  let totalCents = 0;
  for (const { bank, balanceCents } of accounts) {
    banks.set(bank, (banks.get(bank) ?? 0) + balanceCents);
    totalCents += balanceCents;
  }
  return {
    totalCents,
    banks: Array.from(banks, ([bank, balanceCents]) => ({ bank, balanceCents }))
      .sort((first, second) => second.balanceCents - first.balanceCents),
  };
}

export function summarizeCards(cards: readonly CreditCard[]) {
  return cards.reduce(
    (totals, card) => ({
      usedCents: totals.usedCents + card.usedCents,
      limitCents: totals.limitCents + card.limitCents,
    }),
    { usedCents: 0, limitCents: 0 },
  );
}

export function daysInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

export function previousMonths(month: string, count: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return Array.from({ length: count }, (_, index) =>
    new Date(Date.UTC(year, monthNumber - count + index - 1, 1)).toISOString().slice(0, 7),
  );
}

export function expensesWithRefunds(transactions: readonly Transaction[], asOf: string) {
  const refundsByExpense = new Map<string, Refund[]>();
  for (const transaction of transactions) {
    if (transaction.kind === "refund" && transaction.date <= asOf) {
      const refunds = refundsByExpense.get(transaction.expenseId) ?? [];
      refunds.push(transaction);
      refundsByExpense.set(transaction.expenseId, refunds);
    }
  }

  return transactions
    .filter((transaction): transaction is Expense => transaction.kind === "expense" && transaction.date <= asOf)
    .map(expense => {
      const refunds = refundsByExpense.get(expense.id) ?? [];
      const receivedCents = refunds.reduce((sum, refund) => sum + refund.amountCents, 0);
      const netCents = Math.max(0, expense.amountCents - receivedCents);
      const status = netCents === 0 ? "completed" : receivedCents > 0 ? "partial" : "pending";
      return { expense, refunds, receivedCents, netCents, status } as const;
    });
}

export function spendingByMonth(transactions: readonly Transaction[], asOf: string) {
  const months = new Map<string, { dailyCents: number[]; categoryCents: Map<string, number> }>();
  for (const { expense, netCents } of expensesWithRefunds(transactions, asOf)) {
    if (netCents === 0) continue;

    const month = expense.date.slice(0, 7);
    const day = Number(expense.date.slice(8));
    let period = months.get(month);
    if (!period) {
      period = { dailyCents: Array<number>(daysInMonth(month)).fill(0), categoryCents: new Map() };
      months.set(month, period);
    }

    period.dailyCents[day - 1] += netCents;
    const category = transactionCategory(expense);
    period.categoryCents.set(category, (period.categoryCents.get(category) ?? 0) + netCents);
  }

  return months;
}

export function categoryBreakdown(spending: ReturnType<typeof spendingByMonth>, month: string) {
  const entries = spending.get(month)?.categoryCents ?? [];
  const categories = Array.from(entries, ([name, cents]) => ({ name, cents }))
    .sort((first, second) => second.cents - first.cents);
  return { month, categories, totalCents: categories.reduce((sum, { cents }) => sum + cents, 0) };
}

function cumulativeSpending(dailyCents: readonly number[]) {
  let totalCents = 0;
  return dailyCents.map(cents => {
    totalCents += cents;
    return totalCents;
  });
}

export function spendingPace(spending: ReturnType<typeof spendingByMonth>, asOf: string) {
  const month = asOf.slice(0, 7);
  const asOfDay = Number(asOf.slice(8));
  const count = daysInMonth(month);
  const current = cumulativeSpending(spending.get(month)?.dailyCents ?? []);
  const history = previousMonths(month, 3).map(period =>
    cumulativeSpending(spending.get(period)?.dailyCents ?? []),
  );

  return Array.from({ length: count }, (_, index) => {
    // Carry a shorter month's closing total forward to the remaining calendar days.
    const historicalCents = history.reduce(
      (sum, period) => sum + (period[Math.min(index, period.length - 1)] ?? 0),
      0,
    );
    return {
      day: index + 1,
      currentCents: index < asOfDay ? current[index] ?? 0 : null,
      averageCents: Math.round(historicalCents / history.length),
    };
  });
}
