"use client";

import Link from "next/link";
import { useState } from "react";
import { BreakdownList } from "../../components/cards/breakdown-list";
import { SectionCard } from "../../components/cards/section-card";
import { ReceiptEditor, useReceiptAnnotations } from "../../components/details/receipt-annotations";
import { matchesSearch, PeriodFields, usePeriod, ReportSelect, SearchField } from "../../components/details/report-filters";
import { ReportLayout, ReportNavigation } from "../../components/details/report-layout";
import { ReportMetrics } from "../../components/details/report-metrics";
import { useReportQuery } from "../../components/details/report-query";
import { kindOptions, orderOptions, useCategoryOptions } from "../../components/details/transaction-filters";
import { orderedTransactions, TransactionTable } from "../../components/details/transaction-table";
import { useFinancialReports } from "../../data/financial-reports";
import { bankBalanceImpact, isIncoming, type Transaction, transactionCategory, transactionKindLabels } from "../../lib/finance";
import { formatDate, formatMoney, formatSignedMoney } from "../../lib/format";
import { optionValue } from "../../lib/report-links";

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

export function TransactionsPage() {
  const { params, href } = useReportQuery();
  const { reportedTransactions } = useFinancialReports();
  const dashboardMonth = params.get("painelMes");
  const refunds = params.get("aba") === "reembolsos";
  const id = params.get("lancamento");
  const selected = reportedTransactions.find(transaction => transaction.id === id);
  const [search, setSearch] = useState("");

  if (id) {
    return (
      <ReportLayout
        title="Detalhe do lançamento"
        dashboardMonth={dashboardMonth}
        back={{ href: href({ lancamento: undefined }), label: refunds ? "Voltar aos reembolsos" : "Voltar aos lançamentos" }}
      >
        {selected ? <TransactionDetail key={selected.id} transaction={selected} /> : (
          <SectionCard id="lancamento-ausente" title="Lançamento não encontrado">
            <p className="report-muted">Volte aos lançamentos para selecionar outro item.</p>
          </SectionCard>
        )}
      </ReportLayout>
    );
  }

  return (
    <ReportLayout title="Lançamentos" dashboardMonth={dashboardMonth}>
      <ReportNavigation label="Detalhes de lançamentos" options={[
        { label: "Todos os lançamentos", href: href({ aba: undefined }), active: !refunds },
        { label: "Reembolsos", href: href({ aba: "reembolsos" }), active: refunds },
      ]} />
      {refunds ? <Refunds /> : <TransactionLedger search={search} setSearch={setSearch} />}
    </ReportLayout>
  );
}

function TransactionLedger({ search, setSearch }: { search: string; setSearch: (value: string) => void }) {
  const { params, href, update } = useReportQuery();
  const { live, reportedTransactions } = useFinancialReports();
  const annotations = useReceiptAnnotations(!live);
  const period = usePeriod(params);
  const ledgerCategoryOptions = useCategoryOptions(true);
  const types = live ? kindOptions : kindOptions.filter(option => option.value !== "credit");
  const type = optionValue(params.get("tipo"), types.map(option => option.value));
  const category = optionValue(params.get("categoria"), ledgerCategoryOptions.map(option => option.value));
  const order = optionValue(params.get("ordem"), orderOptions.map(option => option.value), "recent");
  const matches = reportedTransactions.filter(transaction => {
    const annotation = annotations[transaction.id];
    return period.includes(transaction.date)
      && (!type || transaction.kind === type)
      && (!category || transactionCategory(transaction) === category)
      && matchesSearch(search, transaction.name, annotation?.classification, ...(annotation?.tags ?? []));
  });
  const rows = orderedTransactions(matches.map(transaction => {
    const annotation = annotations[transaction.id];
    return { transaction, annotation: annotation && [annotation.classification, ...annotation.tags].filter(Boolean).join(" · ") };
  }), order);

  return (
    <SectionCard id="historico-lancamentos" title="Histórico de lançamentos"
      description="Verde indica entradas externas, vermelho indica saídas externas e cinza indica movimentações internas ou lançamentos sem efeito no saldo.">
      <div className="report-filters">
        <PeriodFields period={period} update={update} />
        <ReportSelect label="Tipo" value={type} options={types} onChange={value => update({ tipo: value })} />
        <ReportSelect label="Categoria" value={category} options={ledgerCategoryOptions} onChange={value => update({ categoria: value })} />
        <SearchField value={search} onChange={setSearch} />
        <ReportSelect label="Ordenar por" value={order} options={orderOptions} onChange={value => update({ ordem: value })} />
      </div>
      <p className="report-muted" role="status">{rows.length} {rows.length === 1 ? "lançamento" : "lançamentos"}</p>
      <TransactionTable label="Lançamentos filtrados" rows={rows} balanceScope="consolidated" getHref={id => href({ lancamento: id })} />
    </SectionCard>
  );
}

