"use client";

import Link from "next/link";
import { useState } from "react";
import { useFinancialReports } from "../../data/financial-reports";
import type { Transaction } from "../../lib/finance";
import { formatDate, formatMoney } from "../../lib/format";
import { SectionCard } from "../cards/section-card";
import { ReportMetrics } from "./report-metrics";
import { useReportQuery } from "./report-query";
import { eligibleTransaction, ReceivableLinkEditor, ReceivablePlanEditor } from "./receivable-editor";

type Group = ReturnType<typeof useFinancialReports>["receivables"][number];

function GroupSummary({ group, transactionHref }: { group: Group; transactionHref: (id: string) => string }) {
  return <>
    <ReportMetrics items={[
      ...(group.expense ? [{ label: "Valor original", value: formatMoney(group.grossCents) }] : []),
      { label: "Planejado", value: formatMoney(group.expectations.reduce((sum, item) => sum + item.amountCents, 0)) },
      { label: "Recebido", value: formatMoney(group.receivedCents) },
      { label: "Aplicado", value: formatMoney(group.appliedCents) },
      { label: "Pendente", value: formatMoney(group.pendingCents) },
      { label: "Excedente", value: formatMoney(group.surplusCents) },
    ]} />
    {/* biome-ignore lint/a11y/noRedundantRoles: Safari can omit the list role when markers are hidden. */}
    {group.expectations.length > 0 && <ul className="report-list" role="list">{group.expectations.map(item => <li className="report-list-item" key={item.id}>
      <span className="report-strong">{item.name}</span>
      <p className="report-muted">Planejado: {formatMoney(item.amountCents)} · Recebido: {formatMoney(item.receivedCents)} · Pendente: {formatMoney(item.remainingCents)}</p>
    </li>)}</ul>}
    {/* biome-ignore lint/a11y/noRedundantRoles: Safari can omit the list role when markers are hidden. */}
    {group.receipts.length > 0 && <ul className="report-list" role="list">{group.receipts.map(item => <li className="report-list-item" key={item.creditId}>
      {item.credit ? <Link className="report-link report-action" href={transactionHref(item.creditId)}>{item.credit.name} · {formatDate(item.credit.date)}</Link> : <span>Crédito indisponível</span>}
      <p className="report-muted">Vinculado: {formatMoney(item.amountCents)} · Recebido: {formatMoney(item.eligibleCents)} · Aplicado: {formatMoney(item.appliedCents)} · Excedente: {formatMoney(item.surplusCents)}</p>
      {item.incomplete && <p className="report-muted">Este crédito ou parte do valor vinculado está indisponível. Corrija ou remova o vínculo.</p>}
      {item.coverages.length > 0 && <p className="report-muted">Aplicado a: {item.coverages.map(coverage => `${group.expectations.find(expectation => expectation.id === coverage.expectationId)?.name ?? "Pessoa indisponível"} (${formatMoney(coverage.amountCents)})`).join(" · ")}</p>}
    </li>)}</ul>}
  </>;
}

export function ReceivablesList({ transactionHref }: { transactionHref: (id: string) => string }) {
  const { receivables, reportedTransactions } = useFinancialReports();
  const expectationsByExpense = new Map(receivables.map(group => [group.expenseId, group.expectations]));
  const credits = reportedTransactions.filter(item => (item.kind === "income" || item.kind === "credit") && eligibleTransaction(item));
  return <SectionCard id="valores-a-receber" title="Despesas acompanhadas">
    {/* biome-ignore lint/a11y/noRedundantRoles: Safari can omit the list role when markers are hidden. */}
    {receivables.length ? <ul className="report-list" role="list">{receivables.map(group => <li className="report-list-item" key={group.expenseId}>
      {group.expense ? <Link className="report-link report-action" href={transactionHref(group.expenseId)}>{group.expense.name} · {formatDate(group.expense.date)}</Link> : <span className="report-strong">Despesa indisponível</span>}
      {!group.expense && <p className="report-muted">A despesa salva não está disponível no momento.</p>}
      <GroupSummary group={group} transactionHref={transactionHref} />
      {!group.expense && group.receipts.map(item => <div key={item.creditId}>
        <p className="report-strong">Remover vínculo: {item.credit?.name ?? "crédito indisponível"}</p>
      <ReceivableLinkEditor expenses={[]} credits={credits.filter(credit => credit.id === item.creditId)} expectationsByExpense={expectationsByExpense} initial={{ expenseId: group.expenseId, creditId: item.creditId, expectationId: item.expectationId, amountCents: item.amountCents }} />
      </div>)}
    </li>)}</ul> : <>
      <p className="report-muted">Abra uma despesa importada para definir valores a receber ou vincular um crédito.</p>
      <Link href="/lancamentos" className="report-link report-action">Ver lançamentos</Link>
    </>}
  </SectionCard>;
}

