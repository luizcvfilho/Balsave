"use server";

import { revalidatePath } from "next/cache";
import { financialRequest } from "../../data/session";
import type { ReceivableGroup } from "../../lib/receivables";

type Result = { ok: true } | { ok: false; message: string };
type Plan = Pick<ReceivableGroup, "expenseId" | "expectations">;
type Link = { expenseId: string; previousExpenseId?: string } & ReceivableGroup["receipts"][number];

async function save(path: "receivable-plan" | "receivable-link", viewKey: string | null, payload: Plan | Link): Promise<Result> {
  const response = await financialRequest(path, viewKey, payload);
  if (response?.ok) {
    revalidatePath("/", "layout");
    return { ok: true };
  }
  if (response?.status === 412) return { ok: false, message: "Sua sessão mudou. Recarregue a página e tente novamente." };
  if (response?.status === 403 || response?.status === 404) return { ok: false, message: "Um dos lançamentos está indisponível. Atualize a página." };
  if (response?.status === 409) return { ok: false, message: "O vínculo ou os valores mudaram. Atualize a página e confira os lançamentos." };
  if (response?.status === 422) return { ok: false, message: "Confira os valores e os lançamentos selecionados." };
  return { ok: false, message: "Não foi possível salvar. Tente novamente em instantes." };
}

export async function saveReceivablePlan(viewKey: string | null, payload: Plan): Promise<Result> {
  return save("receivable-plan", viewKey, payload);
}

export async function saveReceivableLink(viewKey: string | null, payload: Link): Promise<Result> {
  return save("receivable-link", viewKey, payload);
}