function Refunds() {
  const { params, href, update } = useReportQuery();
  const { asOf, live, trackedRefunds } = useFinancialReports();
  const period = usePeriod(params, "todos");
  const status = optionValue(params.get("status"), Object.keys(refundLabels));
  const results = trackedRefunds.filter(group =>
    (!status || group.status === status)
    && (period.includes(group.expense.date) || group.refunds.some(refund => period.includes(refund.date))),
  ).sort((first, second) => second.expense.date.localeCompare(first.expense.date));

  if (live) {
    return (
      <SectionCard id="acompanhamento" title="Acompanhar reembolsos">
        <p className="report-muted">Créditos importados aparecem em “Todos os lançamentos”. O acompanhamento depende do vínculo com a compra original.</p>
      </SectionCard>
    );
  }

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
                <Link className="report-link report-action" href={href({ lancamento: group.expense.id })}>{group.expense.name}</Link>
                <span className="report-strong">{refundLabels[group.status]}</span>
              </div>
              <p className="report-muted">Compra em {formatDate(group.expense.date)}</p>
              <RefundAmounts group={group} />
              <RefundCredits group={group} />
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

function RefundCredits({ group }: { group: RefundGroup }) {
  const { href } = useReportQuery();
  if (group.refunds.length === 0) return <p className="report-muted">Nenhum valor recebido até o momento.</p>;

  return (
    <BreakdownList rows={[...group.refunds].sort((first, second) => second.date.localeCompare(first.date))
      .map(refund => ({
        key: refund.id,
        label: (
          <Link className="report-link report-action" href={href({ lancamento: refund.id })}>
            {refund.name} · {formatDate(refund.date)}
          </Link>
        ),
        value: formatSignedMoney(refund.amountCents),
      }))} />
  );
}

function TransactionDetail({ transaction }: { transaction: Transaction }) {
  const { href } = useReportQuery();
  const { live, trackedRefunds, transactionSource } = useFinancialReports();
  const annotations = useReceiptAnnotations(!live);
  const group = trackedRefunds.find(({ expense }) => {
    const expenseId = transaction.kind === "refund" ? transaction.expenseId : transaction.id;
    return expense.id === expenseId;
  });
  const source = transactionSource(transaction);
  const impact = bankBalanceImpact(transaction);

  return (
    <>
      <SectionCard id="detalhe-lancamento" title={transaction.name} description={formatDate(transaction.date)}>
        <ReportMetrics items={[
          { label: "Valor", value: formatSignedMoney(isIncoming(transaction) ? transaction.amountCents : -transaction.amountCents) },
          { label: transaction.accountId ? "Impacto nesta conta" : transaction.investmentId ? "Impacto neste investimento" : "Impacto no saldo em contas", value: impact === 0 ? "Sem efeito" : formatSignedMoney(impact) },
          { label: "Tipo", value: transactionKindLabels[transaction.kind] },
          { label: "Categoria", value: transactionCategory(transaction) },
          ...(source ? [{ label: "Conta ou cartão", value: source }] : []),
        ]} />
      </SectionCard>
      {group && (
        <SectionCard id="vinculo-reembolso" title="Acompanhamento do reembolso" description={refundLabels[group.status]}>
          {transaction.kind === "refund" && (
            <Link className="report-link report-action" href={href({ lancamento: group.expense.id })}>
              Compra original · {group.expense.name} · {formatDate(group.expense.date)}
            </Link>
          )}
          <RefundAmounts group={group} />
          {transaction.kind === "expense" && <RefundCredits group={group} />}
        </SectionCard>
      )}
      {!live && (transaction.kind === "income" || transaction.kind === "refund") && (
        <SectionCard id="classificacao-recebimento" title="Classificação e tags">
          <ReceiptEditor id={transaction.id} annotation={annotations[transaction.id]} />
        </SectionCard>
      )}
    </>
  );
}
