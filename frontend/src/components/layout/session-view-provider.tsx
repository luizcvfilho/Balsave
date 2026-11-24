"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

const SessionViewContext = createContext<string | null>(null);

export function SessionViewProvider({ viewKey, sync, children }: { viewKey: string | null; sync: boolean; children: ReactNode }) {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!sync) return;

    function reload() {
      setStale(true);
      window.location.reload();
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) reload();
    }

    const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel("balsave-session-view") : undefined;
    if (channel) {
      channel.onmessage = ({ data }) => {
        if (data !== viewKey) reload();
      };
      channel.postMessage(viewKey);
    }
    window.addEventListener("pageshow", onPageShow);
    return () => {
      channel?.close();
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [sync, viewKey]);

  return <SessionViewContext value={viewKey}>
    {stale ? <p className="report-muted" role="status">Atualizando sua sessão…</p> : children}
  </SessionViewContext>;
}

export function useSessionViewKey() {
  return useContext(SessionViewContext);
}
