import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SectionCard } from "../../components/cards/section-card";
import { ConnectButton } from "../../components/preview/connect-button";
import { hasPreviewSession, previewPassword } from "../../data/preview-session";

export default async function Page() {
  await connection();
  const configured = !!previewPassword();
  if (configured && !await hasPreviewSession()) redirect("/acesso");

  return (
    <main className="report-layout">
      <Link className="report-link report-back" href="/">← Voltar ao painel</Link>
      <SectionCard id="conexoes" title="Conexões bancárias">
        {configured ? <ConnectButton /> : (
          <p className="report-muted">Ative o acesso local a dados reais na configuração do Balsave para conectar seus bancos.</p>
        )}
      </SectionCard>
    </main>
  );
}
