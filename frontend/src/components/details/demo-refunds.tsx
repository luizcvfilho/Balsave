import Link from "next/link";
import { useFinancialReports } from "../../data/financial-reports";
import type { Transaction } from "../../lib/finance";
import { formatDate, formatMoney, formatSignedMoney } from "../../lib/format";
import { optionValue } from "../../lib/report-links";
import { BreakdownList } from "../cards/breakdown-list";
import { SectionCard } from "../cards/section-card";
import { PeriodFields, ReportSelect, usePeriod } from "./report-filters";
import { ReportMetrics } from "./report-metrics";
import { useReportQuery } from "./report-query";

const refundLabels = {
  pending: "Pendente",
  partial: "Parcial",
  completed: "Concluído",
};
const statusOptions = [
  { value: "", label: "Todos os status" },
  { value: "pending", label: "Pendentes" },
  { value: "partial", label: "Parciais" },
  { value: "completed", label: "Concluídos" },
];

export function DemoRefunds({ transactionHref }: { transactionHref: (id: string) => string }) {
  const { params, update } = useReportQuery();
  const { asOf, trackedRefunds } = useFinancialReports();
  const period = usePeriod(params, "todos");
  const status = optionValue(params.get("status"), Object.keys(refundLabels));
  const results = trackedRefunds.filter(group =>
    (!status || group.status === status)
    && (period.includes(group.expense.date) || group.refunds.some(refund => period.includes(refund.date))),
  ).sort((first, second) => second.expense.date.localeCompare(first.expense.date));

  return (
    <SectionCard id="acompanhamento" title="Acompanhar reembolsos">
      <div className="report-filters">
        <PeriodFields period={period} update={update} />
        <ReportSelect label="Status" value={status} options={statusOptions} onChange={value => update({ status: value })} />
      </div>
      <p className="report-muted">
        Compras ou recebimentos no período. O saldo pendente considera os valores recebidos até {formatDate(asOf)}.
      </p>
      {results.length > 0 ? (
        // biome-ignore lint/a11y/noRedundantRoles: Safari can omit the list role when markers are hidden.
        <ul className="report-list" role="list">
          {results.map(group => (
            <li key={group.expense.id} className="report-list-item">
              <div className="report-group">
                <Link className="report-link report-action" href={transactionHref(group.expense.id)}>{group.expense.name}</Link>
                <span className="report-strong">{refundLabels[group.status]}</span>
              </div>
              <p className="report-muted">Compra em {formatDate(group.expense.date)}</p>
              <RefundAmounts group={group} />
              <RefundCredits group={group} transactionHref={transactionHref} />
            </li>
          ))}
        </ul>
      ) : <p className="report-muted" role="status">Nenhum reembolso para os filtros selecionados.</p>}
    </SectionCard>
  );
}

type RefundGroup = ReturnType<typeof useFinancialReports>["trackedRefunds"][number];

function RefundAmounts({ group }: { group: RefundGroup }) {
  return <ReportMetrics items={[
    { label: "Valor original", value: formatMoney(group.expense.amountCents) },
    { label: "Recebido", value: formatMoney(group.receivedCents) },
    { label: "Saldo pendente", value: formatMoney(group.netCents) },
  ]} />;
}

function RefundCredits({ group, transactionHref }: { group: RefundGroup; transactionHref: (id: string) => string }) {
  if (group.refunds.length === 0) return <p className="report-muted">Nenhum valor recebido até o momento.</p>;

  return (
    <BreakdownList rows={[...group.refunds].sort((first, second) => second.date.localeCompare(first.date))
      .map(refund => ({
        key: refund.id,
        label: (
          <Link className="report-link report-action" href={transactionHref(refund.id)}>
            {refund.name} · {formatDate(refund.date)}
          </Link>
        ),
        value: formatSignedMoney(refund.amountCents),
      }))} />
  );
}

export function DemoRefundDetail({ transaction, transactionHref }: {
  transaction: Transaction;
  transactionHref: (id: string) => string;
}) {
  const { trackedRefunds } = useFinancialReports();
  const group = trackedRefunds.find(({ expense }) => {
    const expenseId = transaction.kind === "refund" ? transaction.expenseId : transaction.id;
    return expense.id === expenseId;
  });
  if (!group) return null;

  return (
    <SectionCard id="vinculo-reembolso" title="Acompanhamento do reembolso" description={refundLabels[group.status]}>
      {transaction.kind === "refund" && (
        <Link className="report-link report-action" href={transactionHref(group.expense.id)}>
          Compra original · {group.expense.name} · {formatDate(group.expense.date)}
        </Link>
      )}
      <RefundAmounts group={group} />
      {transaction.kind === "expense" && <RefundCredits group={group} transactionHref={transactionHref} />}
    </SectionCard>
  );
}
