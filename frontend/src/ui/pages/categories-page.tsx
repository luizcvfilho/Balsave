"use client";

import { useState, useTransition } from "react";
import { SectionCard } from "../../components/cards/section-card";
import { FinancialFooter } from "../../components/details/report-layout";
import { CategoryRuleEditor, ruleMatchLabels } from "../../components/details/category-rule-editor";
import { CategoryChip } from "../../components/details/transaction-classification";
import { useSessionViewKey } from "../../components/layout/session-view-provider";
import { createCategory, deleteCategory, updateCategory, updateCategoryRule } from "../../components/preview/category-actions";
import type { CategoryAccountOption, CategoryRule, LocalCategory } from "../../data/financial-data";
import { CatalogDialog } from "./catalog-dialog";
import "./catalog.css";

type Editor = { type: "category"; category?: LocalCategory } | { type: "rule"; rule?: CategoryRule };

export function CategoriesPage({ categories, rules, accounts, live }: {
  categories: LocalCategory[]; rules: CategoryRule[]; accounts: CategoryAccountOption[]; live: boolean;
}) {
  const [editor, setEditor] = useState<Editor>();
  const [tab, setTab] = useState<"categories" | "rules">("categories");
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const sorted = categories.filter(category => category.name.toLocaleLowerCase("pt-BR").includes(query)).sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, "pt-BR"));
  const matchingRules = rules.filter(rule => rule.description.toLocaleLowerCase("pt-BR").includes(query)).sort((a, b) => a.priority - b.priority);
  return <div className="catalog-embedded">
    {!live && <p className="report-muted">Os dados fictícios são apenas para consulta. A edição está disponível ao acessar seus dados.</p>}
    <div className="catalog-tabs">
      <button className="report-button" type="button" aria-pressed={tab === "categories"} onClick={() => { setTab("categories"); setSearch(""); }}>Categorias</button>
      <button className="report-button" type="button" aria-pressed={tab === "rules"} onClick={() => { setTab("rules"); setSearch(""); }}>Regras</button>
    </div>
    {tab === "categories" ? <SectionCard id="minhas-categorias" title="Categorias" description="Organize seus lançamentos por categoria. Arquivar preserva as classificações anteriores."
      action={<button className="report-button" type="button" disabled={!live} onClick={() => setEditor({ type: "category" })}>Nova categoria</button>}>
      <label className="report-field catalog-search"><span>Buscar categoria</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
      {/* biome-ignore lint/a11y/noRedundantRoles: Safari can omit list semantics when markers are hidden. */}
      {sorted.length ? <ul role="list" className="catalog-list">{sorted.map(category => <li key={category.id}>
        <button type="button" className="catalog-row" disabled={!live} onClick={() => setEditor({ type: "category", category })}>
          <span className="catalog-row-content"><CategoryChip categoryKey={category.code ?? `custom:${category.id}`} categoryId={category.id} label={category.name} />
            <span className="catalog-row-meta">{category.archived ? "Arquivada" : category.code ? "Categoria inicial" : "Categoria personalizada"}</span></span>
          {live && <span className="catalog-arrow" aria-hidden="true">›</span>}
        </button>
      </li>)}</ul> : <p className="report-muted">{categories.length ? "Nenhuma categoria encontrada." : "Nenhuma categoria disponível."}</p>}
    </SectionCard> : <SectionCard id="minhas-regras" title="Regras pessoais" description="Classifique compras automaticamente. Em caso de empate, a regra criada primeiro prevalece."
      action={<button className="report-button" type="button" disabled={!live} onClick={() => setEditor({ type: "rule" })}>Nova regra</button>}>
      <label className="report-field catalog-search"><span>Buscar regra</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
      {/* biome-ignore lint/a11y/noRedundantRoles: Safari can omit list semantics when markers are hidden. */}
      {matchingRules.length ? <ul role="list" className="catalog-list">{matchingRules.map(rule => {
        const category = categories.find(item => item.id === rule.categoryId);
        return <li key={rule.id}><button type="button" className="catalog-row" disabled={!live} onClick={() => setEditor({ type: "rule", rule })}>
          <span className="catalog-row-content"><strong>{rule.description}</strong><span className="catalog-row-meta">{ruleMatchLabels[rule.matchType]} · {category?.name ?? "Categoria indisponível"}{category?.archived ? " (arquivada)" : ""} · Prioridade {rule.priority} · {rule.enabled ? "Ativa" : "Desativada"}</span></span>
          {live && <span className="catalog-arrow" aria-hidden="true">›</span>}
        </button></li>;
      })}</ul> : <p className="report-muted">{rules.length ? "Nenhuma regra encontrada." : "Nenhuma regra criada."}</p>}
    </SectionCard>}
    <FinancialFooter live={live} />
    {editor?.type === "category" && <CategoryDialog key={editor.category?.id ?? "new"} category={editor.category} onClose={() => setEditor(undefined)} />}
    {editor?.type === "rule" && <RuleDialog key={editor.rule?.id ?? "new"} rule={editor.rule} categories={categories} accounts={accounts} onClose={() => setEditor(undefined)} />}
  </div>;
}

