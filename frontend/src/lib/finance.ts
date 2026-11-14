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
} & (
  | { kind: "expense"; merchantType?: string }
  | { kind: "refund"; expenseId: string }
  | { kind: "income" | "transfer" }
);

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

export function spendingByMonth(transactions: readonly Transaction[], asOf: string) {
  const refundsByExpense = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.kind === "refund" && transaction.date <= asOf) {
      const receivedCents = refundsByExpense.get(transaction.expenseId) ?? 0;
      refundsByExpense.set(transaction.expenseId, receivedCents + transaction.amountCents);
    }
  }

  const months = new Map<string, { dailyCents: number[]; categoryCents: Map<string, number> }>();
  for (const transaction of transactions) {
    if (transaction.kind !== "expense" || transaction.date > asOf) continue;

    const month = transaction.date.slice(0, 7);
    const day = Number(transaction.date.slice(8));
    const refundedCents = refundsByExpense.get(transaction.id) ?? 0;
    const netCents = Math.max(0, transaction.amountCents - refundedCents);
    if (netCents === 0) continue;

    let period = months.get(month);
    if (!period) {
      period = { dailyCents: Array<number>(daysInMonth(month)).fill(0), categoryCents: new Map() };
      months.set(month, period);
    }

    period.dailyCents[day - 1] += netCents;
    const category = transactionCategory(transaction);
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
