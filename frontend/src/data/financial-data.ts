import type { AccountBalance, CreditCard, Transaction, TransactionTag } from "../lib/finance";
import type { ReceivableGroup } from "../lib/receivables";

export type ReportAccount = Omit<AccountBalance, "balanceCents"> & {
  id: string;
  name: string;
  balanceCents: number | null;
};

export type ReportInvestment = ReportAccount & {
  asOf: string;
  includedInAccountId?: string;
  fund?: { lastTwelveMonthsRateBps: number | null };
};
export type ReconciliationCandidate = { entryId: string; counterpartId: string | null };

export type LocalCategory = { id: string; code: string | null; name: string; archived: boolean; archivedAt?: string | null };
export type CategoryAccountOption = { id: string; label: string };
export type CategoryRule = {
  id: string;
  categoryId: string;
  description: string;
  matchType: "exact" | "contains" | "starts_with" | "ends_with";
  accountId: string | null;
  priority: number;
  startsOn: string | null;
  enabled: boolean;
};

export type PlannedInstallment = {
  id: string;
  transactionId?: string;
  name: string;
  category: string;
  categoryKey?: string;
  categoryId?: string | null;
  categoryTransactionId?: string;
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
  tags?: TransactionTag[];
  receivableGroups?: ReceivableGroup[];
  categories?: LocalCategory[];
  categoryRules?: CategoryRule[];
  categoryCatalogStale?: boolean;
  asOf: string;
  accounts: ReportAccount[];
  investments?: ReportInvestment[];
  reconciliationCandidates?: ReconciliationCandidate[];
  failedInvestments?: number;
  cards: ReportCard[];
  transactions: Transaction[];
  balanceSnapshots: { month: string; accounts: (AccountBalance & { id: string })[] }[];
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
