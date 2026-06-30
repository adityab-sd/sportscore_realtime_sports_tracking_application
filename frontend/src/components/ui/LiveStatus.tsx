"use client";
import { ConnState } from "@/hooks/useSignalR";

export default function LiveStatus({ state, lastUpdate }: { state: ConnState; lastUpdate: Date | null }) {
  const map: Record<ConnState, { dot: string; label: string; color: string }> = {
    connected:    { dot: "#16a34a", label: "Live",          color: "var(--text-secondary)" },
    connecting:   { dot: "#d97706", label: "Connecting",    color: "var(--text-muted)" },
    disconnected: { dot: "#9ca3af", label: "Reconnecting",  color: "var(--text-muted)" },
    error:        { dot: "#9ca3af", label: "Offline",       color: "var(--text-muted)" },
  };
  const s = map[state];
  const time = lastUpdate
    ? lastUpdate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: s.color }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      <span style={{ fontWeight: 600 }}>{s.label}</span>
      {state === "connected" && time && (
        <span style={{ color: "var(--text-muted)" }}>· updated {time}</span>
      )}
    </div>
  );
}
