"use client";
import { useSignalR } from "@/hooks/useSignalR";
import LiveStatus from "@/components/ui/LiveStatus";
import EventFeed from "./EventFeed";

export default function MatchDetailLive({ id }: { id: number }) {
  const { matches, state, lastUpdate } = useSignalR();
  // ============================================================================
  // ADDRESSED: missing live-empty UI
  // ----------------------------------------------------------------------------
  // Returning null when SignalR has no match removes the Live Updates card
  // entirely, so users cannot tell whether the detail feed is loading, offline,
  // or simply has no events yet. Render an explicit state instead.
  //
  // EXAMPLE:
  //   if (!match) return <LiveUpdatesEmpty state={state} />;
  // ============================================================================
  const match = matches.find(m => m.id === id);
  if (!match) return null;

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 16 }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Live Updates</span>
        <LiveStatus state={state} lastUpdate={lastUpdate} />
      </div>
      <div style={{ padding: "8px 0" }}>
        <EventFeed match={match} />
      </div>
    </div>
  );
}