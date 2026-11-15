"use client";

import { type FormEvent, useState, useSyncExternalStore } from "react";

type Annotation = { classification: string; tags: string[] };
const storageKey = "balsave.mock-receipt-annotations.v1";
const changeEvent = "balsave:receipt-annotations-updated";
const emptyAnnotation: Annotation = { classification: "", tags: [] };

function subscribe(callback: () => void) {
  window.addEventListener(changeEvent, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(changeEvent, callback);
    window.removeEventListener("storage", callback);
  };
}

const emptySnapshot = () => "{}";
const ignoreChanges = () => () => {};

function storageSnapshot() {
  try {
    return window.localStorage.getItem(storageKey) ?? emptySnapshot();
  } catch {
    return emptySnapshot();
  }
}

function parseAnnotations(snapshot: string): Record<string, Annotation> {
  try {
    const data: unknown = JSON.parse(snapshot);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return Object.fromEntries(Object.entries(data).flatMap(([id, value]) => {
      if (!value || typeof value.classification !== "string" || !Array.isArray(value.tags)
        || value.tags.some((tag: unknown) => typeof tag !== "string")) return [];
      return [[id, { classification: value.classification.slice(0, 60), tags: value.tags.slice(0, 8).map((tag: string) => tag.slice(0, 32)) }]];
    }));
  } catch {
    return {};
  }
}

export function useReceiptAnnotations(enabled = true) {
  const snapshot = useSyncExternalStore(
    enabled ? subscribe : ignoreChanges,
    enabled ? storageSnapshot : emptySnapshot,
    emptySnapshot,
  );
  return parseAnnotations(snapshot);
}

export function ReceiptEditor({ id, annotation = emptyAnnotation }: { id: string; annotation?: Annotation }) {
  const [draftClassification, setClassification] = useState<string>();
  const [draftTags, setTags] = useState<string>();
  const [message, setMessage] = useState("");
  const classification = draftClassification ?? annotation.classification;
  const tags = draftTags ?? annotation.tags.join(", ");

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = parseAnnotations(storageSnapshot());
    const newTags = [...new Set(tags.split(",").map(tag => tag.trim().slice(0, 32)).filter(Boolean))].slice(0, 8);
    const label = classification.trim();

    if (label || newTags.length) values[id] = { classification: label, tags: newTags };
    else delete values[id];

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(values));
      window.dispatchEvent(new Event(changeEvent));
      setClassification(undefined);
      setTags(undefined);
      setMessage("Classificação e tags salvas.");
    } catch {
      setMessage("Não foi possível salvar neste navegador.");
    }
  }

  return (
    <form onSubmit={save}>
      <p className="report-muted">A classificação e as tags destes dados fictícios são salvas neste navegador.</p>
      <div className="report-filters">
        <label className="report-field">
          <span>Classificação</span>
          <input value={classification} maxLength={60} onChange={event => { setClassification(event.target.value); setMessage(""); }} />
        </label>
        <label className="report-field report-search">
          <span>Tags</span>
          <input
            value={tags}
            maxLength={272}
            aria-describedby="tags-help"
            onChange={event => { setTags(event.target.value); setMessage(""); }}
          />
        </label>
        <button type="submit" className="report-button">Salvar</button>
      </div>
      <p className="report-muted" id="tags-help">Separe com vírgulas. Até 8 tags de 32 caracteres cada.</p>
      <p className="report-muted" role="status">{message}</p>
    </form>
  );
}
