"use client";
import { createContext, useContext, useEffect, useState, useRef, useCallback, createElement, ReactNode } from "react";
import { Match } from "@/types/football";

export type ConnState = "connecting" | "connected" | "disconnected" | "error";

interface SignalRValue {
  matches: Match[];
  state: ConnState;
  lastUpdate: Date | null;
}

const SignalRContext = createContext<SignalRValue>({
  matches: [], state: "connecting", lastUpdate: null,
});

// ADDRESSED: Observer (GoF) [already correct — keep this]
// This is a clean Observer implementation: connection.on("matchUpdate", ...) is the
// subscription, and components read via useSignalR() and re-render on each push.
// Nothing structural to change.
export function SignalRProvider({ children }: { children: ReactNode }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [state, setState] = useState<ConnState>("connecting");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const connRef = useRef<{ stop: () => Promise<void> } | null>(null);

  const mergeMatches = useCallback((incoming: Match[]) => {
    setMatches(prev => {
      const byId = new Map<number, Match>();
      for (const m of prev) byId.set(m.id, m);
      for (const m of incoming) byId.set(m.id, m);
      return Array.from(byId.values());
    });
    setLastUpdate(new Date());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        setState("connecting");
        const res = await fetch("/api/signalr-token");
        if (!res.ok) {
          console.error("[SignalR] Token fetch failed:", res.status);
          if (!cancelled) setState("error");
          return;
        }
        const { url, token } = await res.json();
        if (!url || !token) {
          console.error("[SignalR] Token response missing url or token");
          if (!cancelled) setState("error");
          return;
        }

        // ADDRESSED: SECURITY — removed console.log lines that printed the SignalR
        // access JWT (url + token) into the browser console. Credentials must never
        // be logged where users or extensions can read them.

        const signalR = await import("@microsoft/signalr");

        const connection = new signalR.HubConnectionBuilder()
          .withUrl(url, {
            accessTokenFactory: () => token,
            skipNegotiation: true,
            transport: signalR.HttpTransportType.WebSockets,
          })
          .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
          .configureLogging(signalR.LogLevel.Information)
          .build();

        connection.on("matchUpdate", (incoming: Match[]) => {
          if (!cancelled && Array.isArray(incoming)) {
            mergeMatches(incoming);
          }
        });

        connection.onreconnecting(err => {
          console.warn("[SignalR] Reconnecting...", err?.message);
          if (!cancelled) setState("connecting");
        });
        connection.onreconnected(id => {
          console.log("[SignalR] Reconnected, id:", id);
          if (!cancelled) setState("connected");
        });
        connection.onclose(err => {
          console.warn("[SignalR] Connection closed", err?.message);
          if (!cancelled) setState("disconnected");
        });

        await connection.start();
        if (cancelled) { await connection.stop(); return; }

        console.log("[SignalR] Connected successfully");
        connRef.current = connection;
        setState("connected");

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[SignalR] Connection failed:", message);
        if (!cancelled) setState("error");
      }
    }

    connect();
    return () => {
      cancelled = true;
      connRef.current?.stop().catch(() => {});
      connRef.current = null;
    };
  }, [mergeMatches]);

  return createElement(SignalRContext.Provider, { value: { matches, state, lastUpdate } }, children);
}

export function useSignalR(): SignalRValue {
  return useContext(SignalRContext);
}
