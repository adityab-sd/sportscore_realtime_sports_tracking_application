"use client";
import { useState } from "react";
import { useSignalR } from "@/hooks/useSignalR";
import { Match, classifyStatus } from "@/types/football";
import MatchCard from "./MatchCard";
import LiveStatus from "@/components/ui/LiveStatus";

type Filter = "all" | "live" | "scheduled" | "finished";

/**
 * Live match list driven by the SignalR push feed.
 * `seed` is server-rendered data (if the backend ever exposes a REST snapshot);
 * SignalR updates merge on top so the first paint is never empty if a seed exists.
 */
export default function LiveFootball({ seed = [] }: { seed?: Match[] }) {
  const { matches: live, state, lastUpdate } = useSignalR();
  const [filter, setFilter] = useState<Filter>("all");

  // merge seed + live (live wins on id collision)
  const byId = new Map<number, Match>();
  for (const m of seed) byId.set(m.id, m);
  for (const m of live) byId.set(m.id, m);
  const all = Array.from(byId.values());

  const liveM = all.filter(m => classifyStatus(m.status) === "live");
  const sched = all.filter(m => classifyStatus(m.status) === "scheduled");
  const fin = all.filter(m => classifyStatus(m.status) === "finished");
  const counts = { all: all.length, live: liveM.length, scheduled: sched.length, finished: fin.length };

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" }, { key: "live", label: "Live" },
    { key: "scheduled", label: "Scheduled" }, { key: "finished", label: "Finished" },
  ];

  const showLive = filter === "all" || filter === "live";
  const showSched = filter === "all" || filter === "scheduled";
  const showFin = filter === "all" || filter === "finished";

  const waiting = all.length === 0 && (state === "connecting" || state === "connected");

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {filters.map(f => (
            <button key={f.key} className={`pill${filter === f.key ? " active" : ""}`} onClick={() => setFilter(f.key)}>
              {f.key === "live" && counts.live > 0 && (
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: filter === f.key ? "#fff" : "#ff4d4d" }} />
              )}
              {f.label}
              <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.6 }}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <LiveStatus state={state} lastUpdate={lastUpdate} />
      </div>

      {waiting && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
          <div style={{ width: 32, height: 32, margin: "0 auto 14px", border: "3px solid var(--border)", borderTopColor: "var(--navy)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <p style={{ fontSize: 14, margin: 0 }}>Waiting for live match data…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!waiting && all.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
          <p style={{ fontSize: 14, margin: "0 0 6px", fontWeight: 600, color: "var(--text-secondary)" }}>No live matches right now</p>
          <p style={{ fontSize: 13, margin: 0 }}>The feed is connected - matches appear here as they kick off.</p>
        </div>
      )}

      {showLive && liveM.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <div className="section-label"><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff4d4d" }} />Live Now</div>
          <div className="matches-grid">{liveM.map(m => <MatchCard key={m.id} match={m} />)}</div>
        </section>
      )}
      {showSched && sched.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <div className="section-label">Scheduled</div>
          <div className="matches-grid">{sched.map(m => <MatchCard key={m.id} match={m} />)}</div>
        </section>
      )}
      {showFin && fin.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <div className="section-label">Finished</div>
          <div className="matches-grid">{fin.map(m => <MatchCard key={m.id} match={m} />)}</div>
        </section>
      )}
    </div>
  );
}
