"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  isLocalPreviewHost, newSession, previewCookie, previewPassword, previewRequest, secureEqual, sessionSeconds,
} from "../../data/preview-session";

export async function signIn(_state: string | undefined, form: FormData) {
  const password = form.get("password");
  const expected = previewPassword();
  if (expected.length < 32 || !await isLocalPreviewHost()) {
    return "O acesso a dados reais está disponível apenas na configuração local.";
  }
  if (typeof password !== "string" || password.length > 256 || !secureEqual(password, expected)) {
    return "Senha incorreta. Tente novamente.";
  }
  (await cookies()).set(previewCookie, newSession(), {
    secure: true, httpOnly: true, sameSite: "strict", path: "/", maxAge: sessionSeconds,
  });
  redirect("/");
}

export async function signOut() {
  (await cookies()).set(previewCookie, "", {
    secure: true, httpOnly: true, sameSite: "strict", path: "/", maxAge: 0,
  });
  redirect("/acesso");
}

export async function startConnection() {
  const result = await previewRequest("token");
  if (!result?.ok) return;
  const data: { accessToken?: string; connectorId?: number } = await result.json();
  if (typeof data.accessToken === "string" && Number.isInteger(data.connectorId)) {
    return { accessToken: data.accessToken, connectorId: data.connectorId as number };
  }
}

export async function registerConnection(itemId: string) {
  if (typeof itemId !== "string" || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(itemId)) return false;
  const result = await previewRequest("connections", { itemId });
  return !!result?.ok;
}
