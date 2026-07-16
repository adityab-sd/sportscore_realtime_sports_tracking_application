"use client";
import { useState } from "react";
import Link from "next/link";
import { useSignalR } from "@/hooks/useSignalR";
import { Match, classifyStatus, leagueByName } from "@/types/football";
import MatchCard from "./MatchCard";
import LeagueBanner from "./LeagueBanner";
import LiveStatus from "@/components/ui/LiveStatus";

type Filter = "all" | "live" | "scheduled" | "finished";

const PREVIEW_PER_LEAGUE = 4;

/** Map competition name → known league slug (mirrors slugFromCompetition in MatchCard). */
function slugForCompetition(name: string): string | null {
  return leagueByName(name)?.slug ?? null;
}

/** Group matches by competition name, preserving discovery order. */
function groupByLeague(matches: Match[]): { name: string; slug: string | null; matches: Match[] }[] {
  const buckets = new Map<string, Match[]>();
  for (const m of matches) {
    const key = m.competition || "Other";
    const arr = buckets.get(key) ?? [];
    arr.push(m);
    buckets.set(key, arr);
  }
  return Array.from(buckets.entries()).map(([name, matches]) => ({
    name,
    slug: slugForCompetition(name),
    matches,
  }));
}

/** Renders a league banner + up to N matches + "+ N more →" link when truncated. */
function LeagueGroup({ name, slug, matches }: { name: string; slug: string | null; matches: Match[] }) {
  const visible = matches.slice(0, PREVIEW_PER_LEAGUE);
  const hidden  = matches.length - visible.length;

  return (
    <div style={{ marginBottom: 22 }}>
      <LeagueBanner name={name} slug={slug} />
      <div className="matches-grid">
        {visible.map(m => <MatchCard key={m.id} match={m} />)}
      </div>
      {hidden > 0 && slug && (
        <div style={{ marginTop: 8 }}>
          <Link href={`/football/league/${slug}`} style={{
            fontSize: 12, fontWeight: 500, color: "var(--text-muted)", textDecoration: "none",
          }}>
            + {hidden} more in {name} →
          </Link>
        </div>
      )}
    </div>
  );
}

export default function LiveFootball({ seed = [] }: { seed?: Match[] }) {
  const { matches: live, state, lastUpdate } = useSignalR();
  const [filter, setFilter] = useState<Filter>("all");

  // merge seed + live (live wins on id collision)
  const byId = new Map<number, Match>();
  for (const m of seed) byId.set(m.id, m);
  for (const m of live) byId.set(m.id, m);

  // Filter to football only - backend pushes basketball + cricket through the same SignalR hub.
  const all = Array.from(byId.values()).filter(m => !m.sport || m.sport === "football");

  const liveM = all.filter(m => classifyStatus(m.status) === "live");
  const sched = all.filter(m => classifyStatus(m.status) === "scheduled");
  const fin   = all.filter(m => classifyStatus(m.status) === "finished");
  const counts = { all: all.length, live: liveM.length, scheduled: sched.length, finished: fin.length };

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" }, { key: "live", label: "Live" },
    { key: "scheduled", label: "Scheduled" }, { key: "finished", label: "Finished" },
  ];

  const showLive  = filter === "all" || filter === "live";
  const showSched = filter === "all" || filter === "scheduled";
  const showFin   = filter === "all" || filter === "finished";

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

      {/* Live stays ungrouped: usually few matches, and they should stand out. */}
      {showLive && liveM.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <div className="section-label"><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff4d4d" }} />Live Now</div>
          <div className="matches-grid">{liveM.map(m => <MatchCard key={m.id} match={m} />)}</div>
        </section>
      )}

      {/* Scheduled grouped by league with previews + view-full-league links */}
      {showSched && sched.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <div className="section-label">Scheduled</div>
          {groupByLeague(sched).map(g => (
            <LeagueGroup key={`s-${g.name}`} {...g} />
          ))}
        </section>
      )}

      {/* Finished grouped by league */}
      {showFin && fin.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <div className="section-label">Finished</div>
          {groupByLeague(fin).map(g => (
            <LeagueGroup key={`f-${g.name}`} {...g} />
          ))}
        </section>
      )}
    </div>
  );
}