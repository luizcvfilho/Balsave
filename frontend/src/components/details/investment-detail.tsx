"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ReportInvestment } from "../../data/financial-data";
import { useFinancialReports } from "../../data/financial-reports";
import { formatAvailableMoney, formatNumericDate } from "../../lib/format";
import { SectionCard } from "../cards/section-card";
import { useSessionViewKey } from "../layout/session-view-provider";
import { saveInvestmentPosition } from "../preview/actions";
import { ReportMetrics } from "./report-metrics";

export function InvestmentDetail({ investment }: { investment: ReportInvestment }) {
  const { accounts, live } = useFinancialReports();
  const viewKey = useSessionViewKey();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<string>();
  const [status, setStatus] = useState<"saved" | "error">();
  const savedAccount = investment.includedInAccountId ?? "";
  const accountId = draft ?? savedAccount;

  return (
    <SectionCard id="detalhe-investimento" className="report-narrow" title="Saldo do investimento"
      description={`${investment.bank} · Posição em ${formatNumericDate(investment.asOf)}`}>
      <ReportMetrics items={[{ label: "Saldo", value: formatAvailableMoney(investment.balanceCents) }]} />
      {live && <form className="report-filters report-heading-filters" action={() => startTransition(async () => {
        const saved = await saveInvestmentPosition(viewKey, { investmentId: investment.id, accountId: accountId || null });
        setStatus(saved ? "saved" : "error");
        if (saved) {
          router.refresh();
          setDraft(undefined);
        }
      })}>
        <label className="report-field">
          <span>Este investimento já está incluído no saldo de uma conta?</span>
          <select value={accountId} disabled={pending} onChange={event => {
            setDraft(event.target.value);
            setStatus(undefined);
          }}>
            <option value="">Posição separada</option>
            {accounts.map(account => <option value={account.id} key={account.id}>Incluído em {account.bank} · {account.name}</option>)}
          </select>
        </label>
        <button className="report-button" type="submit" disabled={pending || accountId === savedAccount}>Salvar composição</button>
      </form>}
      {status === "saved" && <p className="report-muted" role="status">Composição salva.</p>}
      {status === "error" && <p className="report-muted" role="alert">Não foi possível salvar a composição. Tente novamente.</p>}
    </SectionCard>
  );
}
