"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export function LoginForm() {
  const [message, submit, pending] = useActionState(signIn, undefined);
  return (
    <form action={submit}>
      <div className="report-filters">
        <label className="report-field">
          <span>Senha de acesso</span>
          <input type="password" name="password" autoComplete="current-password" maxLength={256} required />
        </label>
        <button type="submit" className="report-button" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
      </div>
      {message && <p role="alert" className="report-muted">{message}</p>}
    </form>
  );
}
