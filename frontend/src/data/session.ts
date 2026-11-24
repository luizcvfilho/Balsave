import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { isAPIError } from "better-auth/api";
import { cookies, headers } from "next/headers";
import { redirect, RedirectType } from "next/navigation";
import { cache } from "react";

import { authEnabled, configuredOrigin, getAuth, sessionCookie } from "./auth";

export { authEnabled };

async function hasTrustedOrigin() {
  return (await headers()).get("origin") === configuredOrigin();
}

function sessionViewKey(sessionId: string) {
  return createHmac("sha256", process.env.BALSAVE_AUTH_SECRET ?? "")
    .update(`balsave/session-view/${sessionId}`).digest("hex");
}

function matchesSessionView(sessionId: string, viewKey: string | null | undefined) {
  return typeof viewKey === "string" && /^[a-f0-9]{64}$/.test(viewKey)
    && timingSafeEqual(Buffer.from(viewKey), Buffer.from(sessionViewKey(sessionId)));
}

async function backendRequest(path: string, method: "GET" | "POST", options: {
  sessionId?: string;
  payload?: object;
  clientIp?: string | null;
} = {}) {
  const secret = process.env.BALSAVE_AUTH_SECRET ?? "";
  if (Buffer.byteLength(secret) < 32) return;

  const origin = process.env.BALSAVE_BACKEND_URL ?? "http://127.0.0.1:8000";
  try {
    const requestHeaders = new Headers({ "X-Balsave-Internal": secret });
    if (options.sessionId) requestHeaders.set("Authorization", `Bearer ${options.sessionId}`);
    if (options.payload) requestHeaders.set("Content-Type", "application/json");
    if (options.clientIp) requestHeaders.set("X-Balsave-Client-IP", options.clientIp);
    return await fetch(`${origin}/_internal/${path}`, {
      method,
      headers: requestHeaders,
      body: options.payload ? JSON.stringify(options.payload) : undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return undefined;
  }
}

const currentSessionId = cache(async () => {
  if (!authEnabled() || !(await cookies()).has(sessionCookie)) return null;
  try {
    const session = await getAuth().api.getSession({ headers: await headers() });
    return session?.session.id ?? null;
  } catch {
    return undefined;
  }
});

type SessionView = { status: "active"; viewKey: string } | { status: "anonymous" | "unavailable"; viewKey: null };

export const sessionView = cache(async (): Promise<SessionView> => {
  const sessionId = await currentSessionId();
  if (sessionId) return { status: "active", viewKey: sessionViewKey(sessionId) };
  return { status: sessionId === null ? "anonymous" : "unavailable", viewKey: null };
});

export async function sendCredentials(mode: "login" | "register", credentials: {
  email: string;
  password: string;
  name: string;
}) {
  if (!await hasTrustedOrigin()) return 403;
  if (!authEnabled()) return 503;
  const requestHeaders = await headers();
  const { email, password, name } = credentials;
  const attempt = await backendRequest("auth/attempt", "POST", {
    payload: { mode, email },
    clientIp: requestHeaders.get("x-balsave-client-ip"),
  });
  if (!attempt?.ok) return attempt?.status ?? 503;

  try {
    const { api } = getAuth();
    const result = mode === "register"
      ? await api.signUpEmail({ headers: requestHeaders, body: { email, password, name } })
      : await api.signInEmail({ headers: requestHeaders, body: { email, password } });
    return result.token ? 200 : 503;
  } catch (error) {
    if (!isAPIError(error)) return 503;
    if (error.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") return 409;
    if (error.body?.code === "FAILED_TO_CREATE_USER") return 503;
    return error.statusCode;
  }
}

export async function revokeSession(viewKey: string | null) {
  if (!await hasTrustedOrigin() || !authEnabled()) return "unavailable";
  const sessionId = await currentSessionId();
  if (sessionId === undefined) return "unavailable";
  if (!sessionId && !(await cookies()).has(sessionCookie)) return "revoked";
  if (sessionId && !matchesSessionView(sessionId, viewKey)) return "changed";
  try {
    await getAuth().api.signOut({ headers: await headers() });
    return "revoked";
  } catch {
    return "unavailable";
  }
}

type FinancialReadPath = "snapshot" | "categories";
type FinancialMutationPath = "token" | "connections" | "reconciliation" | "position-links"
  | "category-create" | "category-update" | "transaction-category"
  | "tag-create" | "tag-update" | "transaction-tags"
  | "category-rule-preview" | "category-rule-save" | "category-rule-update";

export async function financialRequest(path: FinancialReadPath): Promise<Response | undefined>;
export async function financialRequest(path: FinancialMutationPath, viewKey: string | null, payload?: object): Promise<Response | undefined>;
export async function financialRequest(path: FinancialReadPath | FinancialMutationPath, viewKey?: string | null, payload?: object) {
  const method = path === "snapshot" || path === "categories" ? "GET" : "POST";
  if (method === "POST" && !await hasTrustedOrigin()) return new Response(null, { status: 403 });
  if (!authEnabled()) return;
  const sessionId = await currentSessionId();
  if (sessionId === undefined) return;
  if (!sessionId) redirect("/acesso", RedirectType.replace);
  if (method === "POST" && !matchesSessionView(sessionId, viewKey)) return new Response(null, { status: 412 });
  const response = await backendRequest(`pluggy/${path}`, method, { sessionId, payload });
  if (response?.status === 401) redirect("/acesso", RedirectType.replace);
  return response;
}
