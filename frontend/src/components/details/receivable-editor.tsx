"use client";

import { useState, useTransition } from "react";
import type { Transaction } from "../../lib/finance";
import { formatDate, formatMoney, parseAmount } from "../../lib/format";
import { useSessionViewKey } from "../layout/session-view-provider";
import { saveReceivableLink, saveReceivablePlan } from "../preview/receivable-actions";

type Expectation = { id: string; name: string; amountCents: number };
type Draft = { id: string; name: string; amount: string };

function amountText(cents: number) {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}

export function eligibleTransaction(transaction: Transaction) {
  return transaction.receivableEligible === true;
}

export function ReceivablePlanEditor({ expense, expectations }: { expense: Transaction; expectations: readonly Expectation[] }) {
  const viewKey = useSessionViewKey();
  const [open, setOpen] = useState(false);
  const [includeSelf, setIncludeSelf] = useState(true);
  const [draft, setDraft] = useState<Draft[]>(() => expectations.map(item => ({ ...item, amount: amountText(item.amountCents) })));
  const [notice, setNotice] = useState<{ message: string; error?: boolean }>();
  const [pending, startTransition] = useTransition();

  function save() {
    const values = draft.map(item => ({ id: item.id, name: item.name.trim(), amountCents: parseAmount(item.amount) }));
    if (values.some(item => !item.name || item.amountCents === undefined || item.amountCents <= 0)) {
      setNotice({ error: true, message: "Informe um nome e um valor maior que zero para cada pessoa." });
      return;
    }
    const valid = values as Expectation[];
    if (valid.reduce((sum, item) => sum + item.amountCents, 0) > expense.amountCents) {
      setNotice({ error: true, message: "A soma dos valores a receber não pode superar a despesa." });
      return;
    }
    startTransition(async () => {
      const result = await saveReceivablePlan(viewKey, { expenseId: expense.id, expectations: valid });
      setNotice(result.ok ? { message: "Valores a receber salvos." } : { error: true, message: result.message });
      if (result.ok) setOpen(false);
    });
  }

  function splitEqually() {
    const divisor = draft.length + (includeSelf ? 1 : 0);
    const share = Math.floor(expense.amountCents / divisor);
    const remainder = expense.amountCents % divisor;
    setDraft(draft.map((item, index) => ({ ...item, amount: amountText(share + (index < remainder ? 1 : 0)) })));
  }

  return <div>
    <button className="report-button" type="button" onClick={() => setOpen(!open)} aria-expanded={open}>Definir valores a receber</button>
    {open && <form action={save}>
      <p className="report-muted">Informe quem deve pagar e quanto. A diferença permanece como sua parte.</p>
      {draft.map((item, index) => <div className="report-filters" key={item.id}>
        <label className="report-field"><span>Nome {index + 1}</span><input value={item.name} maxLength={80} required disabled={pending} onChange={event => setDraft(draft.map(row => row.id === item.id ? { ...row, name: event.target.value } : row))} /></label>
        <label className="report-field"><span>Valor a receber (R$)</span><input value={item.amount} inputMode="decimal" required disabled={pending} onChange={event => setDraft(draft.map(row => row.id === item.id ? { ...row, amount: event.target.value } : row))} /></label>
        <button className="report-button" type="button" disabled={pending} onClick={() => setDraft(draft.filter(row => row.id !== item.id))}>Remover pessoa</button>
      </div>)}
      <p className="report-muted">Sua parte: {formatMoney(Math.max(0, expense.amountCents - draft.reduce((sum, item) => sum + (parseAmount(item.amount) ?? 0), 0)))}</p>
      <label className="report-choice"><input type="checkbox" checked={includeSelf} disabled={pending} onChange={event => setIncludeSelf(event.target.checked)} /> <span>Incluir minha parte na divisão</span></label>
      <div className="report-group">
        <button className="report-button" type="button" disabled={pending} onClick={() => setDraft([...draft, { id: crypto.randomUUID(), name: "", amount: "" }])}>Adicionar pessoa</button>
        <button className="report-button" type="button" disabled={pending || !draft.length} onClick={splitEqually}>Dividir igualmente</button>
        <button className="report-button" type="submit" disabled={pending}>Salvar valores</button>
      </div>
    </form>}
    <p className="report-muted" role={notice?.error ? "alert" : "status"}>{notice?.message}</p>
  </div>;
}

