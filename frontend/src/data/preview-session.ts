import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";

export const previewCookie = "__Host-balsave-preview";
export const sessionSeconds = 60 * 60 * 8;

export function previewPassword() {
  return process.env.BALSAVE_PREVIEW_PASSWORD ?? "";
}

export async function isLocalPreviewHost() {
  const host = (await headers()).get("host") ?? "";
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
}

export function secureEqual(first: string, second: string) {
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(first), hash(second));
}

function signature(value: string) {
  return createHmac("sha256", previewPassword()).update(`balsave/preview/session/${value}`).digest("hex");
}

export function newSession() {
  const expiry = String(Math.floor(Date.now() / 1000) + sessionSeconds);
  return `${expiry}.${signature(expiry)}`;
}

export async function hasPreviewSession() {
  if (previewPassword().length < 32 || !await isLocalPreviewHost()) return false;
  const cookie = (await cookies()).get(previewCookie)?.value ?? "";
  const match = /^(\d{10,12})\.([a-f0-9]{64})$/.exec(cookie);
  return !!match && Number(match[1]) > Date.now() / 1000 && secureEqual(match[2], signature(match[1]));
}

export async function previewRequest(path: "snapshot" | "token" | "connections" | "reconciliation" | "position-links", payload?: object) {
  if (!await hasPreviewSession()) return;
  const bearer = createHmac("sha256", previewPassword()).update("balsave/preview/backend").digest("hex");
  const origin = process.env.BALSAVE_BACKEND_URL ?? "http://127.0.0.1:8000";
  try {
    return await fetch(`${origin}/_internal/pluggy/${path}`, {
      method: path === "snapshot" ? "GET" : "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: payload && JSON.stringify(payload),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return undefined;
  }
}
