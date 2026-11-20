export type AccountBalance = {
  bank: string;
  balanceCents: number;
};

export type CreditCard = {
  bank: string;
  lastFour: string;
  usedCents: number | null;
  limitCents: number | null;
};

export const paymentMethodLabels = {
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  card: "Cartão (tipo não informado)",
  pix: "Pix",
  boleto: "Boleto",
  ted: "TED",
  doc: "DOC",
  bank_transfer: "Transferência bancária",
  automatic_debit: "Débito automático",
  check: "Cheque",
};

export type Transaction = {
  id: string;
  date: string;
  name: string;
  amountCents: number;
  accountId?: string;
  cardId?: string;
  investmentId?: string;
  balanceImpactCents?: number;
  reconciliation?: "automatic" | "confirmed";
  counterpartId?: string;
  transferAccountId?: string;
  transferCashCents?: number;
  reconciliationCostCents?: number;
  paymentMethod?: keyof typeof paymentMethodLabels;
} & (
  | {
    kind: "expense";
    merchantType?: string;
    category?: string;
    expectsRefund?: boolean;
    installment?: { number?: number; count?: number };
  }
  | { kind: "refund"; expenseId: string }
  | { kind: "income" }
  | { kind: "credit" }
  | { kind: "transfer"; direction?: "in" | "out"; internalTransfer?: "account" | "investment"; transferAccountId?: string }
);

export type Expense = Extract<Transaction, { kind: "expense" }>;
type Refund = Extract<Transaction, { kind: "refund" }>;

export const transactionKindLabels = {
  expense: "Despesa",
  income: "Receita",
  refund: "Reembolso",
  credit: "Crédito",
  transfer: "Transferência",
} satisfies Record<Transaction["kind"], string>;

export function isIncoming(transaction: Transaction) {
  return transaction.kind === "income" || transaction.kind === "refund" || transaction.kind === "credit"
    || (transaction.kind === "transfer" && transaction.direction === "in");
}

export function bankBalanceImpact(transaction: Transaction) {
  if (!transaction.accountId && !transaction.investmentId) return 0;
  return transaction.balanceImpactCents ?? (isIncoming(transaction) ? transaction.amountCents : -transaction.amountCents);
}

export function ledgerBalanceImpact(transaction: Transaction) {
  return transaction.reconciliation ? 0 : bankBalanceImpact(transaction);
}

export function bankTransfersAfterMonth(transactions: readonly Transaction[], accounts: ReadonlySet<string>, month: string) {
  return transactions.reduce((sum, transaction) => {
    const positionId = transaction.accountId ?? transaction.investmentId;
    if (transaction.kind !== "transfer" || !positionId || !transaction.transferAccountId
      || !accounts.has(positionId) || !accounts.has(transaction.transferAccountId)
      || transaction.date.slice(0, 7) <= month) return sum;
    return sum + (transaction.transferCashCents ?? bankBalanceImpact(transaction));
  }, 0);
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
      return transaction.category ?? categoriesByMerchantType.get(transaction.merchantType ?? "") ?? "Sem categoria";
    case "income":
      return "Receitas";
    case "refund":
      return "Reembolso";
    case "credit":
      return "Crédito";
    case "transfer":
      return transaction.internalTransfer || transaction.balanceImpactCents === 0 ? "Transferência interna" : "Transferência";
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
      usedCents: totals.usedCents === null || card.usedCents === null ? null : totals.usedCents + card.usedCents,
      limitCents: totals.limitCents === null || card.limitCents === null ? null : totals.limitCents + card.limitCents,
    }),
    { usedCents: 0, limitCents: 0 } as Pick<CreditCard, "usedCents" | "limitCents">,
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
  const months = new Map<string, { dailyCents: number[]; categoryCents: Map<string, number>; installmentCents: number }>();
  for (const { expense, netCents } of expensesWithRefunds(transactions, asOf)) {
    if (netCents === 0) continue;

    const month = expense.date.slice(0, 7);
    const day = Number(expense.date.slice(8));
    let period = months.get(month);
    if (!period) {
      period = { dailyCents: Array<number>(daysInMonth(month)).fill(0), categoryCents: new Map(), installmentCents: 0 };
      months.set(month, period);
    }

    period.dailyCents[day - 1] += netCents;
    const category = transactionCategory(expense);
    period.categoryCents.set(category, (period.categoryCents.get(category) ?? 0) + netCents);
    if (expense.installment) period.installmentCents += netCents;
  }

  return months;
}

export function categoryBreakdown(spending: ReturnType<typeof spendingByMonth>, month: string) {
  const period = spending.get(month);
  const entries = period?.categoryCents ?? [];
  const categories = Array.from(entries, ([name, cents]) => ({ name, cents }))
    .sort((first, second) => second.cents - first.cents);
  return {
    month, categories, installmentCents: period?.installmentCents ?? 0,
    totalCents: categories.reduce((sum, { cents }) => sum + cents, 0),
  };
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
