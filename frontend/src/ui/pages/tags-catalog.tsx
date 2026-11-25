import { SectionCard } from "../../components/cards/section-card";
import { mockTransactions } from "../../data/mock-data";
import { financialRequest, sessionView } from "../../data/session";
import type { TransactionTag } from "../../lib/finance";
import { TagsPage } from "./tags-page";

export async function TagsCatalog() {
  if ((await sessionView()).status === "anonymous") {
    const usage = new Map<string, number>();
    for (const transaction of mockTransactions) {
      for (const name of new Set(transaction.tags)) usage.set(name, (usage.get(name) ?? 0) + 1);
    }
    const tags = [...usage.keys()].map(name => ({ id: name, name }));
    return <TagsPage tags={tags} usageByTag={Object.fromEntries(usage)} live={false} />;
  }
  const response = await financialRequest("tags");
  if (!response?.ok) return <SectionCard id="etiquetas-indisponiveis" title="Etiquetas indisponíveis">
    <p className="report-muted" role="alert">Não foi possível carregar suas etiquetas. Recarregue a página e tente novamente.</p>
  </SectionCard>;
  const data: { tags: TransactionTag[]; usageByTag: Record<string, number> } = await response.json();
  return <TagsPage tags={data.tags} usageByTag={data.usageByTag} live />;
}
