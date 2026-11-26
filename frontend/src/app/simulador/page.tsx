import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PageHeading } from "../../components/details/report-layout";
import type { FinancialData } from "../../data/financial-data";
import { mockAccounts, mockAsOf } from "../../data/mock-data";
import { authEnabled, financialRequest, sessionView } from "../../data/session";
import { PurchaseSimulator } from "./purchase-simulator";
import { simulatorSources } from "./simulator-sources";

const localDate = new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function Page() {
  await connection();
  const status = (await sessionView()).status;
  const demo = !authEnabled();
  if (!demo && status === "anonymous") redirect("/acesso");

  const response = status === "active" ? await financialRequest("snapshot") : undefined;
  const snapshot: { connected: false } | { connected: true; data: FinancialData } | undefined =
    response?.ok ? await response.json() : undefined;
  const sources = demo ? simulatorSources({
    asOf: mockAsOf,
    accounts: mockAccounts,
    failedConnections: 0,
    investments: [{
      id: "demo-fund", name: "Fundo de demonstração", bank: mockAccounts[0].bank,
      balanceCents: 125_000, asOf: mockAsOf, fund: { lastTwelveMonthsRateBps: 875 },
    }],
  }) : snapshot?.connected ? simulatorSources(snapshot.data) : undefined;

  return <main className="balsave-shell report-layout">
    <PageHeading title="Simulador" description="Compare uma compra à vista com o parcelamento." />
    <PurchaseSimulator today={localDate.format(new Date())} sources={sources} demo={demo} />
  </main>;
}
