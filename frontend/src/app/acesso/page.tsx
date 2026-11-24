import Container from "@mui/material/Container";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SectionCard } from "../../components/cards/section-card";
import { authEnabled, sessionView } from "../../data/session";
import { AccessForm } from "./access-form";

export default async function Page({ searchParams }: { searchParams: Promise<{ modo?: string | string[] }> }) {
  await connection();
  const configured = authEnabled();
  if ((await sessionView()).status === "active") redirect("/");
  const registering = configured && (await searchParams).modo === "cadastro";
  return (
    <Container component="main" maxWidth="xs" className="report-layout">
      <SectionCard id="acesso" title={registering ? "Criar conta" : "Acesse sua conta"}>
        {configured ? <AccessForm key={registering ? "register" : "login"} registering={registering} /> : (
          <>
            <p className="report-muted">O login ainda não está habilitado nesta instalação.</p>
            <Link className="report-link report-action" href="/">Voltar à demonstração</Link>
          </>
        )}
      </SectionCard>
    </Container>
  );
}
