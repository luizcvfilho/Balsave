import { useFinancialReports } from "../../data/financial-reports";
import type { TransactionTag } from "../../lib/finance";

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
    <details className="report-tag-filter">
      <summary>Filtrar por etiquetas{selected.size > 0 && ` (${selected.size})`}</summary>
      <fieldset>
        <legend>Lançamentos com pelo menos uma das etiquetas selecionadas</legend>
        {tags.map(tag => (
          <label key={tag.id} className="report-choice report-tag-option">
            <input
              type="checkbox"
              checked={selected.has(tag.id)}
              onChange={event => {
                const next = new Set(selected);
                if (event.target.checked) next.add(tag.id);
                else next.delete(tag.id);
                update({ etiquetas: [...next].join(",") });
              }}
            />
            <span>{tag.name}</span>
          </label>
        ))}
        {selected.size > 0 && (
          <button className="report-link report-action" type="button" onClick={() => update({ etiquetas: undefined })}>
            Limpar etiquetas
          </button>
        )}
      </fieldset>
    </details>
  );
}
