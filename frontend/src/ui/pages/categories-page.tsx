"use client";

import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useState, useTransition } from "react";
import { SectionCard } from "../../components/cards/section-card";
import { CategoryRuleEditor, ruleMatchLabels } from "../../components/details/category-rule-editor";
import { createCategory, updateCategory, updateCategoryRule } from "../../components/preview/category-actions";
import type { CategoryAccountOption, CategoryRule, LocalCategory } from "../../data/financial-data";

export function CategoriesPage({ categories, rules, accounts, live }: {
  categories: LocalCategory[];
  rules: CategoryRule[];
  accounts: CategoryAccountOption[];
  live: boolean;
}) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const sorted = [...categories].sort((first, second) => Number(first.archived) - Number(second.archived) || first.name.localeCompare(second.name, "pt-BR"));

  return <Container component="main" maxWidth="lg" className="report-layout">
    <header className="report-header">
      <Link href="/" className="report-link report-back">← Voltar ao painel</Link>
      <div className="report-title">
        <Typography variant="h1" color="primary.main">Categorias</Typography>
        <Chip label={live ? "Suas categorias" : "Dados fictícios"} size="small" sx={{ bgcolor: "var(--surface-muted)", color: "var(--text-secondary)" }} />
      </div>
    </header>
    {!live && <p className="report-muted">A edição de categorias está disponível ao acessar seus dados. Os dados fictícios são apenas para consulta.</p>}
    <SectionCard id="criar-categoria" title="Criar categoria" description="Organize suas compras com categorias próprias.">
      <form action={() => startTransition(async () => {
        const result = await createCategory({ name });
        setError(!result.ok);
        setMessage(result.ok ? "Categoria criada." : result.message);
        if (result.ok) setName("");
      })}>
        <div className="report-filters">
          <label className="report-field report-search">
            <span>Nome da categoria</span>
            <input value={name} required maxLength={80} disabled={!live || pending} onChange={event => { setName(event.target.value); setMessage(""); }} />
          </label>
          <button className="report-button" type="submit" disabled={!live || pending || !name.trim()}>Criar categoria</button>
        </div>
      </form>
      <p className="report-muted" role={error ? "alert" : "status"}>{message}</p>
    </SectionCard>
    <SectionCard id="minhas-categorias" title="Minhas categorias" description="Arquivar preserva as compras anteriores e impede novas escolhas manuais. Classificações automáticas valem até a data do arquivamento. Renomear atualiza também os relatórios anteriores.">
      {sorted.length ? <ul className="report-list">
        {sorted.map(category => <CategoryItem key={category.id} category={category} live={live} />)}
      </ul> : <p className="report-muted">Nenhuma categoria disponível.</p>}
    </SectionCard>
    <SectionCard id="criar-regra" title="Criar regra pessoal" description="Escolha os critérios e revise as compras afetadas antes de salvar. Alterar uma compra não cria regras automaticamente.">
      <CategoryRuleEditor categories={categories} accounts={accounts} live={live} />
    </SectionCard>
    <SectionCard id="minhas-regras" title="Minhas regras" description="Em caso de empate na prioridade, a regra criada primeiro prevalece. Ao desativar ou remover uma regra, as compras passam a seguir as demais classificações automáticas.">
      {rules.length ? <ul className="report-list">
        {[...rules].sort((first, second) => first.priority - second.priority).map(rule => <RuleItem key={rule.id} rule={rule} categories={categories} accounts={accounts} live={live} />)}
      </ul> : <p className="report-muted">Nenhuma regra criada.</p>}
    </SectionCard>
  </Container>;
}

