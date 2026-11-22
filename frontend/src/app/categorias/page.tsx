import Container from "@mui/material/Container";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SectionCard } from "../../components/cards/section-card";
import type { CategoryAccountOption, CategoryRule, LocalCategory } from "../../data/financial-data";
import { mockTransactions } from "../../data/mock-data";
import { hasPreviewSession, previewPassword, previewRequest } from "../../data/preview-session";
import { categoryKeyForLabel, transactionCategory } from "../../lib/finance";
import { CategoriesPage } from "../../ui/pages/categories-page";

export default async function Page() {
  await connection();
  if (!previewPassword()) {
    const names = [...new Set(mockTransactions.filter(transaction => transaction.kind === "expense").map(transactionCategory))];
    const categories = names.filter(name => name !== "Sem categoria").map(name => ({
      id: `demo:${categoryKeyForLabel(name)}`, code: categoryKeyForLabel(name), name, archived: false,
    }));
    return <CategoriesPage categories={categories} rules={[]} accounts={[]} live={false} />;
  }
  if (!await hasPreviewSession()) redirect("/acesso");
  const response = await previewRequest("categories");
  if (!response?.ok) return <Container component="main" maxWidth="lg" className="report-layout">
    <Link href="/" className="report-link report-back">← Voltar ao painel</Link>
    <SectionCard id="categorias-indisponiveis" title="Categorias indisponíveis">
      <p className="report-muted" role="alert">Não foi possível carregar suas categorias. Recarregue a página e tente novamente.</p>
    </SectionCard>
  </Container>;
  const data: { categories: LocalCategory[]; categoryRules: CategoryRule[]; categoryAccounts: CategoryAccountOption[] } = await response.json();
  return <CategoriesPage categories={data.categories} rules={data.categoryRules} accounts={data.categoryAccounts} live />;
}
