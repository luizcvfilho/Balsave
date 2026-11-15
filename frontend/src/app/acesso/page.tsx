import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SectionCard } from "../../components/cards/section-card";
import { LoginForm } from "../../components/preview/login-form";
import { hasPreviewSession, isLocalPreviewHost, previewPassword } from "../../data/preview-session";

export default async function Page() {
  await connection();
  if (!previewPassword() || await hasPreviewSession()) redirect("/");
  const available = previewPassword().length >= 32 && await isLocalPreviewHost();
  return (
    <main className="report-layout">
      <SectionCard id="acesso" title="Acesse seu painel">
        {available ? <LoginForm /> : <p className="report-muted">Abra o Balsave pelo endereço local para acessar seus dados.</p>}
      </SectionCard>
    </main>
  );
}
