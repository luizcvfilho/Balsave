"use client";

import { useActionState } from "react";
import { signOut } from "../../app/acesso/access-actions";
import { useSessionViewKey } from "./session-view-provider";

export function SignOutForm() {
  const viewKey = useSessionViewKey();
  const [message, submit, pending] = useActionState(signOut.bind(null, viewKey), undefined);
  return (
    <form action={submit}>
      <button className="report-button" type="submit" disabled={pending}>{pending ? "Saindo…" : "Sair"}</button>
      {message && <p className="report-muted" role="alert">{message}</p>}
    </form>
  );
}
