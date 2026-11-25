import { SectionCard } from "../../components/cards/section-card";
import type { CategoryAccountOption, CategoryRule, LocalCategory } from "../../data/financial-data";
import { financialRequest, sessionView } from "../../data/session";
import { defaultCategories } from "../../lib/finance";
import { CategoriesPage } from "./categories-page";

export async function CategoriesCatalog() {
  if ((await sessionView()).status === "anonymous") {
    const categories = defaultCategories.map(([code, name]) => ({
      id: `demo:${code}`, code, name, archived: false,
    }));
    return <CategoriesPage categories={categories} rules={[]} accounts={[]} live={false} />;
  }
  const response = await financialRequest("categories");
  if (!response?.ok) return <SectionCard id="categorias-indisponiveis" title="Categorias indisponíveis">
    <p className="report-muted" role="alert">Não foi possível carregar suas categorias. Recarregue a página e tente novamente.</p>
  </SectionCard>;
  const data: { categories: LocalCategory[]; categoryRules: CategoryRule[]; categoryAccounts: CategoryAccountOption[] } = await response.json();
  return <CategoriesPage categories={data.categories} rules={data.categoryRules} accounts={data.categoryAccounts} live />;
}