type LinkDraft = { expenseId: string; creditId: string; expectationId: string | null; amountCents: number };
export function ReceivableLinkEditor({ expenses, credits, expectationsByExpense, initial, previousExpenseId, onSaved }: {
  expenses: readonly Transaction[];
  credits: readonly Transaction[];
  expectationsByExpense: ReadonlyMap<string, readonly Expectation[]>;
  initial?: LinkDraft;
  previousExpenseId?: string;
  onSaved?: () => void;
}) {
  const viewKey = useSessionViewKey();
  const [expenseId, setExpenseId] = useState(initial?.expenseId ?? (expenses.length === 1 ? expenses[0].id : ""));
  const [creditId, setCreditId] = useState(initial?.creditId ?? (credits.length === 1 ? credits[0].id : ""));
  const [expectationId, setExpectationId] = useState(initial?.expectationId ?? "");
  const [amount, setAmount] = useState(initial ? amountText(initial.amountCents) : credits.length === 1 ? amountText(credits[0].amountCents) : "");
  const [notice, setNotice] = useState<{ message: string; error?: boolean }>();
  const [pending, startTransition] = useTransition();
  const credit = credits.find(item => item.id === creditId);
  const expense = expenses.find(item => item.id === expenseId);
  const expectations = expectationsByExpense.get(expenseId) ?? [];

  function save(remove = false) {
    const cents = remove ? 0 : parseAmount(amount);
    const targetExpenseId = remove && initial ? initial.expenseId : expenseId;
    const targetCreditId = remove && initial ? initial.creditId : creditId;
    if (!targetExpenseId || !targetCreditId || cents === undefined || (!remove && (cents <= 0 || !expense || !credit || cents > credit.amountCents))) {
      setNotice({ error: true, message: "Selecione a despesa e o crédito e informe uma parcela válida do crédito." });
      return;
    }
    startTransition(async () => {
      const result = await saveReceivableLink(viewKey, { expenseId: targetExpenseId, creditId: targetCreditId, expectationId: remove ? null : expectationId || null, amountCents: cents, ...(!remove && previousExpenseId && previousExpenseId !== targetExpenseId ? { previousExpenseId } : {}) });
      setNotice(result.ok ? { message: remove ? "Vínculo removido." : "Vínculo salvo." } : { error: true, message: result.message });
      if (result.ok) onSaved?.();
    });
  }

  const noticeText = <p className="report-muted" role={notice?.error ? "alert" : "status"}>{notice?.message}</p>;
  if (!expenses.length || !credits.length) {
    return initial ? <div>
      <button className="report-button" type="button" disabled={pending} onClick={() => save(true)}>Remover vínculo</button>
      {noticeText}
    </div> : <p className="report-muted">Nenhum lançamento disponível para vincular.</p>;
  }

  return <form action={() => save()}>
    <div className="report-filters">
      <label className="report-field"><span>Despesa</span><select value={expenseId} disabled={pending || (expenses.length === 1 && (!initial || expenses[0].id === initial.expenseId))} onChange={event => { setExpenseId(event.target.value); setExpectationId(""); }}><option value="">Selecione uma despesa</option>{initial && !expenses.some(item => item.id === initial.expenseId) && <option value={initial.expenseId}>Despesa indisponível</option>}{expenses.map(item => <option value={item.id} key={item.id}>{item.name} · {formatDate(item.date)} · {formatMoney(item.amountCents)}</option>)}</select></label>
      <label className="report-field"><span>Crédito recebido</span><select value={creditId} disabled={pending || credits.length === 1} onChange={event => { const selected = credits.find(item => item.id === event.target.value); setCreditId(event.target.value); setAmount(selected ? amountText(selected.amountCents) : ""); }}><option value="">Selecione um crédito</option>{initial && !credits.some(item => item.id === initial.creditId) && <option value={initial.creditId}>Crédito indisponível</option>}{credits.map(item => <option value={item.id} key={item.id}>{item.name} · {formatDate(item.date)} · {formatMoney(item.amountCents)}</option>)}</select></label>
      <label className="report-field"><span>Pessoa (opcional)</span><select value={expectationId} disabled={pending} onChange={event => setExpectationId(event.target.value)}><option value="">Vincular diretamente à despesa</option>{expectations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="report-field"><span>Parcela deste crédito (R$)</span><input value={amount} inputMode="decimal" required disabled={pending} onChange={event => setAmount(event.target.value)} /></label>
      <button className="report-button" type="submit" disabled={pending}>Salvar vínculo</button>
      {initial && <button className="report-button" type="button" disabled={pending} onClick={() => save(true)}>Remover vínculo</button>}
    </div>
    {noticeText}
  </form>;
}
