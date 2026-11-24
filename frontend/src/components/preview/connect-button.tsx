"use client";

import Script from "next/script";
import { useState } from "react";
import { useSessionViewKey } from "../layout/session-view-provider";
import { registerConnection, startConnection } from "./actions";

type WidgetOptions = {
  connectToken: string;
  connectorIds: number[];
  selectedConnectorId: number;
  language: string;
  products: string[];
  onSuccess: (data: { item: { id: string } }) => Promise<void>;
  onOpen: () => void;
  onClose: () => void;
  onError: () => void;
};

declare global {
  interface Window {
    PluggyConnect?: new (options: WidgetOptions) => { init: () => void };
  }
}

export function ConnectButton() {
  const viewKey = useSessionViewKey();
  const [ready, setReady] = useState(false);
  const [opening, setOpening] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(0);
  const [message, setMessage] = useState("");

  async function connect() {
    setOpening(true);
    setMessage("Abrindo o Meu Pluggy…");
    try {
      const session = await startConnection(viewKey);
      if (session?.rateLimited) {
        setOpening(false);
        setMessage("Limite de tentativas de conexão atingido. Aguarde alguns minutos e tente novamente.");
        return;
      }
      if (!session || !window.PluggyConnect) throw new Error("Could not initialize Pluggy Connect.");
      const widget = new window.PluggyConnect({
        connectToken: session.accessToken,
        connectorIds: [session.connectorId],
        selectedConnectorId: session.connectorId,
        language: "pt",
        products: ["ACCOUNTS", "CREDIT_CARDS", "TRANSACTIONS"],
        onSuccess: async ({ item }) => {
          setPending(count => count + 1);
          setMessage("Salvando conexão…");
          try {
            if (!await registerConnection(viewKey, item.id)) throw new Error("Could not register the connection.");
            setSaved(true);
            setMessage("Conexão adicionada.");
          } catch {
            setMessage("Não foi possível salvar a conexão. Tente conectar novamente.");
          } finally {
            setPending(count => count - 1);
          }
        },
        onOpen: () => setMessage(""),
        onClose: () => {
          setOpening(false);
          setMessage(current => current === "Abrindo o Meu Pluggy…" ? "" : current);
        },
        onError: () => {
          setOpening(false);
          setMessage("O Meu Pluggy não concluiu a conexão. Tente novamente.");
        },
      });
      widget.init();
    } catch {
      setOpening(false);
      setMessage("Não foi possível abrir o Meu Pluggy. Verifique a configuração e tente novamente.");
    }
  }

  return (
    <>
      <Script
        src="https://cdn.pluggy.ai/pluggy-connect/v2.8.2/pluggy-connect.js"
        onReady={() => setReady(true)}
        onError={() => setMessage("Não foi possível carregar o Meu Pluggy. Recarregue a página para tentar novamente.")}
      />
      <p className="report-muted">Entre no Meu Pluggy para autorizar o Balsave a consultar os bancos que você já conectou.</p>
      <div className="report-filters">
        <button type="button" className="report-button" disabled={!ready || opening || pending > 0} onClick={connect}>
          Conectar com Meu Pluggy
        </button>
        {saved && pending === 0 && (
          <button type="button" className="report-button" onClick={() => window.location.assign("/")}>
            Ver dados no painel
          </button>
        )}
      </div>
      {message && <p className="report-muted" role="status">{message}</p>}
    </>
  );
}
