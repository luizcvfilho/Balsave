"use server";

import { redirect, RedirectType } from "next/navigation";
import { revokeSession, sendCredentials } from "../../data/session";

async function authenticate(mode: "register" | "login", form: FormData) {
  const emailField = form instanceof FormData ? form.get("email") : null;
  const password = form instanceof FormData ? form.get("password") : null;
  const nameField = mode === "register" && form instanceof FormData ? form.get("name") : "";
  const invalid = mode === "register"
    ? "Informe seu nome, um e-mail válido e uma senha."
    : "E-mail ou senha inválidos.";
  if (typeof emailField !== "string" || typeof password !== "string" || typeof nameField !== "string") return invalid;
  const email = emailField.trim().toLowerCase();
  const name = nameField.trim();
  if (!email || email.length > 254 || !password || (mode === "register" && (!name || name.length > 120))) {
    return invalid;
  }

  const status = await sendCredentials(mode, { email, password, name });
  if (status === 200) redirect("/", RedirectType.replace);
  if (status === 401 || status === 400 || status === 422) return invalid;
  if (status === 409) return "Este e-mail já está cadastrado.";
  if (status === 429) return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (status === 403) return "Abra o Balsave pelo endereço configurado e tente novamente.";
  return "Não foi possível acessar sua conta. Tente novamente em instantes.";
}

export async function signIn(_state: string | undefined, form: FormData) {
  return authenticate("login", form);
}

export async function registerAccount(_state: string | undefined, form: FormData) {
  return authenticate("register", form);
}

export async function signOut(viewKey: string | null) {
  const result = await revokeSession(viewKey);
  if (result === "changed") return "Sua sessão mudou. Recarregue a página e tente novamente.";
  if (result === "unavailable") return "Não foi possível sair da sua conta. Tente novamente.";
  redirect("/acesso", RedirectType.replace);
}
