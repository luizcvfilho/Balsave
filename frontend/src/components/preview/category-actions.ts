"use server";

import { revalidatePath } from "next/cache";
import type { LocalCategory } from "../../data/financial-data";
import { previewRequest } from "../../data/preview-session";

type ActionResult<T = unknown> = ({ ok: true } & T) | { ok: false; message: string };
const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
const entryId = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}\.[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
const invalidInput = { ok: false, message: "Verifique os dados informados e tente novamente." } as const;

function validName(name: unknown): name is string {
  return typeof name === "string" && name.trim().length > 0 && name.trim().length <= 80 && !Array.from(name).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

async function failure(response: Response | undefined): Promise<{ ok: false; message: string }> {
  if (!response || response.status >= 500) return { ok: false, message: "Não foi possível salvar. Tente novamente em instantes." };
  if (response.status === 401) return { ok: false, message: "Sua sessão expirou. Entre novamente para continuar." };
  if (response.status === 403 || response.status === 404) return { ok: false, message: "Este lançamento ou categoria não está mais disponível. Atualize a página." };
  if (response.status === 409) return { ok: false, message: "Já existe uma categoria com esse nome. Escolha outro nome." };
  return invalidInput;
}

export async function createCategory(payload: { name: string }): Promise<ActionResult<{ category: LocalCategory }>> {
  if (!payload || !validName(payload.name)) return invalidInput;
  const response = await previewRequest("category-create", { name: payload.name.trim() });
  if (!response?.ok) return failure(response);
  const data: { category: LocalCategory } = await response.json();
  revalidatePath("/", "layout");
  return { ok: true, category: data.category };
}

export async function updateCategory(payload: { categoryId: string; name?: string; archived?: boolean }): Promise<ActionResult<{ category: LocalCategory }>> {
  if (!payload || typeof payload.categoryId !== "string" || !uuid.test(payload.categoryId)
    || (payload.name !== undefined && !validName(payload.name))
    || (payload.archived !== undefined && typeof payload.archived !== "boolean")
    || (payload.name === undefined && payload.archived === undefined)) return invalidInput;
  const response = await previewRequest("category-update", {
    categoryId: payload.categoryId,
    ...(payload.name !== undefined && { name: payload.name.trim() }),
    ...(payload.archived !== undefined && { archived: payload.archived }),
  });
  if (!response?.ok) return failure(response);
  const data: { category: LocalCategory } = await response.json();
  revalidatePath("/", "layout");
  return { ok: true, category: data.category };
}

export async function saveTransactionCategory(payload: { entryId: string; categoryId: string | null }): Promise<ActionResult> {
  if (!payload || typeof payload.entryId !== "string" || !entryId.test(payload.entryId)
    || (payload.categoryId !== null && (typeof payload.categoryId !== "string" || !uuid.test(payload.categoryId)))) return invalidInput;
  const response = await previewRequest("transaction-category", payload);
  if (response?.status === 409) return { ok: false, message: "Este lançamento mudou. Atualize a página antes de alterar a categoria." };
  if (!response?.ok) return failure(response);
  revalidatePath("/", "layout");
  return { ok: true };
}

export type CategoryRuleDraft = {
  ruleId?: string;
  categoryId: string;
  description: string;
  matchType: "exact" | "contains" | "starts_with" | "ends_with";
  accountId: string | null;
  priority: number;
  applyToHistory: boolean;
  enabled?: boolean;
};

export type CategoryRulePreview = { affectedCount: number; manualCount: number; fingerprint: string };

function validRule(payload: CategoryRuleDraft): boolean {
  return !!payload && typeof payload.categoryId === "string" && uuid.test(payload.categoryId)
    && (payload.ruleId === undefined || typeof payload.ruleId === "string" && uuid.test(payload.ruleId))
    && typeof payload.description === "string" && payload.description.trim().length > 0 && payload.description.trim().length <= 200
    && !Array.from(payload.description).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    && ["exact", "contains", "starts_with", "ends_with"].includes(payload.matchType)
    && (payload.accountId === null || typeof payload.accountId === "string" && uuid.test(payload.accountId))
    && Number.isInteger(payload.priority) && payload.priority >= 1 && payload.priority <= 1000
    && typeof payload.applyToHistory === "boolean" && (payload.enabled === undefined || typeof payload.enabled === "boolean");
}

async function ruleFailure(response: Response | undefined): Promise<{ ok: false; message: string }> {
  if (response?.status === 409) return { ok: false, message: "Os dados da prévia mudaram. Revise as compras afetadas novamente antes de salvar." };
  if (response?.status === 403 || response?.status === 404) return { ok: false, message: "Esta regra, conta ou categoria não está mais disponível. Atualize a página." };
  return failure(response);
}

export async function previewCategoryRule(payload: CategoryRuleDraft): Promise<ActionResult<{ preview: CategoryRulePreview }>> {
  if (!validRule(payload)) return invalidInput;
  const response = await previewRequest("category-rule-preview", { ...payload, description: payload.description.trim() });
  if (!response?.ok) return ruleFailure(response);
  const data: { preview: CategoryRulePreview } = await response.json();
  return { ok: true, preview: data.preview };
}

export async function saveCategoryRule(payload: CategoryRuleDraft & { previewFingerprint: string }): Promise<ActionResult> {
  if (!validRule(payload) || typeof payload.previewFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(payload.previewFingerprint)) return invalidInput;
  const response = await previewRequest("category-rule-save", { ...payload, description: payload.description.trim() });
  if (!response?.ok) return ruleFailure(response);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateCategoryRule(payload: { ruleId: string; enabled?: false; remove?: boolean }): Promise<ActionResult> {
  if (!payload || typeof payload.ruleId !== "string" || !uuid.test(payload.ruleId)
    || (payload.enabled !== undefined && payload.enabled !== false)
    || (payload.remove !== undefined && typeof payload.remove !== "boolean")
    || (payload.enabled !== false && payload.remove !== true)) return invalidInput;
  const response = await previewRequest("category-rule-update", payload);
  if (!response?.ok) return ruleFailure(response);
  revalidatePath("/", "layout");
  return { ok: true };
}