function CategoryItem({ category, live }: { category: LocalCategory; live: boolean }) {
  const [draftName, setDraftName] = useState<string>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const name = draftName ?? category.name;

  function save(payload: { name?: string; archived?: boolean }) {
    startTransition(async () => {
      const result = await updateCategory({ categoryId: category.id, ...payload });
      setError(!result.ok);
      setMessage(result.ok ? payload.name !== undefined ? "Nome atualizado." : payload.archived ? "Categoria arquivada." : "Categoria reativada." : result.message);
      if (result.ok) setDraftName(undefined);
    });
  }

  return <li className="report-list-item">
    <div className="report-group"><strong>{category.name}</strong><span className="report-muted">{category.archived ? "Arquivada" : category.code ? "Categoria inicial" : "Categoria personalizada"}</span></div>
    <form action={() => save({ name })}>
      <div className="report-filters">
        <label className="report-field report-search">
          <span>Nome de {category.name}</span>
          <input value={name} required maxLength={80} disabled={!live || pending} onChange={event => { setDraftName(event.target.value); setMessage(""); }} />
        </label>
        <button className="report-button" type="submit" disabled={!live || pending || !name.trim() || name.trim() === category.name}>Salvar nome</button>
        <button className="report-button" type="button" disabled={!live || pending} onClick={() => save({ archived: !category.archived })}>
          {category.archived ? "Reativar" : "Arquivar"}
        </button>
      </div>
    </form>
    <p className="report-muted" role={error ? "alert" : "status"}>{message}</p>
  </li>;
}

function RuleItem({ rule, categories, accounts, live }: { rule: CategoryRule; categories: LocalCategory[]; accounts: CategoryAccountOption[]; live: boolean }) {
  const [editing, setEditing] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const category = categories.find(item => item.id === rule.categoryId);
  const account = accounts.find(item => item.id === rule.accountId);

  function update(remove = false) {
    startTransition(async () => {
      const result = await updateCategoryRule({ ruleId: rule.id, ...(remove ? { remove: true } : { enabled: false as const }) });
      setError(!result.ok);
      setMessage(result.ok ? "Regra desativada." : result.message);
      if (result.ok) setConfirmRemoval(false);
    });
  }

  return <li className="report-list-item">
    <div className="report-group"><strong>{rule.description}</strong><span className="report-muted">{rule.enabled ? "Ativa" : "Desativada"}</span></div>
    <p className="report-muted">{ruleMatchLabels[rule.matchType]} “{rule.description}” · {category?.name ?? "Categoria indisponível"}{category?.archived ? " (arquivada)" : ""} · Prioridade {rule.priority}</p>
    <p className="report-muted">{rule.accountId ? account?.label ?? "Conta ou cartão selecionado" : "Todas as contas e cartões"} · {rule.startsOn ? `Compras a partir de ${rule.startsOn.split("-").reverse().join("/")}` : "Todo o histórico disponível"}</p>
    <div className="report-filters">
      <button className="report-button" type="button" disabled={!live || pending} onClick={() => setEditing(!editing)}>
        {rule.enabled ? "Editar regra" : "Editar e reativar"}
      </button>
      {rule.enabled && <button className="report-button" type="button" disabled={!live || pending} onClick={() => update()}>Desativar regra</button>}
      <button className="report-button" type="button" disabled={!live || pending} onClick={() => setConfirmRemoval(!confirmRemoval)} aria-expanded={confirmRemoval}>Remover regra</button>
    </div>
    {confirmRemoval && <div>
      <p className="report-muted">Remover esta regra faz as compras seguirem as demais classificações automáticas. Suas escolhas manuais permanecem.</p>
      <button className="report-button" type="button" disabled={pending} onClick={() => update(true)}>Confirmar remoção</button>
    </div>}
    {editing && <CategoryRuleEditor categories={categories} accounts={accounts} live={live} initial={{
      ruleId: rule.id, categoryId: rule.categoryId, description: rule.description, matchType: rule.matchType, accountId: rule.accountId,
      priority: rule.priority, applyToHistory: rule.startsOn === null, enabled: true,
    }} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />}
    <p className="report-muted" role={error ? "alert" : "status"}>{message}</p>
  </li>;
}
