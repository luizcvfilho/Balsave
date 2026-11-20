"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFinancialReports } from "../../data/financial-reports";
import { formatAvailableMoney, formatMoney, formatNumericDate, formatSignedMoney } from "../../lib/format";
import { SectionCard } from "../cards/section-card";
import { saveInvestmentPosition, saveReconciliation } from "../preview/actions";

export function Reconciliation() {
  const { accounts, investments, reportedTransactions, reconciliationCandidates = [], transactionSource, live } = useFinancialReports();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [limit, setLimit] = useState(20);
  const entries = new Map(reportedTransactions.map(entry => [entry.id, entry]));
  const candidates = reconciliationCandidates.filter(candidate => entries.has(candidate.entryId));
  const confirmed = reportedTransactions.filter(entry => entry.reconciliation === "confirmed"
    && (!entry.counterpartId || entry.id < entry.counterpartId));

  function save(operation: () => Promise<boolean>) {
    startTransition(async () => {
      setMessage("");
      if (await operation()) {
        setMessage("Alteração salva.");
        router.refresh();
      } else {
        setMessage("Não foi possível salvar. Atualize a página e tente novamente.");
      }
    });
  }

  return <>
    {message && <p className="report-muted" role="status">{message}</p>}
    <SectionCard id="posicoes-investimentos" title="Saldos dos investimentos"
      description="Indique quando o saldo informado da conta já inclui este investimento. Isso evita somar o mesmo dinheiro duas vezes.">
      {investments.length ? <ul className="report-list">
        {investments.map(investment => <li className="report-list-item" key={investment.id}>
          <div className="report-group"><strong>{investment.name}</strong><span>{formatAvailableMoney(investment.balanceCents)}</span></div>
          <p className="report-muted">{investment.bank} · Posição em {formatNumericDate(investment.asOf)}</p>
          <form className="report-filters" action={form => {
            const accountId = String(form.get("accountId") ?? "") || null;
            save(() => saveInvestmentPosition({ investmentId: investment.id, accountId }));
          }}>
            <label className="report-field">
              <span>Composição do saldo de {investment.name}</span>
              <select name="accountId" key={investment.includedInAccountId ?? "separate"} defaultValue={investment.includedInAccountId ?? ""} disabled={pending}>
                <option value="">Posição separada da conta</option>
                {accounts.map(account => <option value={account.id} key={account.id}>Incluído em {account.bank} · {account.name}</option>)}
              </select>
            </label>
            <button className="report-button" disabled={pending || !live} type="submit">Salvar composição</button>
          </form>
        </li>)}
      </ul> : <p className="report-muted">Nenhuma posição de investimento disponível.</p>}
    </SectionCard>
    <SectionCard id="conciliacao" title="Revisar movimentações"
      description="Confirme quando os lançamentos representam o mesmo dinheiro transferido entre suas contas ou investimentos. Valor e proximidade de datas geram sugestões para revisão.">
      <p className="report-muted">{candidates.length} {candidates.length === 1 ? "associação pendente" : "associações pendentes"}</p>
      <ul className="report-list">
        {candidates.slice(0, limit).map(candidate => {
          const first = entries.get(candidate.entryId);
          const second = candidate.counterpartId ? entries.get(candidate.counterpartId) : undefined;
          if (!first) return null;
          return <li className="report-list-item" key={`${candidate.entryId}.${candidate.counterpartId ?? "included"}`}>
            {[first, ...(second ? [second] : [])].map(entry => <div key={entry.id}>
              <div className="report-group"><strong>{entry.name}</strong><span>{formatSignedMoney(entry.balanceImpactCents ?? 0)}</span></div>
              <p className="report-muted">{transactionSource(entry)} · {formatNumericDate(entry.date)}</p>
            </div>)}
            {!second && <p className="report-muted">Confirme apenas se esta movimentação está dentro do investimento automático já incluído no saldo da conta.</p>}
            <button type="button" className="report-button" disabled={pending || !live} onClick={() => save(() => saveReconciliation(candidate))}>
              {second ? "Confirmar transferência interna" : "Confirmar movimentação já incluída no saldo"}
            </button>
          </li>;
        })}
      </ul>
      {candidates.length > limit && <button type="button" className="report-button" onClick={() => setLimit(limit + 20)}>Mostrar mais associações</button>}
    </SectionCard>
    {confirmed.length > 0 && <SectionCard id="associacoes-confirmadas" title="Associações confirmadas">
      <ul className="report-list">{confirmed.slice(0, limit).map(entry => <li className="report-list-item" key={entry.id}>
        <div className="report-group"><strong>{entry.name}</strong><span>{formatMoney(entry.amountCents)}</span></div>
        <p className="report-muted">{transactionSource(entry)} · {formatNumericDate(entry.date)}</p>
        <button type="button" className="report-button" disabled={pending} onClick={() => save(() => saveReconciliation({ entryId: entry.id, counterpartId: entry.counterpartId ?? null, remove: true }))}>
          Desfazer confirmação
        </button>
      </li>)}</ul>
      {confirmed.length > limit && <button type="button" className="report-button" onClick={() => setLimit(limit + 20)}>Mostrar mais confirmações</button>}
    </SectionCard>}
  </>;
}
