"use client";
import Link from "next/link";
import { useSignalR } from "@/hooks/useSignalR";
import { classifyStatus } from "@/types/football";
import MatchCard from "./MatchCard";
import LiveStatus from "@/components/ui/LiveStatus";

export default function HomeLiveStrip() {
  const { matches: allMatches, state, lastUpdate } = useSignalR();
  // Filter to football only - backend publishes basketball + cricket on the same hub.
  const matches = allMatches.filter(m => !m.sport || m.sport === "football");
  const live = matches.filter(m => classifyStatus(m.status) === "live");
  const upcoming = matches.filter(m => classifyStatus(m.status) === "scheduled").slice(0, 4);
  const strip = [...live, ...upcoming].slice(0, 6);

  // ============================================================================
  // PLEASE review — disconnected live empty state
  // ----------------------------------------------------------------------------
  // When SignalR is disconnected and there are no cached matches, this returns
  // null, so the home page gives no indication that the football feed is offline.
  // A compact unavailable state is safer than hiding real-time UI entirely.
  //
  // EXAMPLE:
  //   if (strip.length === 0 && state === "disconnected") return <p>Live feed unavailable.</p>;
  // ============================================================================
  // hide the whole section until there's something or we're actively connected
  if (strip.length === 0 && state !== "connected" && state !== "connecting") return null;

  return (
    <section style={{ paddingTop: 32, paddingBottom: 8 }}>
      <div className="container">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
          <div className="section-label" style={{ marginBottom: 0 }}>
            {live.length > 0 && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff4d4d" }} />}
            {live.length > 0 ? "Live & Upcoming" : "Match Feed"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <LiveStatus state={state} lastUpdate={lastUpdate} />
            <Link href="/football" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>All matches →</Link>
          </div>
        </div>
        {strip.length > 0 ? (
          <div className="matches-grid">{strip.map(m => <MatchCard key={m.id} match={m} />)}</div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>No live matches at the moment - they&apos;ll appear here as they kick off.</p>
        )}
      </div>
    </section>
  );
}