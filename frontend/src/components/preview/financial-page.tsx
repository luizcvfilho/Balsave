import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import type { FinancialData } from "../../data/financial-data";
import { FinancialReportsProvider } from "../../data/financial-reports";
import {
  mockAccounts, mockAsOf, mockBalanceSnapshots, mockCards, mockSpendingMonths, mockTransactions,
} from "../../data/mock-data";
import { authEnabled, financialRequest, sessionView } from "../../data/session";
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

export async function FinancialPage({ children, showDemoWhenSignedOut = false, showSavedReceivablesWhenUnavailable = false }: {
  children: ReactNode;
  showDemoWhenSignedOut?: boolean;
  showSavedReceivablesWhenUnavailable?: boolean;
}) {
  await connection();
  if (!authEnabled() || (showDemoWhenSignedOut && (await sessionView()).status === "anonymous")) {
    return <FinancialReportsProvider data={mockData} live={false}>{children}</FinancialReportsProvider>;
  }

  const response = await financialRequest("snapshot");
  if (response?.ok) {
    const result: { connected: false } | { connected: true; data: FinancialData } = await response.json();
    const hasSavedReceivables = result.connected && showSavedReceivablesWhenUnavailable && Boolean(result.data.receivableGroups?.length);
    if (!result.connected || (!result.data.connectionCount && !hasSavedReceivables)) {
      return (
        <main className="balsave-shell report-layout">
          <SectionCard id="conectar-bancos" title="Conecte seus bancos">
            <ConnectButton />
          </SectionCard>
          <nav className="report-navigation" aria-label="Configurações dos relatórios">
            <Link href="/conexoes">Conexões</Link>
          </nav>
        </main>
      );
    }
    if (result.data.failedConnections < result.data.connectionCount || hasSavedReceivables) {
      return <FinancialReportsProvider data={result.data} live>{children}</FinancialReportsProvider>;
    }
  }

  return (
    <main className="balsave-shell report-layout">
      <SectionCard id="dados-indisponiveis" title="Dados temporariamente indisponíveis">
        <p className="report-muted">Verifique a conexão com o Meu Pluggy e recarregue a página.</p>
        <Link className="report-link report-action" href="/conexoes">Gerenciar conexões</Link>
      </SectionCard>
    </main>
  );
}