function CategoryDialog({ category, onClose }: { category?: LocalCategory; onClose: () => void }) {
  const viewKey = useSessionViewKey();
  const [name, setName] = useState(category?.name ?? "");
  const [notice, setNotice] = useState<{ message: string; error: boolean }>();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  function save(archived?: boolean) {
    startTransition(async () => {
      const result = category ? await updateCategory(viewKey, { categoryId: category.id, ...(archived === undefined ? { name } : { archived }) }) : await createCategory(viewKey, { name });
      if (result.ok) onClose(); else setNotice({ error: true, message: result.message });
    });
  }
  if (category && confirmDelete) {
    return <CatalogDialog title="Excluir categoria" onClose={() => { if (!pending) onClose(); }}>
      <p className="report-muted">“{category.name}” será excluída. As compras voltam à categoria anterior quando ela puder ser recuperada. Nos demais casos, ficam em “Sem categoria”.</p>
      <p className="report-muted">As regras que usam esta categoria serão removidas.</p>
      {notice && <p className="report-muted" role="alert">{notice.message}</p>}
      <div className="catalog-dialog-actions">
        <button className="report-button" type="button" disabled={pending} onClick={() => { setConfirmDelete(false); setNotice(undefined); }}>Voltar</button>
        <button className="report-button catalog-delete" type="button" disabled={pending} onClick={() => startTransition(async () => {
          const result = await deleteCategory(viewKey, { categoryId: category.id });
          if (result.ok) onClose(); else setNotice({ error: true, message: result.message });
        })}>{pending ? "Excluindo…" : "Confirmar exclusão"}</button>
      </div>
    </CatalogDialog>;
  }
  return <CatalogDialog title={category ? "Editar categoria" : "Nova categoria"} onClose={onClose}>
    <form className="catalog-dialog-form" action={() => save()}>
      <label className="report-field"><span>Nome da categoria</span><input value={name} required maxLength={80} disabled={pending} onChange={event => setName(event.target.value)} /></label>
      {name.trim() && <p><CategoryChip categoryKey={category?.code ?? `custom:${category?.id ?? "preview"}`} categoryId={category?.id} label={name} /></p>}
      {category && <p className="report-muted">Renomear também atualiza os relatórios anteriores. Arquivar impede novas escolhas manuais e preserva as compras anteriores.</p>}
      <div className="catalog-dialog-actions"><button className="report-button" type="submit" disabled={pending || !name.trim() || name.trim() === category?.name}>{category ? "Salvar nome" : "Criar categoria"}</button>
        {category && <button className="report-button" type="button" disabled={pending} onClick={() => save(!category.archived)}>{category.archived ? "Reativar" : "Arquivar"}</button>}
        <button className="report-button" type="button" disabled={pending} onClick={onClose}>Cancelar</button>
        {category?.code === null && <button className="report-button catalog-delete" type="button" disabled={pending} onClick={() => {
          setNotice(undefined);
          setConfirmDelete(true);
        }}>Excluir categoria</button>}
      </div>
      {notice && <p className="report-muted" role="alert">{notice.message}</p>}
    </form>
  </CatalogDialog>;
}

function RuleDialog({ rule, categories, accounts, onClose }: { rule?: CategoryRule; categories: LocalCategory[]; accounts: CategoryAccountOption[]; onClose: () => void }) {
  const viewKey = useSessionViewKey();
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  function update(remove: boolean) {
    if (!rule) return;
    startTransition(async () => {
      const result = await updateCategoryRule(viewKey, { ruleId: rule.id, ...(remove ? { remove: true } : { enabled: false as const }) });
      if (result.ok) onClose(); else setMessage(result.message);
    });
  }
  return <CatalogDialog title={rule ? "Editar regra" : "Nova regra"} onClose={onClose}>
    <CategoryRuleEditor categories={categories} accounts={accounts} live initial={rule ? {
      ruleId: rule.id, categoryId: rule.categoryId, description: rule.description, matchType: rule.matchType, accountId: rule.accountId,
      priority: rule.priority, applyToHistory: rule.startsOn === null, enabled: true,
    } : undefined} onSaved={onClose} onCancel={onClose} />
    {rule && <div className="catalog-dialog-actions">
      {rule.enabled && <button className="report-button" type="button" disabled={pending} onClick={() => update(false)}>Desativar regra</button>}
      <button className="report-button" type="button" disabled={pending} onClick={() => setConfirmRemoval(!confirmRemoval)} aria-expanded={confirmRemoval}>Remover regra</button>
    </div>}
    {confirmRemoval && <div><p className="report-muted">As compras passarão a seguir as demais classificações automáticas. Suas escolhas manuais permanecem.</p><button className="report-button" type="button" disabled={pending} onClick={() => update(true)}>Confirmar remoção</button></div>}
    {message && <p className="report-muted" role="alert">{message}</p>}
  </CatalogDialog>;
}
