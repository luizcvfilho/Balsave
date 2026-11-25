"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useFinancialReports } from "../../data/financial-reports";
import { cardLabel } from "../../data/financial-data";
import type { Expense } from "../../lib/finance";
import { transactionCategory } from "../../lib/finance";
import { CategoryRuleEditor } from "./category-rule-editor";
import { SectionCard } from "../cards/section-card";
import { useSessionViewKey } from "../layout/session-view-provider";
import { createCategory, saveTransactionCategory } from "../preview/category-actions";

const sourceLabels = {
  manual: "Classificada por você",
  rule: "Classificada por uma regra pessoal",
  pluggy: "Classificada automaticamente pelo Pluggy",
  unclassified: "Aguardando classificação",
};

export function CategoryEditor({ transaction }: { transaction: Expense }) {
  const viewKey = useSessionViewKey();
  const { categories = [], live, accounts, cards } = useFinancialReports();
  const [draftCategory, setDraftCategory] = useState<string>();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [creatingRule, setCreatingRule] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const selected = draftCategory ?? transaction.categoryId ?? "";
  const selectedCategory = categories.find(category => category.id === selected);
  const options = categories.filter(category => !category.archived || category.id === selected)
    .filter(category => category.id === selected || category.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")));

  function save(categoryId: string | null) {
    startTransition(async () => {
      const result = await saveTransactionCategory(viewKey, { entryId: transaction.id, categoryId });
      setError(!result.ok);
      setMessage(result.ok ? categoryId === null ? "Classificação automática restaurada." : "Categoria salva." : result.message);
      if (result.ok) setDraftCategory(undefined);
    });
  }

  return (
    <SectionCard id="categoria-compra" title="Categoria da compra" description="Sua escolha vale para este lançamento e permanece nas próximas atualizações.">
      <p className="report-muted">{sourceLabels[transaction.categorySource ?? "unclassified"]} · {transactionCategory(transaction)}</p>
      {transaction.providerCategoryLabel && <p className="report-muted">Categoria de origem: {transaction.providerCategoryLabel}.</p>}
      {transaction.categoryNeedsReview && <p className="report-muted">A categoria recebida precisa de revisão. Você pode escolher uma categoria abaixo.</p>}
      {!live && <p className="report-muted">A edição de categorias está disponível ao acessar seus dados. Os dados fictícios são apenas para consulta.</p>}
      <form action={() => save(selected)}>
        <div className="report-filters">
          <label className="report-field report-search">
            <span>Buscar categoria</span>
            <input value={search} maxLength={80} disabled={!live || pending} onChange={event => setSearch(event.target.value)} />
          </label>
          <label className="report-field">
            <span>Nova categoria da compra</span>
            <select value={selected} disabled={!live || pending} onChange={event => { setDraftCategory(event.target.value); setMessage(""); }}>
              <option value="">Selecione uma categoria</option>
              {options.map(category => <option key={category.id} value={category.id} disabled={category.archived}>
                {category.name}{category.archived ? " (arquivada)" : ""}
              </option>)}
            </select>
          </label>
          <button className="report-button" type="submit" disabled={!live || pending || !selectedCategory || selectedCategory.archived}>
            Salvar categoria
          </button>
        </div>
      </form>
      <div className="report-filters">
        <button className="report-button" type="button" disabled={!live || pending} onClick={() => setCreating(!creating)} aria-expanded={creating}>
          Criar categoria
        </button>
        {transaction.categorySource === "manual" && <button className="report-button" type="button" disabled={!live || pending} onClick={() => save(null)}>
          Restaurar classificação automática
        </button>}
        <Link href="/classificacoes" className="report-link report-action">Gerenciar categorias</Link>
      </div>
      {creating && <form action={() => startTransition(async () => {
        const result = await createCategory(viewKey, { name });
        setError(!result.ok);
        if (result.ok) {
          setDraftCategory(result.category.id);
          setName("");
          setCreating(false);
          setMessage("Categoria criada. Salve para aplicar à compra.");
        } else setMessage(result.message);
      })}>
        <div className="report-filters">
          <label className="report-field">
            <span>Nome da nova categoria</span>
            <input value={name} maxLength={80} required disabled={pending} onChange={event => setName(event.target.value)} />
          </label>
          <button className="report-button" type="submit" disabled={pending || !name.trim()}>Criar nova categoria</button>
        </div>
      </form>}
      <p className="report-muted" role={error ? "alert" : "status"}>{message}</p>
      <button className="report-button" type="button" disabled={!live || pending || !selectedCategory || selectedCategory.archived}
        onClick={() => setCreatingRule(!creatingRule)} aria-expanded={creatingRule}>Usar esta categoria em compras semelhantes</button>
      {creatingRule && <CategoryRuleEditor key={selected} categories={categories} live={live}
        accounts={[
          ...accounts.map(account => ({ id: account.id, label: `${account.bank} · ${account.name}` })),
          ...cards.map(card => ({ id: card.id, label: cardLabel(card) })),
        ]} initial={{ categoryId: selected, description: transaction.name, accountId: transaction.accountId ?? transaction.cardId ?? null }}
        onSaved={() => { setCreatingRule(false); setError(false); setMessage("Regra criada. Suas escolhas manuais foram preservadas."); }}
        onCancel={() => setCreatingRule(false)} />}
    </SectionCard>
  );
}
