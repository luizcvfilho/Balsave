import type { Transaction } from "../../lib/finance";
import { formatMonth } from "../../lib/format";
import { SectionCard } from "../cards/section-card";
import { orderedTransactions, TransactionTable } from "../details/transaction-table";

export function RecentTransactions({ month, transactions, getHref }: {
  month: string;
  transactions: Transaction[];
  getHref: (id?: string) => string;
}) {
  return (
    <SectionCard id="lancamentos" title="Lançamentos recentes" description={formatMonth(month)} href={getHref()} linkLabel="Ver extrato" flushContent>
      <TransactionTable label="Lançamentos recentes" rows={orderedTransactions(transactions.map(transaction => ({ transaction }))).slice(0, 4)}
        getHref={getHref} balanceScope="consolidated" compactDates empty="Nenhum lançamento neste período." />
    </SectionCard>
  );
}
