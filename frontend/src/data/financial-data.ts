import type { AccountBalance, CreditCard, Transaction } from "../lib/finance";

export type ReportAccount = Omit<AccountBalance, "balanceCents"> & {
  id: string;
  name: string;
  balanceCents: number | null;
};

export type PlannedInstallment = {
  id: string;
  transactionId?: string;
  name: string;
  category: string;
  date: string;
  number: number;
  count: number;
  amountCents: number;
};

export type ReportCard = CreditCard & {
  id: string;
  name?: string;
  availableCents?: number | null;
  openInvoice: { dueDate: string; transactionIds: string[] } | null;
  installments: PlannedInstallment[];
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

export function cardLabel({ bank, name, lastFour }: Pick<ReportCard, "bank" | "name" | "lastFour">) {
  const product = name?.toLocaleLowerCase("pt-BR") === bank.toLocaleLowerCase("pt-BR") ? undefined : name;
  const ending = lastFour ? `final ${lastFour}` : undefined;
  return [bank, product, ending ?? (product ? undefined : "Cartão")].filter(Boolean).join(" · ");
}

export function accountBalances(accounts: ReportAccount[]) {
  return accounts.flatMap(account => account.balanceCents === null ? [] : [{
    bank: account.bank,
    balanceCents: account.balanceCents,
  }]);
}
