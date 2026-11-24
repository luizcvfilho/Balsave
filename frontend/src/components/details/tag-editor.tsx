"use client";

import { useState, useTransition } from "react";
import type { TransactionTag } from "../../lib/finance";
import { useSessionViewKey } from "../layout/session-view-provider";
import { createTag, saveTransactionTags, updateTag } from "../preview/tag-actions";

export function TagEditor({ entryId, tagIds, tags }: { entryId: string; tagIds: readonly string[]; tags: readonly TransactionTag[] }) {
  const viewKey = useSessionViewKey();
  const [draft, setDraft] = useState<string[]>();
  const [name, setName] = useState("");
  const [renameId, setRenameId] = useState("");
  const [renameName, setRenameName] = useState("");
  const [notice, setNotice] = useState<{ message: string; error?: boolean }>();
  const [pending, startTransition] = useTransition();
  const selected = draft ?? tagIds;

  function save() {
    startTransition(async () => {
      const result = await saveTransactionTags(viewKey, { entryId, tagIds: [...selected] });
      setNotice(result.ok ? { message: "Etiquetas salvas." } : { error: true, message: result.message });
      if (result.ok) setDraft(undefined);
    });
  }

  function create() {
    startTransition(async () => {
      const result = await createTag(viewKey, { name });
      if (result.ok) {
        setDraft([...selected, result.tag.id]);
        setName("");
        setNotice({ message: "Etiqueta criada. Salve para aplicá-la ao lançamento." });
      } else setNotice({ error: true, message: result.message });
    });
  }

  function rename() {
    startTransition(async () => {
      const result = await updateTag(viewKey, { tagId: renameId, name: renameName });
      if (result.ok) {
        setRenameId("");
        setRenameName("");
        setNotice({ message: "Etiqueta renomeada." });
      } else setNotice({ error: true, message: result.message });
    });
  }

  return (
    <>
      <div className="report-tag-editor">
        {tags.length > 0 && (
          <form action={save}>
            <fieldset disabled={pending}>
              <legend>Etiquetas deste lançamento</legend>
              <div className="report-tag-editor-options">
                {tags.map(tag => (
                  <label key={tag.id} className="report-choice report-tag-option">
                    <input type="checkbox" checked={selected.includes(tag.id)} onChange={event => {
                      setDraft(event.target.checked ? [...selected, tag.id] : selected.filter(id => id !== tag.id));
                      setNotice(undefined);
                    }} />
                    <span>{tag.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="report-button" type="submit" disabled={pending || !draft}>Salvar etiquetas</button>
          </form>
        )}
        <form action={create} className="report-filters">
          <label className="report-field">
            <span>Nome da nova etiqueta</span>
            <input value={name} maxLength={80} required disabled={pending} onChange={event => setName(event.target.value)} />
          </label>
          <button className="report-button" type="submit" disabled={pending || !name.trim()}>Criar etiqueta</button>
        </form>
        {tags.length > 0 && (
          <form action={rename} className="report-filters">
            <label className="report-field">
              <span>Etiqueta para renomear</span>
              <select value={renameId} disabled={pending} onChange={event => {
                setRenameId(event.target.value);
                setRenameName(tags.find(tag => tag.id === event.target.value)?.name ?? "");
              }}>
                <option value="">Selecione uma etiqueta</option>
                {tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
              </select>
            </label>
            <label className="report-field">
              <span>Novo nome da etiqueta</span>
              <input value={renameName} maxLength={80} required disabled={pending || !renameId} onChange={event => setRenameName(event.target.value)} />
            </label>
            <button className="report-button" type="submit" disabled={pending || !renameId || !renameName.trim()}>Renomear etiqueta</button>
          </form>
        )}
      </div>
      <p className="report-muted" role={notice?.error ? "alert" : "status"}>{notice?.message}</p>
    </>
  );
}
