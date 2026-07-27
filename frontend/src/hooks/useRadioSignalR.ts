"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { RadioAudioEvent } from "@/types/radio";
import { ConnState } from "@/hooks/useSignalR";

// Bounds memory - oldest commentary just falls off once we're holding this many clips.
const MAX_QUEUE = 30;

interface RadioSignalRValue {
  events: RadioAudioEvent[];
  state: ConnState;
  lastUpdate: Date | null;
}

// Deliberately a SEPARATE connection from useSignalR/matchUpdate, mirroring the
// backend split: EventHubToRadioModeFunction reads from its own "radio-mode"
// consumer group and broadcasts to its own hub (radioModeHub), independent of
// the plain score feed. Keeping the two hooks separate on the frontend means a
// slow/looping radio hub reconnect can never affect the scores UI, and vice versa.
export function useRadioSignalR(): RadioSignalRValue {
  const [events, setEvents] = useState<RadioAudioEvent[]>([]);
  const [state, setState] = useState<ConnState>("connecting");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const connRef = useRef<{ stop: () => Promise<void> } | null>(null);

  const appendEvents = useCallback((incoming: RadioAudioEvent[]) => {
    setEvents(prev => {
      const merged = [...prev, ...incoming];
      return merged.length > MAX_QUEUE ? merged.slice(merged.length - MAX_QUEUE) : merged;
    });
    setLastUpdate(new Date());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        setState("connecting");
        // NOTE: this endpoint doesn't exist in the files I've seen yet. It needs to
        // return { url, token } for hub "radioModeHub", the same way /api/signalr-token
        // does for the main hub. See my message for why I didn't invent the server
        // side of this - share that route (or its Function/negotiate equivalent) and
        // I'll wire this to match exactly.
        const res = await fetch("/api/radio-signalr-token");
        if (!res.ok) {
          console.error("[RadioSignalR] Token fetch failed:", res.status);
          if (!cancelled) setState("error");
          return;
        }
        const { url, token } = await res.json();
        if (!url || !token) {
          console.error("[RadioSignalR] Token response missing url or token");
          if (!cancelled) setState("error");
          return;
        }

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

        // Target name must match SIGNALR_TARGET ("radioModeEvent") in
        // EventHubToRadioModeFunction.java's broadcastToSignalR().
        connection.on("radioModeEvent", (incoming: RadioAudioEvent[]) => {
          if (!cancelled && Array.isArray(incoming)) {
            appendEvents(incoming);
          }
        });

        connection.onreconnecting(err => {
          console.warn("[RadioSignalR] Reconnecting...", err?.message);
          if (!cancelled) setState("connecting");
        });
        connection.onreconnected(() => {
          if (!cancelled) setState("connected");
        });
        connection.onclose(err => {
          console.warn("[RadioSignalR] Connection closed", err?.message);
          if (!cancelled) setState("disconnected");
        });

        await connection.start();
        if (cancelled) { await connection.stop(); return; }

        connRef.current = connection;
        setState("connected");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[RadioSignalR] Connection failed:", message);
        if (!cancelled) setState("error");
      }
    }

    connect();
    return () => {
      cancelled = true;
      connRef.current?.stop().catch(() => {});
      connRef.current = null;
    };
  }, [appendEvents]);

  return { events, state, lastUpdate };
}