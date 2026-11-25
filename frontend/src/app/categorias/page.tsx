import Container from "@mui/material/Container";
import Link from "next/link";
import { connection } from "next/server";
import { SectionCard } from "../../components/cards/section-card";
import type { CategoryAccountOption, CategoryRule, LocalCategory } from "../../data/financial-data";
import { financialRequest, sessionView } from "../../data/session";
import { defaultCategories } from "../../lib/finance";
import { CategoriesPage } from "../../ui/pages/categories-page";

export default async function Page() {
  await connection();
  if ((await sessionView()).status === "anonymous") {
    const categories = defaultCategories.map(([code, name]) => ({
      id: `demo:${code}`, code, name, archived: false,
    }));
    return <CategoriesPage categories={categories} rules={[]} accounts={[]} live={false} />;
  }
  const response = await financialRequest("categories");
  if (!response?.ok) return <Container component="main" maxWidth="lg" className="report-layout">
    <Link href="/" className="report-link report-back">← Voltar ao painel</Link>
    <SectionCard id="categorias-indisponiveis" title="Categorias indisponíveis">
      <p className="report-muted" role="alert">Não foi possível carregar suas categorias. Recarregue a página e tente novamente.</p>
    </SectionCard>
  </Container>;
  const data: { categories: LocalCategory[]; categoryRules: CategoryRule[]; categoryAccounts: CategoryAccountOption[] } = await response.json();
  return <CategoriesPage categories={data.categories} rules={data.categoryRules} accounts={data.categoryAccounts} live />;
}
