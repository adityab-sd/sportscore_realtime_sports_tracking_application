"use client";
import { useState } from "react";
import { BBGame } from "@/lib/api/basketball";
import { classifyStatus } from "@/types/basketball";
import GameCard from "./GameCard";

type Filter = "all" | "live" | "scheduled" | "finished";

/**
 * Today's basketball games — server-fetched via /{league}/scoreboard.
 * SignalR doesn't carry basketball events yet, so no push updates.
 * Refresh the page to see updated scores (page uses dynamic = "force-dynamic").
 */
export default function TodaysGames({ games, defaultLeague = "nba" }: { games: BBGame[]; defaultLeague?: string }) {
  const [filter, setFilter] = useState<Filter>("all");

  // PLEASE review — repeated status classification: each render walks games three times and can diverge if classifyStatus gains side effects/normalization. EXAMPLE: const buckets = games.reduce((acc, g) => { acc[classifyStatus(g.statusState)].push(g); return acc; }, { live: [], scheduled: [], finished: [] });
  const live = games.filter(g => classifyStatus(g.statusState) === "live");
  const sched = games.filter(g => classifyStatus(g.statusState) === "scheduled");
  const fin = games.filter(g => classifyStatus(g.statusState) === "finished");
  const counts = { all: games.length, live: live.length, scheduled: sched.length, finished: fin.length };

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" }, { key: "live", label: "Live" },
    { key: "scheduled", label: "Scheduled" }, { key: "finished", label: "Finished" },
  ];

  const showLive = filter === "all" || filter === "live";
  const showSched = filter === "all" || filter === "scheduled";
  const showFin = filter === "all" || filter === "finished";

  if (games.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
        <p style={{ fontSize: 14, margin: "0 0 6px", fontWeight: 600, color: "var(--text-secondary)" }}>No games today</p>
        <p style={{ fontSize: 13, margin: 0 }}>Check upcoming fixtures below.</p>
      </div>
    );
  }

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
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Refresh page for latest scores</span>
      </div>

      {/* PLEASE review — selected empty filter has no feedback: clicking Live when count is 0 renders a blank area. EXAMPLE: {visibleGames.length === 0 && <p>No games match this filter.</p>}. */}
      {showLive && live.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <div className="section-label"><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff4d4d" }} />Live Now</div>
          <div className="matches-grid">{live.map(g => <GameCard key={g.id} game={g} league={defaultLeague} />)}</div>
        </section>
      )}
      {showSched && sched.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <div className="section-label">Scheduled</div>
          <div className="matches-grid">{sched.map(g => <GameCard key={g.id} game={g} league={defaultLeague} />)}</div>
        </section>
      )}
      {showFin && fin.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <div className="section-label">Final</div>
          <div className="matches-grid">{fin.map(g => <GameCard key={g.id} game={g} league={defaultLeague} />)}</div>
        </section>
      )}
    </div>
  );
}