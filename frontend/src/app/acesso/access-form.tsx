"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { registerAccount, signIn } from "./access-actions";
import styles from "./access.module.css";

export function AccessForm({ registering }: { registering: boolean }) {
  const [message, submit, pending] = useActionState(registering ? registerAccount : signIn, undefined);
  const [email, setEmail] = useState("");
  const label = registering ? "Criar conta" : "Entrar";
  const pendingLabel = registering ? "Criando conta…" : "Entrando…";
  return (
    <form action={submit} className={styles.form}>
      {registering && (
        <label className="report-field">
          <span>Nome</span>
          <input name="name" autoComplete="name" maxLength={120} required />
        </label>
      )}
      <label className="report-field">
        <span>E-mail</span>
        <input
          type="email"
          name="email"
          value={email}
          onChange={event => setEmail(event.target.value)}
          autoComplete={registering ? "email" : "username"}
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          required
        />
      </label>
      <label className="report-field">
        <span>Senha</span>
        <input
          type="password"
          name="password"
          autoComplete={registering ? "new-password" : "current-password"}
          required
        />
      </label>
      <button type="submit" className="report-button" disabled={pending}>
        {pending ? pendingLabel : label}
      </button>
      {message && <p role="alert" className={styles.hint}>{message}</p>}
      <Link className="report-link report-action" href={registering ? "/acesso" : "/acesso?modo=cadastro"}>
        {registering ? "Já tenho conta" : "Criar conta"}
      </Link>
    </form>
  );
}
