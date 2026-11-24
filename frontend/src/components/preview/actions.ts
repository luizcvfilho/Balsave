"use server";

import { financialRequest } from "../../data/session";

export async function startConnection(viewKey: string | null) {
  const result = await financialRequest("token", viewKey);
  if (result?.status === 429) return { rateLimited: true } as const;
  if (!result?.ok) return;
  const data: { accessToken?: string; connectorId?: number } = await result.json();
  if (typeof data.accessToken === "string" && Number.isInteger(data.connectorId)) {
    return { rateLimited: false, accessToken: data.accessToken, connectorId: data.connectorId as number } as const;
  }
}

export async function registerConnection(viewKey: string | null, itemId: string) {
  if (typeof itemId !== "string" || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(itemId)) return false;
  const result = await financialRequest("connections", viewKey, { itemId });
  return !!result?.ok;
}

export async function saveReconciliation(viewKey: string | null, payload: { entryId: string; counterpartId: string | null; remove?: boolean }) {
  const result = await financialRequest("reconciliation", viewKey, payload);
  return !!result?.ok;
}

export async function saveInvestmentPosition(viewKey: string | null, payload: { investmentId: string; accountId: string | null }) {
  const result = await financialRequest("position-links", viewKey, payload);
  return !!result?.ok;
}
