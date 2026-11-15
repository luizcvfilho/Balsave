import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import type { FinancialData } from "../../data/financial-data";
import { FinancialReportsProvider } from "../../data/financial-reports";
import {
  mockAccounts, mockAsOf, mockBalanceSnapshots, mockCards, mockSpendingMonths, mockTransactions,
} from "../../data/mock-data";
import { hasPreviewSession, previewPassword, previewRequest } from "../../data/preview-session";
import { SectionCard } from "../cards/section-card";
import { ConnectButton } from "./connect-button";

const mockData = {
  asOf: mockAsOf,
  accounts: mockAccounts,
  cards: mockCards,
  transactions: mockTransactions,
  balanceSnapshots: mockBalanceSnapshots,
  spendingMonths: mockSpendingMonths,
  connectionCount: 0,
  failedConnections: 0,
} satisfies FinancialData;

export async function FinancialPage({ children }: { children: ReactNode }) {
  await connection();
  if (!previewPassword()) {
    return <FinancialReportsProvider data={mockData} live={false}>{children}</FinancialReportsProvider>;
  }
  if (!await hasPreviewSession()) redirect("/acesso");

  const response = await previewRequest("snapshot");
  if (response?.ok) {
    const result: { connected: false } | { connected: true; data: FinancialData } = await response.json();
    if (!result.connected) {
      return (
        <main className="report-layout">
          <SectionCard id="conectar-bancos" title="Conecte seus bancos">
            <ConnectButton />
          </SectionCard>
        </main>
      );
    }
    if (result.data.failedConnections < result.data.connectionCount) {
      return <FinancialReportsProvider data={result.data} live>{children}</FinancialReportsProvider>;
    }
  }

  return (
    <main className="report-layout">
      <SectionCard id="dados-indisponiveis" title="Dados temporariamente indisponíveis">
        <p className="report-muted">Verifique a conexão com o Meu Pluggy e recarregue a página.</p>
        <Link className="report-link report-action" href="/conexoes">Gerenciar conexões</Link>
      </SectionCard>
    </main>
  );
}
