import { useFinancialReports } from "../../data/financial-reports";
import type { TransactionTag } from "../../lib/finance";
import { ReportMultiSelect } from "./report-filters";

export function useTagFilter(params: URLSearchParams) {
  const { tags, live } = useFinancialReports();
  const requested = new Set(params.get("etiquetas")?.split(","));
  const selected = new Set(live ? tags.filter(tag => requested.has(tag.id)).map(tag => tag.id) : []);
  return { tags: live ? tags : [], selected, query: [...selected].join(",") || undefined };
}

export function TagFilter({ tags, selected, update }: {
  tags: readonly TransactionTag[];
  selected: ReadonlySet<string>;
  update: (values: Record<string, string | undefined>) => void;
}) {
  if (tags.length === 0) return null;

  return (
    <ReportMultiSelect
      label="Filtrar por etiquetas"
      placeholder="Todas as etiquetas"
      selectionLabel="Etiquetas"
      clearLabel="Limpar etiquetas"
      description="Mostra lançamentos com pelo menos uma das etiquetas selecionadas."
      options={tags.map(tag => ({ value: tag.id, label: tag.name }))}
      selected={selected}
      onChange={values => update({ etiquetas: values.join(",") || undefined })}
    />
  );
}
