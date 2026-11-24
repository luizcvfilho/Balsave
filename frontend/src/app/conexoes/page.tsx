import Link from "next/link";
import { connection } from "next/server";
import { SectionCard } from "../../components/cards/section-card";
import { ConnectButton } from "../../components/preview/connect-button";
import { authEnabled, sessionView } from "../../data/session";

export default async function Page() {
  await connection();
  const configured = authEnabled();
  const { status } = await sessionView();

  return (
    <main className="report-layout">
      <Link className="report-link report-back" href="/">← Voltar ao painel</Link>
      <SectionCard id="conexoes" title="Conexões bancárias">
        {status === "active" && <ConnectButton />}
        {status === "unavailable" && <p className="report-muted">Não foi possível verificar sua sessão. Recarregue a página e tente novamente.</p>}
        {status === "anonymous" && (configured ? (
          <>
            <p className="report-muted">Acesse sua conta para conectar seus bancos.</p>
            <Link className="report-link report-action" href="/acesso">Acessar minha conta</Link>
          </>
        ) : <p className="report-muted">Ative o acesso por conta na configuração do Balsave para conectar seus bancos.</p>)}
      </SectionCard>
    </main>
  );
}
