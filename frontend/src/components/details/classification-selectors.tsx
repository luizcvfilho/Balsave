"use client";

import Popover from "@mui/material/Popover";
import Link from "next/link";
import { type ReactNode, useId, useRef, useState, useTransition } from "react";
import { useFinancialReports } from "../../data/financial-reports";
import { type Expense, type Transaction, transactionCategory, transactionCategoryKey } from "../../lib/finance";
import { useSessionViewKey } from "../layout/session-view-provider";
import { createCategory, saveTransactionCategory } from "../preview/category-actions";
import { createTag, setTransactionTag } from "../preview/tag-actions";
import { CategoryChip, TagChip } from "./transaction-classification";
import styles from "./classification-selectors.module.css";

type Notice = { message: string; error?: boolean };

function nameKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

function searchKey(value: string) {
  return nameKey(value).normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function SelectorPopover({ anchor, onClose, title, entryName, field, search, onSearch, onSubmit, pending, notice, children }: {
  anchor: HTMLElement | null;
  onClose: () => void;
  title: string;
  entryName: string;
  field: string;
  search: string;
  onSearch: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  notice?: Notice;
  children: ReactNode;
}) {
  const descriptionId = useId();
  const searchInput = useRef<HTMLInputElement>(null);
  return <>
    <Popover open={!!anchor} anchorEl={anchor} onClose={onClose} anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      slotProps={{
        paper: { className: styles.popover, role: "dialog", "aria-label": title, "aria-describedby": descriptionId },
        transition: { onEntered: () => {
          if (window.matchMedia("(pointer: fine)").matches) searchInput.current?.focus();
        } },
      }}>
      <div className={styles.content} aria-busy={pending}>
        <div className={styles.heading}>
          <div><strong>{title}</strong><p id={descriptionId}>{entryName}</p></div>
          <button className={styles.close} type="button" aria-label="Fechar seletor" onClick={onClose}>×</button>
        </div>
        <form onSubmit={event => { event.preventDefault(); if (!pending) onSubmit(); }}>
          <input className={styles.search} ref={searchInput} type="search" aria-label={field} placeholder={field}
            value={search} maxLength={80} readOnly={pending} onChange={event => onSearch(event.target.value)} />
        </form>
        {children}
        {notice && <p className={styles.notice} role={notice.error ? "alert" : "status"}>{notice.message}</p>}
      </div>
    </Popover>
    {!anchor && notice && <span className="sr-only" role={notice.error ? "alert" : "status"}>{notice.message}</span>}
  </>;
}

export function CategorySelector({ transaction }: { transaction: Expense }) {
  const { categories = [] } = useFinancialReports();
  const viewKey = useSessionViewKey();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<Notice>();
  const [pending, startTransition] = useTransition();
  const currentKey = transactionCategoryKey(transaction);
  const label = transactionCategory(transaction);
  const query = searchKey(search);
  const exact = categories.find(category => nameKey(category.name) === nameKey(search));
  const options = categories.filter(category => !category.archived && searchKey(category.name).includes(query))
    .sort((first, second) => first.name.localeCompare(second.name, "pt-BR"));

  function save(categoryId: string | null, unclassified = false) {
    startTransition(async () => {
      const result = await saveTransactionCategory(viewKey, { entryId: transaction.id, categoryId, ...(unclassified && { unclassified: true }) });
      setNotice(result.ok
        ? { message: unclassified ? "Categoria removida." : categoryId ? "Categoria aplicada." : "Classificação automática restaurada." }
        : { error: true, message: result.message });
      if (result.ok) setAnchor(null);
    });
  }

  function create() {
    startTransition(async () => {
      const result = await createCategory(viewKey, { name: search });
      if (!result.ok) { setNotice({ error: true, message: result.message }); return; }
      const saved = await saveTransactionCategory(viewKey, { entryId: transaction.id, categoryId: result.category.id });
      setNotice(saved.ok ? { message: "Categoria criada e aplicada." } : { error: true, message: `Categoria criada, mas não aplicada. ${saved.message}` });
      if (saved.ok) setAnchor(null);
    });
  }

  return <>
    <button type="button" className={styles.trigger} onClick={event => { setSearch(""); setNotice(undefined); setAnchor(event.currentTarget); }}
      aria-haspopup="dialog" aria-expanded={!!anchor} aria-label={`Alterar categoria de ${transaction.name}: ${label}`}>
      {currentKey === "uncategorized"
        ? <span className={styles.placeholder}><span aria-hidden="true">＋</span> Adicionar categoria</span>
        : <><CategoryChip categoryKey={currentKey} categoryId={transaction.categoryId} label={label} />
          <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></>}
    </button>
    <SelectorPopover anchor={anchor} onClose={() => setAnchor(null)} title="Classificação" entryName={transaction.name} field="Buscar ou criar categoria"
      search={search} onSearch={value => { setSearch(value); setNotice(undefined); }} pending={pending} notice={notice}
      onSubmit={() => { if (exact && !exact.archived) save(exact.id); else if (query && !exact) create(); }}>
      <div className={styles.list}>
        <p className={styles.listLabel}>Escolher uma categoria</p>
        {options.map(category => <button key={category.id} type="button" disabled={pending} className={styles.option}
          aria-pressed={category.id === transaction.categoryId} onClick={() => save(category.id)}>
          <CategoryChip categoryKey={category.code ?? `custom:${category.id}`} categoryId={category.id} label={category.name} />
          {category.id === transaction.categoryId && <span className={styles.check} aria-hidden="true">✓</span>}
        </button>)}
        {!options.length && <p className={styles.listLabel}>Nenhuma categoria encontrada.</p>}
        {query && !exact && <button type="button" disabled={pending} className={`${styles.option} ${styles.create}`} onClick={create}>＋ Criar “{search.trim()}”</button>}
        {exact?.archived && <p className={styles.listLabel}>Essa categoria está arquivada. Reative-a para usar novamente.</p>}
      </div>
      <div className={styles.footer}>
        {currentKey !== "uncategorized" && <button type="button" disabled={pending} onClick={() => save(null, true)}>Remover categoria</button>}
        {transaction.categorySource === "manual" && <button type="button" disabled={pending} onClick={() => save(null)}>Usar classificação automática</button>}
        <Link href="/classificacoes">Gerenciar categorias</Link>
      </div>
    </SelectorPopover>
  </>;
}

export function TagSelector({ transaction }: { transaction: Transaction }) {
  const { tags } = useFinancialReports();
  const viewKey = useSessionViewKey();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<Notice>();
  const [pending, startTransition] = useTransition();
  const selected = transaction.tagIds ?? [];
  const query = searchKey(search);
  const exact = tags.find(tag => nameKey(tag.name) === nameKey(search));
  const options = tags.filter(tag => searchKey(tag.name).includes(query)).sort((first, second) => first.name.localeCompare(second.name, "pt-BR"));
  const selectedTags = tags.filter(tag => selected.includes(tag.id));

  function save(tagId: string, assigned: boolean) {
    startTransition(async () => {
      const result = await setTransactionTag(viewKey, { entryId: transaction.id, tagId, assigned });
      setNotice(result.ok ? { message: assigned ? "Etiqueta aplicada." : "Etiqueta removida." } : { error: true, message: result.message });
    });
  }

  function create() {
    startTransition(async () => {
      const result = await createTag(viewKey, { name: search });
      if (!result.ok) { setNotice({ error: true, message: result.message }); return; }
      const saved = await setTransactionTag(viewKey, { entryId: transaction.id, tagId: result.tag.id, assigned: true });
      setNotice(saved.ok ? { message: "Etiqueta criada e aplicada." } : { error: true, message: `Etiqueta criada, mas não aplicada. ${saved.message}` });
      if (saved.ok) setSearch("");
    });
  }

  return <>
    <button type="button" className={styles.trigger} onClick={event => { setSearch(""); setNotice(undefined); setAnchor(event.currentTarget); }}
      aria-haspopup="dialog" aria-expanded={!!anchor} aria-label={selectedTags.length
        ? `Editar etiquetas de ${transaction.name}: ${selectedTags.map(tag => tag.name).join(", ")}`
        : `Adicionar etiquetas a ${transaction.name}`}>
      {selectedTags.length
        ? <>{selectedTags.map(tag => <TagChip key={tag.id} id={tag.id} label={tag.name} />)}<span className={styles.disclosure} aria-hidden="true">＋</span></>
        : <span className={styles.placeholder}><span aria-hidden="true">＋</span> Adicionar etiquetas</span>}
    </button>
    <SelectorPopover anchor={anchor} onClose={() => setAnchor(null)} title="Etiquetas" entryName={transaction.name} field="Buscar ou criar etiqueta"
      search={search} onSearch={value => { setSearch(value); setNotice(undefined); }} pending={pending} notice={notice}
      onSubmit={() => { if (exact) save(exact.id, !selected.includes(exact.id)); else if (query) create(); }}>
      {!!selectedTags.length && <div className={styles.selected}>
        <p className={styles.listLabel}>Aplicadas neste lançamento</p>
        {selectedTags.map(tag => <button key={tag.id} className={styles.removeTag} type="button" disabled={pending}
          aria-label={`Remover etiqueta ${tag.name}`} onClick={() => save(tag.id, false)}>
          <TagChip id={tag.id} label={tag.name} /><span aria-hidden="true">×</span>
        </button>)}
      </div>}
      <div className={styles.list}>
        <p className={styles.listLabel}>Etiquetas disponíveis</p>
        {options.map(tag => <button key={tag.id} type="button" disabled={pending} className={styles.option}
          aria-pressed={selected.includes(tag.id)} onClick={() => save(tag.id, !selected.includes(tag.id))}>
          <TagChip id={tag.id} label={tag.name} />{selected.includes(tag.id) && <span className={styles.check} aria-hidden="true">✓</span>}
        </button>)}
        {!options.length && <p className={styles.listLabel}>Nenhuma etiqueta encontrada.</p>}
        {query && !exact && <button type="button" disabled={pending} className={`${styles.option} ${styles.create}`} onClick={create}>＋ Criar “{search.trim()}”</button>}
      </div>
      <div className={styles.footer}><Link href="/classificacoes?aba=etiquetas">Gerenciar etiquetas</Link></div>
    </SelectorPopover>
  </>;
}
