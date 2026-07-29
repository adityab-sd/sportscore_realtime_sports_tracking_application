"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useSignalR } from "@/hooks/useSignalR";
import { Match, classifyStatus, leagueByName, LEAGUES } from "@/types/football";
import { getFixturesByDate, type ESPNFixture } from "@/lib/api/espn";
import MatchCard from "./MatchCard";
import LeagueBanner from "./LeagueBanner";
import LiveStatus from "@/components/ui/LiveStatus";

type Filter = "all" | "live" | "scheduled" | "finished";
const PREVIEW_PER_LEAGUE = 4;
const WINDOW_SIZE = 7;

function slugForCompetition(name: string): string | null {
  return leagueByName(name)?.slug ?? null;
}

function mapFixtures(fx: { results: ESPNFixture[]; upcoming: ESPNFixture[] }, slug: string): Match[] {
  const name = LEAGUES.find(l => l.slug === slug)?.name;
  return [...fx.results, ...fx.upcoming].map(f => ({
    id: Number(f.id),
    sport: "football" as const,
    leagueSlug: slug,
    status: f.status,
    elapsed: null,
    kickoff: f.kickoff,
    competition: f.competition || name || "",
    homeTeam: { id: Number(f.homeTeam.id), name: f.homeTeam.name, shortName: f.homeTeam.shortName, logo: f.homeTeam.logo },
    awayTeam: { id: Number(f.awayTeam.id), name: f.awayTeam.name, shortName: f.awayTeam.shortName, logo: f.awayTeam.logo },
    homeScore: f.homeScore,
    awayScore: f.awayScore,
    events: [],
  }));
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
        {visible.map(m => <MatchCard key={m.id} match={m} league={m.leagueSlug ?? slug} />)}
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
function isSameDayDates(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function friendlyLabel(d: Date): string {
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);
  if (isSameDayDates(d, today)) return "Today";
  if (isSameDayDates(d, tomorrow)) return "Tomorrow";
  if (isSameDayDates(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const CAL_WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ─── DatePicker — pills on desktop, calendar on mobile ──────────────────────
function DatePicker({ selected, onSelect }: { selected: Date; onSelect: (d: Date) => void }) {
  const today = startOfDayLocal(new Date());
  const [windowStart, setWindowStart] = useState<Date>(() => addDays(today, -1));
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mobile calendar state
  const [calOpen, setCalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [viewMonth, setViewMonth] = useState(selected.getMonth());
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const calRef = useRef<HTMLDivElement>(null);

  // Track viewport
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => { setIsMobile(e.matches); if (!e.matches) setCalOpen(false); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Close calendar on outside click
  useEffect(() => {
    if (!calOpen) return;
    const handler = (e: MouseEvent) => {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setCalOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [calOpen]);

  // Sync calendar view month when selection changes
  useEffect(() => {
    setViewMonth(selected.getMonth());
    setViewYear(selected.getFullYear());
  }, [selected]);

  const pills = useMemo(() => Array.from({ length: WINDOW_SIZE }, (_, i) => addDays(windowStart, i)), [windowStart]);

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

  const prevDay = () => { const d = addDays(selected, -1); onSelect(d); };
  const nextDay = () => { const d = addDays(selected, 1); onSelect(d); };

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  // Build calendar grid (Mon-start)
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startDay = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();
  const cells: { day: number; month: number; year: number; outside: boolean }[] = [];
  for (let i = startDay - 1; i >= 0; i--) {
    const pm = viewMonth === 0 ? 11 : viewMonth - 1;
    const py = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ day: daysInPrev - i, month: pm, year: py, outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, month: viewMonth, year: viewYear, outside: false });
  while (cells.length % 7 !== 0) {
    const nm = viewMonth === 11 ? 0 : viewMonth + 1;
    const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ day: cells.length - startDay - daysInMonth + 1, month: nm, year: ny, outside: true });
  }

  return (
    <div style={{ marginBottom: 20 }}>
      {/* ── DESKTOP: pill strip (hidden on mobile) ────────────────────── */}
      <div className="dp-desktop">
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

        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", overflow: "hidden" }}>
          <button onClick={() => shift("left")}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--text-secondary)", padding: "0 4px", flexShrink: 0, lineHeight: 1 }}>‹</button>

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

          <button onClick={() => shift("right")}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--text-secondary)", padding: "0 4px", flexShrink: 0, lineHeight: 1 }}>›</button>
        </div>
      </div>

      {/* ── MOBILE: compact bar + calendar dropdown (hidden on desktop) ── */}
      <div className="dp-mobile" ref={calRef} style={{ position: "relative" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 0,
          background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10,
          overflow: "hidden", userSelect: "none",
        }}>
          <button onClick={prevDay} aria-label="Previous day" style={mobileNavBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button onClick={() => setCalOpen(o => !o)} style={{
            ...mobileNavBtn, flex: 1, minWidth: 130, fontSize: 14, fontWeight: 700, gap: 6,
            color: "var(--obsidian)", justifyContent: "center",
          }} suppressHydrationWarning>
            {friendlyLabel(selected)}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.45, transform: calOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}><polyline points="6 9 12 15 18 9" /></svg>
          </button>
          <button onClick={nextDay} aria-label="Next day" style={mobileNavBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        {/* Calendar dropdown */}
        {calOpen && (
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 30,
            background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14,
            boxShadow: "0 12px 36px rgba(0,0,0,0.14)", padding: "16px 14px 12px",
            animation: "dp-cal-in 0.15s ease",
          }}>
            {/* Month header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--obsidian)" }}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={prevMonth} aria-label="Previous month" style={calArrowBtn}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <button onClick={nextMonth} aria-label="Next month" style={calArrowBtn}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              </div>
            </div>

            {/* Weekday headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 0, marginBottom: 4 }}>
              {CAL_WEEKDAYS.map((w, i) => (
                <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", padding: "4px 0" }}>{w}</div>
              ))}
            </div>

            {/* Day grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
              {cells.map((c, i) => {
                const cellDate = new Date(c.year, c.month, c.day);
                const isTodayCell = isSameDayDates(cellDate, today);
                const isSelectedCell = isSameDayDates(cellDate, selected);
                return (
                  <button
                    key={i}
                    onClick={() => { onSelect(startOfDayLocal(cellDate)); setCalOpen(false); }}
                    style={{
                      width: "100%", aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: isSelectedCell || isTodayCell ? 700 : 400, border: "none", cursor: "pointer",
                      borderRadius: 8, transition: "background 0.1s",
                      background: isSelectedCell ? "var(--navy)" : "transparent",
                      color: isSelectedCell ? "#fff" : c.outside ? "var(--text-muted)" : isTodayCell ? "var(--navy)" : "var(--obsidian)",
                      outline: isTodayCell && !isSelectedCell ? "2px solid var(--navy)" : "none",
                      outlineOffset: -2,
                    }}
                  >
                    {c.day}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
              <button onClick={() => { onSelect(today); setCalOpen(false); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "4px 8px", color: "var(--navy)" }}>
                Today
              </button>
              <button onClick={() => setCalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "4px 8px", color: "var(--text-muted)" }}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        /* Desktop: show pills, hide mobile bar */
        .dp-desktop { display: block; }
        .dp-mobile  { display: none; }
        @media (max-width: 720px) {
          .dp-desktop { display: none; }
          .dp-mobile  { display: block; }
        }
        @keyframes dp-cal-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const mobileNavBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "10px 14px", background: "none", border: "none", cursor: "pointer",
  color: "var(--text-secondary)", transition: "background 0.1s",
};
const calArrowBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 28, height: 28, borderRadius: 6, background: "var(--cloud)",
  border: "none", cursor: "pointer", color: "var(--text-secondary)",
};


// ─── Main component ───────────────────────────────────────────────────────────
export default function LiveFootball({ seed = [] }: { seed?: Match[] }) {
  const { matches: live, state, lastUpdate } = useSignalR();
  const [filter, setFilter] = useState<Filter>("all");
  const today = startOfDayLocal(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const selectedKey = toKey(selectedDate);
  const isViewingToday = selectedKey === toKey(today);

  const [dayMatches, setDayMatches] = useState<Match[] | null>(null);
  const [loadingDay, setLoadingDay] = useState(false);
  const cacheRef = useRef<Map<string, Match[]>>(new Map());

  useEffect(() => {
    if (isViewingToday) { setDayMatches(null); return; }
    const cached = cacheRef.current.get(selectedKey);
    if (cached) { setDayMatches(cached); return; }

    const ymd = selectedKey.replace(/-/g, "");
    let cancelled = false;
    setLoadingDay(true);
    setDayMatches(null);

    Promise.allSettled(
      LEAGUES.map(l => getFixturesByDate(l.slug, ymd).then(fx => mapFixtures(fx, l.slug)))
    ).then(results => {
      if (cancelled) return;
      const byId = new Map<number, Match>();
      for (const r of results) if (r.status === "fulfilled") for (const m of r.value) byId.set(m.id, m);
      const arr = Array.from(byId.values());
      cacheRef.current.set(selectedKey, arr);
      setDayMatches(arr);
    }).finally(() => { if (!cancelled) setLoadingDay(false); });

    return () => { cancelled = true; };
  }, [selectedKey, isViewingToday]);

  let dated: Match[];
  if (isViewingToday) {
    const byId = new Map<number, Match>();
    for (const m of seed) byId.set(m.id, m);
    for (const m of live) byId.set(m.id, m);
    const all = Array.from(byId.values()).filter(m => !m.sport || m.sport === "football");
    dated = all.filter(m => isSameDay(m.kickoff, selectedDate));
  } else {
    dated = dayMatches ?? [];
  }

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

  const waiting = isViewingToday ? (dated.length === 0 && state === "connecting") : loadingDay;

  return (
    <div>
      <DatePicker selected={selectedDate} onSelect={setSelectedDate} />

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
        {isViewingToday && <LiveStatus state={state} lastUpdate={lastUpdate} />}
      </div>

      <div key={selectedKey} style={{ animation: "fadein 0.2s ease" }}>
        {waiting && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
            <div style={{ width: 32, height: 32, margin: "0 auto 14px", border: "3px solid var(--border)", borderTopColor: "var(--navy)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <p style={{ fontSize: 14, margin: 0 }}>{loadingDay ? "Loading fixtures…" : "Waiting for live match data…"}</p>
          </div>
        )}

        {!waiting && dated.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-secondary)", margin: "0 0 6px" }}>No fixtures on this day</p>
            <p style={{ fontSize: 13, margin: 0 }}>There are no scheduled or completed matches for this date.</p>
          </div>
        )}

        {!waiting && showLive && liveM.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <div className="section-label">
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff4d4d" }} />Live Now
            </div>
            <div className="matches-grid">{liveM.map(m => <MatchCard key={m.id} match={m} />)}</div>
          </section>
        )}

        {!waiting && showSched && sched.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <div className="section-label">Scheduled</div>
            {groupByLeague(sched).map(g => <LeagueGroup key={`s-${g.name}`} {...g} />)}
          </section>
        )}

        {!waiting && showFin && fin.length > 0 && (
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