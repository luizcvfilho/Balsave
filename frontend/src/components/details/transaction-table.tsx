/** biome-ignore-all lint/a11y/noRedundantRoles: Retain native table semantics in Safari when the mobile layout stacks the cells. */
import Link from "next/link";
import { transactionSource } from "../../data/mock-reports";
import { isIncoming, type Transaction, transactionCategory } from "../../lib/finance";
import { formatMoney, formatNumericDate, formatSignedMoney } from "../../lib/format";

export const amountColors = {
  expense: "var(--negative)",
  income: "var(--positive)",
  refund: "var(--positive)",
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

export function TransactionTable({ label, rows, getHref, empty = "Nenhum lançamento para os filtros selecionados." }: {
  label: string;
  rows: TransactionRow[];
  getHref: (id: string) => string;
  empty?: string;
}) {
  if (rows.length === 0) return <p className="report-muted">{empty}</p>;

  return (
    <table className="report-table" role="table" aria-label={label}>
      <thead role="rowgroup">
        <tr role="row">
          <th role="columnheader" scope="col">Descrição</th>
          <th role="columnheader" scope="col">Categoria</th>
          <th role="columnheader" scope="col">Data</th>
          <th role="columnheader" scope="col">{rows.some(row => row.netCents !== undefined) ? "Gasto líquido" : "Valor"}</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {rows.map(({ transaction, netCents, receivedCents, annotation }) => {
          const source = transactionSource(transaction);
          return (
            <tr role="row" key={transaction.id}>
              <td role="cell" className="report-transaction-name">
                <Link className="report-link" href={getHref(transaction.id)}>
                  {transaction.name}
                </Link>
                {source && <span className="report-cell-detail">{source}</span>}
                {annotation && <span className="report-cell-detail">{annotation}</span>}
              </td>
              <td role="cell" className="report-transaction-category">{transactionCategory(transaction)}</td>
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
