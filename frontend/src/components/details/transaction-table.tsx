/** biome-ignore-all lint/a11y/noRedundantRoles: Retain native table semantics in Safari when the mobile layout stacks the cells. */
import Link from "next/link";
import type { ReactNode } from "react";
import { useFinancialReports } from "../../data/financial-reports";
import { bankBalanceImpact, isIncoming, ledgerBalanceImpact, paymentMethodLabels, type Transaction, transactionCategory, transactionCategoryKey } from "../../lib/finance";
import { formatMoney, formatNumericDate, formatSignedMoney } from "../../lib/format";
import { CategoryChip, CategoryIcon, TagChip } from "./transaction-classification";
import styles from "./transaction-table.module.css";

const amountColors = {
  expense: "var(--negative)",
  income: "var(--positive)",
  refund: "var(--positive)",
  credit: "var(--positive)",
  transfer: "var(--text-secondary)",
} satisfies Record<Transaction["kind"], string>;

function balanceImpactColor(impact: number) {
  if (impact > 0) return "var(--positive)";
  if (impact < 0) return "var(--negative)";
  return "var(--text-secondary)";
}

export type TransactionRow = {
  transaction: Transaction;
  netCents?: number;
  receivedCents?: number;
  annotation?: string;
  tags?: readonly string[];
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

export function TransactionTable({ label, rows, getHref, showPaymentMethod = false, renderTags, balanceScope, amountHeading, compactDates = false, empty = "Nenhum lançamento para os filtros selecionados." }: {
  label: string;
  rows: TransactionRow[];
  getHref: (id: string) => string;
  showPaymentMethod?: boolean;
  renderTags?: (transaction: Transaction) => ReactNode;
  balanceScope?: "account" | "consolidated";
  amountHeading?: string;
  empty?: string;
  compactDates?: boolean;
}) {
  const { transactionInstitution, live, tags: personalTags } = useFinancialReports();
  if (rows.length === 0) return <p className={styles.empty}>{empty}</p>;
  const tagNames = new Map(personalTags.map(tag => [tag.id, tag.name]));

  return (
    <table className={styles.table} role="table" aria-label={label} data-rail={balanceScope === "consolidated" || undefined}>
      <thead role="rowgroup">
        <tr role="row">
          <th role="columnheader" scope="col" className={styles.description}>Lançamento</th>
          <th role="columnheader" scope="col" className={styles.classifications}>Classificações</th>
          <th role="columnheader" scope="col" className={styles.origin}>Banco / cartão</th>
          {showPaymentMethod && <th role="columnheader" scope="col" className={styles.payment}>Forma de pagamento</th>}
          <th role="columnheader" scope="col" className={styles.amount}>{amountHeading ?? (rows.some(row => row.netCents !== undefined) ? "Gasto líquido" : "Valor")}</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {rows.map(({ transaction, netCents, receivedCents, annotation, tags }) => {
          const origin = transactionInstitution(transaction);
          const categoryKey = transactionCategoryKey(transaction);
          const category = <CategoryChip categoryKey={categoryKey} categoryId={transaction.kind === "expense" ? transaction.categoryId : undefined} label={transactionCategory(transaction)} />;
          const paymentMethod = transaction.paymentMethod ?? (transaction.cardId ? "credit_card" : undefined);
          const installment = transaction.kind === "expense" ? transaction.installment : undefined;
          const impact = balanceScope === "account" ? bankBalanceImpact(transaction)
            : balanceScope === "consolidated" ? ledgerBalanceImpact(transaction) : undefined;
          const amountColor = impact === undefined ? amountColors[transaction.kind]
            : impact < 0 && balanceScope === "consolidated" ? "var(--ink)" : balanceImpactColor(impact);
          const date = formatNumericDate(transaction.date);
          return (
            <tr role="row" key={transaction.id}>
              <td role="cell" className={styles.description}>
                <div className={styles.transactionTitle}>
                  <span className={styles.tile}><CategoryIcon categoryKey={categoryKey} /></span>
                  <Link className={styles.name} href={getHref(transaction.id)}>{transaction.name}</Link>
                  <div className={styles.metadata}>
                    <div>
                      <time dateTime={transaction.date} title={compactDates ? date : undefined}>
                        {compactDates ? date.slice(0, 5) : date}
                      </time>
                      {origin && <span className={styles.compactOrigin}>
                        {" · "}{origin.bank}{origin.cardEnding && ` •••• ${origin.cardEnding}`}
                      </span>}
                    </div>
                    {installment && <span>
                      {installment.number
                        ? `Parcela ${installment.number}${installment.count ? `/${installment.count}` : ""}`
                        : "Compra parcelada"}
                    </span>}
                    {annotation && <span>{annotation}</span>}
                  </div>
                </div>
              </td>
              <td role="cell" className={styles.classifications}>
                <div className={styles.chips}>
                  {transaction.kind === "expense" && live ? <Link className={styles.categoryAction}
                    href={getHref(transaction.id)} aria-label={`Alterar categoria de ${transaction.name}: ${transactionCategory(transaction)}`}>
                    {category}
                  </Link> : category}
                  {(tags ?? transaction.tags)?.map(tag => <TagChip key={tag} id={tag} label={tag} />)}
                  {renderTags ? renderTags(transaction) : transaction.tagIds?.map(id => {
                    const label = tagNames.get(id);
                    return label ? <TagChip key={id} id={id} label={label} /> : null;
                  })}
                </div>
              </td>
              <td role="cell" className={styles.origin}>
                {origin && <InstitutionLabel bank={origin.bank} detail={balanceScope !== "consolidated" || transaction.cardId ? origin.detail : undefined} />}
              </td>
              {showPaymentMethod && (
                <td role="cell" className={styles.payment}>
                  {(paymentMethod && paymentMethodLabels[paymentMethod]) || "Não identificada"}
                </td>
              )}
              <td role="cell" className={styles.amount}>
                <span className={styles.value} style={{ color: netCents === undefined ? amountColor : undefined }}>
                  {netCents === undefined && (
                    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d={impact === 0 ? "M4 12h16" : isIncoming(transaction) ? "M18 6 6 18m0-8v8h8" : "M6 18 18 6m-8 0h8v8"} />
                    </svg>
                  )}
                  {netCents === undefined
                    ? formatSignedMoney(isIncoming(transaction) ? transaction.amountCents : -transaction.amountCents)
                    : formatMoney(netCents)}
                </span>
                {impact === 0 && <span className="sr-only">Movimentação interna ou sem efeito no saldo.</span>}
                {!!transaction.reconciliationCostCents && <span className={styles.amountDetail}>
                  {formatMoney(transaction.reconciliationCostCents)} de custos na movimentação
                </span>}
                {!!receivedCents && (
                  <span className={styles.amountDetail}>
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

export function InstitutionLabel({ bank, detail }: { bank: string; detail?: string }) {
  const key = bank.toLocaleLowerCase("pt-BR");
  const monogram = key === "itaú" ? "it" : key === "nubank" ? "nu" : key === "inter" ? "in" : undefined;
  return (
    <span className={styles.institution}>
      <span className={styles.institutionIcon} data-bank={monogram} aria-hidden="true">
        {monogram ?? (
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-5 9 5v2H3zm0 11h18M6 11v6m4-6v6m4-6v6m4-6v6" />
          </svg>
        )}
      </span>
      <span>{bank}</span>
      {detail && <span className={styles.institutionDetail}>{detail}</span>}
    </span>
  );
}