export function ReceivableDetail({ transaction }: { transaction: Transaction }) {
  const { href } = useReportQuery();
  const { receivables, reportedTransactions } = useFinancialReports();
  const [open, setOpen] = useState(false);
  const expenses = reportedTransactions.filter(item => item.kind === "expense" && eligibleTransaction(item));
  const credits = reportedTransactions.filter(item => (item.kind === "income" || item.kind === "credit") && eligibleTransaction(item));
  const expectationsByExpense = new Map(receivables.map(group => [group.expenseId, group.expectations]));
  const expenseGroup = receivables.find(group => group.expenseId === transaction.id);
  const linked = receivables.flatMap(group => group.receipts.filter(item => item.creditId === transaction.id).map(item => ({ group, item })));
  const isExpense = transaction.kind === "expense" && eligibleTransaction(transaction);
  const isCredit = (transaction.kind === "income" || transaction.kind === "credit") && eligibleTransaction(transaction);
  if (!isExpense && !isCredit && linked.length === 0 && !expenseGroup) return null;
  return <SectionCard id="recebimentos-despesa" title={isCredit ? "Vínculo com despesa" : "Valores a receber"}>
    {expenseGroup && <GroupSummary group={expenseGroup} transactionHref={id => href({ lancamento: id })} />}
    {isExpense && <ReceivablePlanEditor expense={transaction} expectations={expenseGroup?.expectations ?? []} />}
    {expenseGroup?.receipts.map(item => <div key={item.creditId}>
      <p className="report-strong">Corrigir vínculo: {item.credit?.name ?? "crédito indisponível"}</p>
      <ReceivableLinkEditor expenses={isExpense ? [transaction] : []} credits={item.credit && eligibleTransaction(item.credit) ? [item.credit] : []} expectationsByExpense={expectationsByExpense} initial={{ expenseId: transaction.id, creditId: item.creditId, expectationId: item.expectationId, amountCents: item.amountCents }} />
    </div>)}
    {isCredit && linked.map(({ group, item }) => <div key={group.expenseId}>
      <p className="report-strong">Vínculo atual: {group.expense?.name ?? "despesa indisponível"}</p>
      <ReceivableLinkEditor expenses={expenses.filter(expense => expense.date <= transaction.date)} credits={[transaction]} expectationsByExpense={expectationsByExpense} previousExpenseId={group.expenseId} initial={{ expenseId: group.expenseId, creditId: transaction.id, expectationId: item.expectationId, amountCents: item.amountCents }} />
    </div>)}
    {(isExpense || (isCredit && linked.length === 0)) && <>
      <button className="report-button" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{isCredit ? "Vincular a uma despesa" : "Vincular crédito recebido"}</button>
      {open && <ReceivableLinkEditor expenses={isExpense ? [transaction] : expenses.filter(expense => expense.date <= transaction.date)} credits={isCredit ? [transaction] : credits.filter(item => item.date >= transaction.date && !receivables.some(group => group.receipts.some(receipt => receipt.creditId === item.id)))} expectationsByExpense={expectationsByExpense} onSaved={() => setOpen(false)} />}
    </>}
  </SectionCard>;
}
