"use server";

import { revalidatePath } from "next/cache";
import { financialRequest } from "../../data/session";
import type { TransactionTag } from "../../lib/finance";

type Failure = { ok: false; message: string };
type Result<T = object> = ({ ok: true } & T) | Failure;
const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
const entryId = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}\.[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
const invalid = { ok: false, message: "Verifique os dados informados e tente novamente." } as const;

function validName(name: unknown): name is string {
  return typeof name === "string" && name.trim().length > 0 && name.trim().length <= 80
    && !Array.from(name).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

function failure(response: Response | undefined): Failure {
  if (!response || response.status >= 500) return { ok: false, message: "Não foi possível salvar. Tente novamente em instantes." };
  if (response.status === 412) return { ok: false, message: "Sua sessão mudou. Recarregue a página e tente novamente." };
  if (response.status === 403 || response.status === 404) return { ok: false, message: "Este lançamento ou etiqueta não está mais disponível. Atualize a página." };
  if (response.status === 409) return { ok: false, message: "Já existe uma etiqueta com esse nome." };
  return invalid;
}

export async function createTag(viewKey: string | null, payload: { name: string }): Promise<Result<{ tag: TransactionTag }>> {
  if (!payload || !validName(payload.name)) return invalid;
  const response = await financialRequest("tag-create", viewKey, { name: payload.name.trim() });
  if (!response?.ok) return failure(response);
  const data: { tag: TransactionTag } = await response.json();
  revalidatePath("/", "layout");
  return { ok: true, tag: data.tag };
}

export async function updateTag(viewKey: string | null, payload: { tagId: string; name: string }): Promise<Result<{ tag: TransactionTag }>> {
  if (!payload || typeof payload.tagId !== "string" || !uuid.test(payload.tagId) || !validName(payload.name)) return invalid;
  const response = await financialRequest("tag-update", viewKey, { tagId: payload.tagId, name: payload.name.trim() });
  if (!response?.ok) return failure(response);
  const data: { tag: TransactionTag } = await response.json();
  revalidatePath("/", "layout");
  return { ok: true, tag: data.tag };
}

export async function deleteTag(viewKey: string | null, payload: { tagId: string }): Promise<Result> {
  if (!payload || typeof payload.tagId !== "string" || !uuid.test(payload.tagId)) return invalid;
  const response = await financialRequest("tag-delete", viewKey, payload);
  if (!response?.ok) return failure(response);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveTransactionTags(viewKey: string | null, payload: { entryId: string; tagIds: string[] }): Promise<Result> {
  if (!payload || typeof payload.entryId !== "string" || !entryId.test(payload.entryId)
    || !Array.isArray(payload.tagIds) || payload.tagIds.length > 100 || payload.tagIds.some(id => typeof id !== "string" || !uuid.test(id))
    || new Set(payload.tagIds).size !== payload.tagIds.length) return invalid;
  const response = await financialRequest("transaction-tags", viewKey, payload);
  if (!response?.ok) return failure(response);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setTransactionTag(viewKey: string | null, payload: { entryId: string; tagId: string; assigned: boolean }): Promise<Result> {
  if (!payload || typeof payload.entryId !== "string" || !entryId.test(payload.entryId)
    || typeof payload.tagId !== "string" || !uuid.test(payload.tagId) || typeof payload.assigned !== "boolean") return invalid;
  const response = await financialRequest("transaction-tags", viewKey, payload);
  if (response?.status === 409) return { ok: false, message: "Este lançamento já tem 100 etiquetas." };
  if (!response?.ok) return failure(response);
  revalidatePath("/", "layout");
  return { ok: true };
}
