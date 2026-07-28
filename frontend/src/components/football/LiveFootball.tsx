"use client";
import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useSignalR } from "@/hooks/useSignalR";
import { Match, classifyStatus, leagueByName } from "@/types/football";
import MatchCard from "./MatchCard";
import LeagueBanner from "./LeagueBanner";
import LiveStatus from "@/components/ui/LiveStatus";

type Filter = "all" | "live" | "scheduled" | "finished";
const PREVIEW_PER_LEAGUE = 4;
const WINDOW_SIZE = 7;

function slugForCompetition(name: string): string | null {
  return leagueByName(name)?.slug ?? null;
}

function groupByLeague(matches: Match[]): { name: string; slug: string | null; matches: Match[] }[] {
  const buckets = new Map<string, Match[]>();
  for (const m of matches) {
    const key = m.competition || "Other";
    const arr = buckets.get(key) ?? [];
    arr.push(m);
    buckets.set(key, arr);
  }
  return Array.from(buckets.entries()).map(([name, matches]) => ({ name, slug: slugForCompetition(name), matches }));
}

function LeagueGroup({ name, slug, matches }: { name: string; slug: string | null; matches: Match[] }) {
  const visible = matches.slice(0, PREVIEW_PER_LEAGUE);
  const hidden = matches.length - visible.length;
  return (
    <div style={{ marginBottom: 22 }}>
      <LeagueBanner name={name} slug={slug} />
      <div className="matches-grid">
        {visible.map(m => <MatchCard key={m.id} match={m} />)}
      </div>
      {hidden > 0 && slug && (
        <div style={{ marginTop: 8 }}>
          <Link href={`/football/league/${slug}`} style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", textDecoration: "none" }}>
            + {hidden} more in {name} →
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function startOfDayLocal(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function pillLabel(d: Date, today: Date): string {
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === -1) return "Yesterday";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-US", { day: "2-digit", weekday: "short" }).replace(",", "");
}

function isSameDay(kickoff: string | null, date: Date): boolean {
  if (!kickoff) return false;
  const t = Date.parse(kickoff);
  if (!Number.isFinite(t)) return false;
  const k = new Date(t);
  return k.getFullYear() === date.getFullYear() &&
    k.getMonth() === date.getMonth() &&
    k.getDate() === date.getDate();
}

// ─── DatePicker ───────────────────────────────────────────────────────────────
function DatePicker({ selected, onSelect }: { selected: Date; onSelect: (d: Date) => void }) {
  const today = startOfDayLocal(new Date());
  // Window offset in multiples of 7 — starts at -1 so yesterday is first pill
  const [windowStart, setWindowStart] = useState<Date>(() => addDays(today, -1));
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pills = useMemo(() => {
    return Array.from({ length: WINDOW_SIZE }, (_, i) => addDays(windowStart, i));
  }, [windowStart]);

  const monthLabel = (() => {
    const months = pills.map(p => p.toLocaleDateString("en-US", { month: "long", year: "numeric" }));
    const unique = [...new Set(months)];
    return unique.length === 1 ? unique[0] : unique.join(" / ");
  })();

  const isToday = toKey(selected) === toKey(today);

  function shift(dir: "left" | "right") {
    setSlideDir(dir);
    if (animRef.current) clearTimeout(animRef.current);
    animRef.current = setTimeout(() => {
      setWindowStart(prev => addDays(prev, dir === "right" ? WINDOW_SIZE : -WINDOW_SIZE));
      setSlideDir(null);
    }, 180);
  }

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Month + return to today */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, justifyContent: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
          {monthLabel}
        </span>
        {!isToday && (
          <button onClick={() => { onSelect(today); setWindowStart(addDays(today, -1)); }}
            style={{ fontSize: 12, fontWeight: 600, color: "var(--navy)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
            · Return to today
          </button>
        )}
      </div>

      {/* Pill row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", overflow: "hidden" }}>
        {/* Left arrow */}
        <button onClick={() => shift("left")}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--text-secondary)", padding: "0 4px", flexShrink: 0, lineHeight: 1 }}>
          ‹
        </button>

        {/* Pills */}
        <div style={{
          display: "flex", gap: 6,
          transition: "transform 0.18s ease, opacity 0.18s ease",
          transform: slideDir === "right" ? "translateX(-20px)" : slideDir === "left" ? "translateX(20px)" : "translateX(0)",
          opacity: slideDir ? 0 : 1,
        }}>
          {pills.map(d => {
            const key = toKey(d);
            const isSelected = key === toKey(selected);
            const label = pillLabel(d, today);
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;

            return (
              <button key={key} onClick={() => onSelect(d)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  width: 72, height: 52, borderRadius: 8, cursor: "pointer", flexShrink: 0,
                  border: isSelected ? "2px solid var(--navy)" : "1px solid var(--border)",
                  background: isSelected ? "var(--navy)" : "var(--white)",
                  color: isSelected ? "#fff" : isWeekend ? "var(--text-secondary)" : "var(--obsidian)",
                  transition: "all 0.15s ease",
                  transform: isSelected ? "translateY(-1px)" : "translateY(0)",
                  boxShadow: isSelected ? "0 4px 12px rgba(var(--navy-rgb, 30,58,138), 0.25)" : "none",
                }}>
                <span style={{ fontSize: label.length > 8 ? 9 : 11, fontWeight: 700, lineHeight: 1.2 }}>
                  {label.split(" ")[0]}
                </span>
                {label.split(" ")[1] && (
                  <span style={{ fontSize: 9, fontWeight: 500, opacity: 0.7, lineHeight: 1.2 }}>
                    {label.split(" ")[1]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right arrow */}
        <button onClick={() => shift("right")}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--text-secondary)", padding: "0 4px", flexShrink: 0, lineHeight: 1 }}>
          ›
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LiveFootball({ seed = [] }: { seed?: Match[] }) {
  const { matches: live, state, lastUpdate } = useSignalR();
  const [filter, setFilter] = useState<Filter>("all");
  const today = startOfDayLocal(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  // Merge seed + live
  const byId = new Map<number, Match>();
  for (const m of seed) byId.set(m.id, m);
  for (const m of live) byId.set(m.id, m);
  const all = Array.from(byId.values()).filter(m => !m.sport || m.sport === "football");

  // Filter by date
  const dated = all.filter(m => isSameDay(m.kickoff, selectedDate));

  const liveM = dated.filter(m => classifyStatus(m.status) === "live");
  const sched = dated.filter(m => classifyStatus(m.status) === "scheduled");
  const fin   = dated.filter(m => classifyStatus(m.status) === "finished");
  const counts = { all: dated.length, live: liveM.length, scheduled: sched.length, finished: fin.length };

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" }, { key: "live", label: "Live" },
    { key: "scheduled", label: "Scheduled" }, { key: "finished", label: "Finished" },
  ];

  const showLive  = filter === "all" || filter === "live";
  const showSched = filter === "all" || filter === "scheduled";
  const showFin   = filter === "all" || filter === "finished";
  const waiting = all.length === 0 && state === "connecting";
  const selectedKey = toKey(selectedDate);

  return (
    <div>
      <DatePicker selected={selectedDate} onSelect={setSelectedDate} />

      {/* Filters + status */}
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

      {/* Content — keyed so it fades on date change */}
      <div key={selectedKey} style={{ animation: "fadein 0.2s ease" }}>
        {waiting && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
            <div style={{ width: 32, height: 32, margin: "0 auto 14px", border: "3px solid var(--border)", borderTopColor: "var(--navy)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <p style={{ fontSize: 14, margin: 0 }}>Waiting for live match data…</p>
          </div>
        )}

        {!waiting && dated.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-secondary)", margin: "0 0 6px" }}>No fixtures on this day</p>
            <p style={{ fontSize: 13, margin: 0 }}>There are no scheduled or completed matches for this date.</p>
          </div>
        )}

        {showLive && liveM.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <div className="section-label">
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff4d4d" }} />Live Now
            </div>
            <div className="matches-grid">{liveM.map(m => <MatchCard key={m.id} match={m} />)}</div>
          </section>
        )}

        {showSched && sched.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <div className="section-label">Scheduled</div>
            {groupByLeague(sched).map(g => <LeagueGroup key={`s-${g.name}`} {...g} />)}
          </section>
        )}

        {showFin && fin.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <div className="section-label">Finished</div>
            {groupByLeague(fin).map(g => <LeagueGroup key={`f-${g.name}`} {...g} />)}
          </section>
        )}
      </div>

      <style>{`
        @keyframes fadein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}