/** biome-ignore-all lint/a11y/noRedundantRoles: Retain native table semantics in Safari when the mobile layout stacks the cells. */
import Link from "next/link";
import { useFinancialReports } from "../../data/financial-reports";
import { isIncoming, paymentMethodLabels, type Transaction, transactionCategory } from "../../lib/finance";
import { formatMoney, formatNumericDate, formatSignedMoney } from "../../lib/format";

export const amountColors = {
  expense: "var(--negative)",
  income: "var(--positive)",
  refund: "var(--positive)",
  credit: "var(--positive)",
  transfer: "var(--text-secondary)",
} satisfies Record<Transaction["kind"], string>;

export type TransactionRow = {
  transaction: Transaction;
  netCents?: number;
  receivedCents?: number;
  annotation?: string;
};

export function orderedTransactions(rows: TransactionRow[], order = "recent") {
  return [...rows].sort((first, second) => {
    const dateOrder = second.transaction.date.localeCompare(first.transaction.date);
    if (order === "oldest") return -dateOrder;
    if (order === "highest") {
      return (second.netCents ?? second.transaction.amountCents) - (first.netCents ?? first.transaction.amountCents) || dateOrder;
    }
    if (order === "lowest") {
      return (first.netCents ?? first.transaction.amountCents) - (second.netCents ?? second.transaction.amountCents) || dateOrder;
    }
    return dateOrder;
  });
}

export function TransactionTable({ label, rows, getHref, showPaymentMethod = false, empty = "Nenhum lançamento para os filtros selecionados." }: {
  label: string;
  rows: TransactionRow[];
  getHref: (id: string) => string;
  showPaymentMethod?: boolean;
  empty?: string;
}) {
  const { transactionSource } = useFinancialReports();
  if (rows.length === 0) return <p className="report-muted">{empty}</p>;

  return (
    <table className="report-table" role="table" aria-label={label}>
      <thead role="rowgroup">
        <tr role="row">
          <th role="columnheader" scope="col">Descrição</th>
          <th role="columnheader" scope="col">Categoria</th>
          {showPaymentMethod && <th role="columnheader" scope="col">Forma de pagamento</th>}
          <th role="columnheader" scope="col">Data</th>
          <th role="columnheader" scope="col">{rows.some(row => row.netCents !== undefined) ? "Gasto líquido" : "Valor"}</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {rows.map(({ transaction, netCents, receivedCents, annotation }) => {
          const source = transactionSource(transaction);
          const paymentMethod = transaction.paymentMethod ?? (transaction.cardId ? "credit_card" : undefined);
          const installment = transaction.kind === "expense" ? transaction.installment : undefined;
          return (
            <tr role="row" key={transaction.id}>
              <td role="cell" className="report-transaction-name">
                <Link className="report-link" href={getHref(transaction.id)}>
                  {transaction.name}
                </Link>
                {source && <span className="report-cell-detail">{source}</span>}
                {installment && <span className="report-cell-detail">
                  {installment.number
                    ? `Parcela ${installment.number}${installment.count ? `/${installment.count}` : ""}`
                    : "Compra parcelada"}
                </span>}
                {annotation && <span className="report-cell-detail">{annotation}</span>}
              </td>
              <td role="cell" className="report-transaction-category">{transactionCategory(transaction)}</td>
              {showPaymentMethod && (
                <td role="cell" className="report-transaction-payment">
                  {(paymentMethod && paymentMethodLabels[paymentMethod]) || "Não identificada"}
                </td>
              )}
              <td role="cell" className="report-transaction-date">
                <time dateTime={transaction.date}>{formatNumericDate(transaction.date)}</time>
              </td>
              <td role="cell" className="report-transaction-amount">
                <span style={{ color: netCents === undefined ? amountColors[transaction.kind] : undefined }}>
                  {netCents === undefined
                    ? formatSignedMoney(isIncoming(transaction) ? transaction.amountCents : -transaction.amountCents)
                    : formatMoney(netCents)}
                </span>
                {!!receivedCents && (
                  <span className="report-cell-detail">
                    De {formatMoney(transaction.amountCents)} · {formatMoney(receivedCents)} reembolsados
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
