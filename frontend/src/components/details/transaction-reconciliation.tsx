"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ReconciliationCandidate } from "../../data/financial-data";
import { useFinancialReports } from "../../data/financial-reports";
import { isIncoming, type Transaction } from "../../lib/finance";
import { formatNumericDate, formatSignedMoney } from "../../lib/format";
import { useSessionViewKey } from "../layout/session-view-provider";
import { saveReconciliation } from "../preview/actions";

export function TransactionReconciliation({ transaction }: { transaction: Transaction }) {
  const { live, reconciliationCandidates = [], reportedTransactions, transactionSource } = useFinancialReports();
  const viewKey = useSessionViewKey();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"confirmed" | "removed" | "error">();
  if (!live) return null;

  const confirmed = transaction.reconciliation === "confirmed";
  const counterpart = confirmed && reportedTransactions.find(entry => entry.id === transaction.counterpartId);
  const suggestions = transaction.reconciliation ? [] : reconciliationCandidates
    .filter(candidate => candidate.entryId === transaction.id || candidate.counterpartId === transaction.id)
    .map(candidate => ({
      candidate,
      other: reportedTransactions.find(entry => entry.id === (candidate.entryId === transaction.id ? candidate.counterpartId : candidate.entryId)),
    }))
    .filter(({ candidate, other }) => candidate.counterpartId === null || other);

  function save(candidate: ReconciliationCandidate, remove = false) {
    startTransition(async () => {
      setStatus(undefined);
      const saved = await saveReconciliation(viewKey, { ...candidate, remove });
      setStatus(saved ? (remove ? "removed" : "confirmed") : "error");
      if (saved) router.refresh();
    });
  }

  return (
    <>
      {(confirmed || suggestions.length > 0) && <details className="report-reconciliation">
        <summary>{confirmed ? "Movimentação confirmada" : "Revisar movimentação"}</summary>
        {confirmed ? (
          <>
            {counterpart && <Counterpart entry={counterpart} source={transactionSource(counterpart)} />}
            {!transaction.counterpartId && <p className="report-muted">Incluída no saldo da conta.</p>}
            <button className="report-button" type="button" disabled={pending} onClick={() => save({
              entryId: transaction.id, counterpartId: transaction.counterpartId ?? null,
            }, true)}>Desfazer confirmação</button>
          </>
        ) : (
          // biome-ignore lint/a11y/noRedundantRoles: Safari can omit the list role when markers are hidden.
          <ul className="report-list" role="list">
            {suggestions.map(({ candidate, other }) => (
              <li className="report-list-item" key={`${candidate.entryId}:${candidate.counterpartId ?? ""}`}>
                {other ? <Counterpart entry={other} source={transactionSource(other)} /> : (
                  <p className="report-muted">Confirme se esta movimentação faz parte da aplicação automática já incluída no saldo da conta.</p>
                )}
                <button className="report-button" type="button" disabled={pending} onClick={() => save(candidate)}>
                  {other ? "Confirmar transferência interna" : "Confirmar movimentação já incluída no saldo"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </details>}
      {status === "confirmed" && <p className="report-muted" role="status">Movimentação confirmada.</p>}
      {status === "removed" && <p className="report-muted" role="status">Confirmação desfeita.</p>}
      {status === "error" && <p className="report-muted" role="alert">Não foi possível salvar a alteração. Atualize a página e tente novamente.</p>}
    </>
  );
}

function Counterpart({ entry, source }: { entry: Transaction; source?: string }) {
  const amount = isIncoming(entry) ? entry.amountCents : -entry.amountCents;
  return (
    <>
      <div className="report-group"><strong>{entry.name}</strong><span>{formatSignedMoney(amount)}</span></div>
      <p className="report-muted">{[source, formatNumericDate(entry.date)].filter(Boolean).join(" · ")}</p>
    </>
  );
}
