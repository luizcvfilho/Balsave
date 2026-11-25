"use client";

import { useState, useTransition } from "react";
import { SectionCard } from "../../components/cards/section-card";
import { FinancialFooter } from "../../components/details/report-layout";
import { TagChip } from "../../components/details/transaction-classification";
import { useSessionViewKey } from "../../components/layout/session-view-provider";
import { createTag, deleteTag, updateTag } from "../../components/preview/tag-actions";
import type { TransactionTag } from "../../lib/finance";
import { CatalogDialog } from "./catalog-dialog";
import "./catalog.css";

export function TagsPage({ tags, live, usageByTag }: { tags: TransactionTag[]; live: boolean; usageByTag?: Record<string, number> }) {
  const [editor, setEditor] = useState<{ tag?: TransactionTag }>();
  const [search, setSearch] = useState("");
  const filtered = tags.filter(tag => tag.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")));
  return <div className="catalog-embedded">
    {!live && <p className="report-muted">Os dados fictícios são apenas para consulta. A edição está disponível ao acessar seus dados.</p>}
    <SectionCard id="minhas-etiquetas" title="Suas etiquetas" description="Use etiquetas para reunir lançamentos de diferentes categorias."
      action={<button className="report-button" type="button" disabled={!live} onClick={() => setEditor({})}>Nova etiqueta</button>}>
      <label className="report-field catalog-search"><span>Buscar etiqueta</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
      {/* biome-ignore lint/a11y/noRedundantRoles: Safari can omit list semantics when markers are hidden. */}
      {filtered.length ? <ul role="list" className="catalog-list">{filtered.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map(tag => {
        const count = usageByTag?.[tag.id] ?? 0;
        return <li key={tag.id}><button type="button" className="catalog-row" disabled={!live} onClick={() => setEditor({ tag })}>
          <span className="catalog-row-content"><TagChip id={tag.id} label={tag.name} />{usageByTag && <span className="catalog-row-meta">{count} {count === 1 ? "lançamento" : "lançamentos"}</span>}</span>
          {live && <span className="catalog-arrow" aria-hidden="true">›</span>}
        </button></li>;
      })}</ul> : <p className="report-muted">{tags.length ? "Nenhuma etiqueta encontrada." : "Nenhuma etiqueta criada."}</p>}
    </SectionCard>
    <FinancialFooter live={live} />
    {editor && <TagDialog key={editor.tag?.id ?? "new"} tag={editor.tag} usage={editor.tag ? usageByTag?.[editor.tag.id] : undefined} onClose={() => setEditor(undefined)} />}
  </div>;
}

function TagDialog({ tag, usage, onClose }: { tag?: TransactionTag; usage?: number; onClose: () => void }) {
  const viewKey = useSessionViewKey();
  const [name, setName] = useState(tag?.name ?? "");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (tag && confirmDelete) {
    return <CatalogDialog title="Excluir etiqueta" onClose={() => { if (!pending) onClose(); }}>
      <p className="report-muted">“{tag.name}” será excluída do catálogo e removida dos lançamentos associados.</p>
      {usage !== undefined && <p className="report-muted">Uso atual: {usage} {usage === 1 ? "lançamento" : "lançamentos"}.</p>}
      {message && <p className="report-muted" role="alert">{message}</p>}
      <div className="catalog-dialog-actions">
        <button className="report-button" type="button" disabled={pending} onClick={() => { setConfirmDelete(false); setMessage(""); }}>Voltar</button>
        <button className="report-button catalog-delete" type="button" disabled={pending} onClick={() => startTransition(async () => {
          const result = await deleteTag(viewKey, { tagId: tag.id });
          if (result.ok) onClose(); else setMessage(result.message);
        })}>{pending ? "Excluindo…" : "Confirmar exclusão"}</button>
      </div>
    </CatalogDialog>;
  }

  return <CatalogDialog title={tag ? "Editar etiqueta" : "Nova etiqueta"} onClose={onClose}>
    <form className="catalog-dialog-form" action={() => startTransition(async () => {
      const result = tag ? await updateTag(viewKey, { tagId: tag.id, name }) : await createTag(viewKey, { name });
      if (result.ok) onClose(); else setMessage(result.message);
    })}>
      <label className="report-field"><span>Nome da etiqueta</span><input value={name} required maxLength={80} disabled={pending} onChange={event => setName(event.target.value)} /></label>
      {name.trim() && <p><TagChip id={tag?.id ?? "preview"} label={name} /></p>}
      {tag && <p className="report-muted">O novo nome aparecerá nos lançamentos que usam esta etiqueta.</p>}
      <div className="catalog-dialog-actions"><button className="report-button" type="submit" disabled={pending || !name.trim() || name.trim() === tag?.name}>{tag ? "Salvar nome" : "Criar etiqueta"}</button>
        <button className="report-button" type="button" disabled={pending} onClick={onClose}>Cancelar</button>
        {tag && <button className="report-button catalog-delete" type="button" disabled={pending} onClick={() => { setMessage(""); setConfirmDelete(true); }}>Excluir etiqueta</button>}
      </div>
      {message && <p className="report-muted" role="alert">{message}</p>}
    </form>
  </CatalogDialog>;
}
