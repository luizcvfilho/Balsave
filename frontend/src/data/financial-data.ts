import type { AccountBalance, CreditCard, Transaction } from "../lib/finance";

export type ReportAccount = Omit<AccountBalance, "balanceCents"> & {
  id: string;
  name: string;
  balanceCents: number | null;
};

export type ReportCard = CreditCard & {
  id: string;
  availableCents?: number | null;
  openInvoice: { dueDate: string; transactionIds: string[] } | null;
  installments: { name: string; month: string; number: number; count: number; amountCents: number }[];
};

export type FinancialData = {
  asOf: string;
  accounts: ReportAccount[];
  cards: ReportCard[];
  transactions: Transaction[];
  balanceSnapshots: { month: string; accounts: AccountBalance[] }[];
  spendingMonths?: string[];
  connectionCount: number;
  failedConnections: number;
};

export function accountBalances(accounts: ReportAccount[]) {
  return accounts.flatMap(account => account.balanceCents === null ? [] : [{
    bank: account.bank,
    balanceCents: account.balanceCents,
  }]);
}
