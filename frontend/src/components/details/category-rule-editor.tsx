"use client";

import { useId, useState, useTransition } from "react";
import type { CategoryAccountOption, CategoryRule, LocalCategory } from "../../data/financial-data";
import { useSessionViewKey } from "../layout/session-view-provider";
import { type CategoryRuleDraft, type CategoryRulePreview, previewCategoryRule, saveCategoryRule } from "../preview/category-actions";

export const ruleMatchLabels = {
  exact: "É igual a",
  contains: "Contém",
  starts_with: "Começa com",
  ends_with: "Termina com",
};

export function CategoryRuleEditor({ categories, accounts, live, initial, onSaved, onCancel }: {
  categories: LocalCategory[];
  accounts: CategoryAccountOption[];
  live: boolean;
  initial?: Partial<CategoryRuleDraft>;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const viewKey = useSessionViewKey();
  const helpId = useId();
  const [draft, setDraft] = useState<CategoryRuleDraft>({
    categoryId: initial?.categoryId ?? "", description: initial?.description ?? "", matchType: initial?.matchType ?? "exact",
    accountId: initial?.accountId ?? null, priority: initial?.priority ?? 100, applyToHistory: initial?.applyToHistory ?? false,
    enabled: initial?.enabled ?? true, ...(initial?.ruleId && { ruleId: initial.ruleId }),
  });
  const [preview, setPreview] = useState<CategoryRulePreview>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const activeCategories = categories.filter(category => !category.archived);
  const valid = activeCategories.some(category => category.id === draft.categoryId) && draft.description.trim().length > 0
    && Number.isInteger(draft.priority) && draft.priority >= 1 && draft.priority <= 1000;
  const accountOptions = draft.accountId && !accounts.some(account => account.id === draft.accountId)
    ? [...accounts, { id: draft.accountId, label: "Conta ou cartão selecionado" }] : accounts;

  function change(values: Partial<CategoryRuleDraft>) {
    setDraft(current => ({ ...current, ...values }));
    setPreview(undefined);
    setMessage("");
  }

  return <form action={() => startTransition(async () => {
    const result = await previewCategoryRule(viewKey, draft);
    setError(!result.ok);
    setMessage(result.ok ? "Prévia atualizada. Confira o alcance antes de salvar." : result.message);
    setPreview(result.ok ? result.preview : undefined);
  })}>
    <div className="report-filters">
      <label className="report-field">
        <span>Categoria da regra</span>
        <select value={draft.categoryId} required disabled={!live || pending} onChange={event => change({ categoryId: event.target.value })}>
          <option value="">Selecione uma categoria</option>
          {activeCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      <label className="report-field">
        <span>Descrição da compra</span>
        <select value={draft.matchType} disabled={!live || pending} onChange={event => change({ matchType: event.target.value as CategoryRule["matchType"] })}>
          {Object.entries(ruleMatchLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="report-field report-search">
        <span>Texto para identificar a compra</span>
        <input value={draft.description} required maxLength={200} disabled={!live || pending} onChange={event => change({ description: event.target.value })} />
      </label>
    </div>
    <div className="report-filters">
      <label className="report-field">
        <span>Conta ou cartão da regra</span>
        <select value={draft.accountId ?? ""} disabled={!live || pending} onChange={event => change({ accountId: event.target.value || null })}>
          <option value="">Todas as contas e cartões</option>
          {accountOptions.map(account => <option key={account.id} value={account.id}>{account.label}</option>)}
        </select>
      </label>
      <label className="report-field">
        <span>Prioridade da regra</span>
        <input type="number" min={1} max={1000} step={1} required value={draft.priority} disabled={!live || pending}
          aria-describedby={helpId} onChange={event => change({ priority: Number(event.target.value) })} />
      </label>
      <label className="report-field">
        <span>Aplicar a compras de</span>
        <select value={draft.applyToHistory ? "history" : "today"} disabled={!live || pending} onChange={event => change({ applyToHistory: event.target.value === "history" })}>
          <option value="today">Compras a partir de hoje</option>
          <option value="history">Todo o histórico disponível</option>
        </select>
      </label>
    </div>
    <p className="report-muted" id={helpId}>O menor número tem prioridade. Escolhas manuais sempre prevalecem. A comparação do texto ignora maiúsculas e minúsculas.</p>
    {draft.ruleId && <p className="report-muted">Alterar os critérios ou o período pode mudar categorias de compras anteriores. A opção “Compras a partir de hoje” inicia o novo alcance na data de hoje.</p>}
    {draft.applyToHistory && <p className="report-muted">Ao salvar, a regra também será aplicada às compras anteriores disponíveis. Confira a quantidade na prévia.</p>}
    <div className="report-filters">
      <button className="report-button" type="submit" disabled={!live || pending || !valid}>Revisar compras afetadas</button>
      <button className="report-button" type="button" disabled={!live || pending || !valid || !preview} onClick={() => {
        if (!preview) return;
        startTransition(async () => {
          const result = await saveCategoryRule(viewKey, { ...draft, previewFingerprint: preview.fingerprint });
          setError(!result.ok);
          setMessage(result.ok ? "Regra salva." : result.message);
          setPreview(undefined);
          if (result.ok) onSaved?.();
        });
      }}>{draft.ruleId ? "Salvar regra" : "Criar regra"}</button>
      {onCancel && <button className="report-button" type="button" disabled={pending} onClick={onCancel}>Cancelar</button>}
    </div>
    {preview && <div className="report-rule-preview" role="status">
      <p>{preview.affectedCount} {preview.affectedCount === 1 ? "compra será reclassificada" : "compras serão reclassificadas"} entre os lançamentos disponíveis.</p>
      <p>{preview.manualCount} {preview.manualCount === 1 ? "escolha manual será preservada" : "escolhas manuais serão preservadas"}.</p>
      {preview.affectedCount === 0 && <p>A regra poderá classificar novas compras que atendam aos critérios.</p>}
    </div>}
    <p className="report-muted" role={error ? "alert" : "status"}>{message}</p>
  </form>;
}
