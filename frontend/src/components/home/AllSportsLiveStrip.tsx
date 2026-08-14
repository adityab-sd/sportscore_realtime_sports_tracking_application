"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSignalR } from "@/hooks/useSignalR";
import { classifyStatus, slugFromCompetition, Match } from "@/types/football";
import TeamLogo from "@/components/football/TeamLogo";
import LiveStatus from "@/components/ui/LiveStatus";

// Shared visual treatment for LIVE cards — a subtle dark (charcoal) gradient +
// glow so live matches read as premium and are easy for users to spot.
const LIVE_GRADIENT = "linear-gradient(120deg, rgba(17,20,30,0.17) 0%, rgba(236,237,241,0.5) 42%, var(--white) 76%)";
const LIVE_BORDER = "rgba(28,32,44,0.38)";
const LIVE_GLOW = "0 6px 22px rgba(12,15,24,0.18)";
// Soft off-white base for non-live cards, so cards sit gently apart from the page.
const CARD_BG = "#F7F8FA";
// Distinct per-sport accent (football blue, basketball orange, baseball green, F1 red).
const SPORT_ACCENT: Record<string, string> = { football: "#2563EB", basketball: "#EA580C", baseball: "#16A34A", f1: "#DC2626" };

// ─────────────────────────────────────────────────────────────────────────────
// Sport config registry — add a new sport here when the backend starts
// publishing it on the SignalR hub. No other file needs to change.
// ─────────────────────────────────────────────────────────────────────────────
interface SportConfig {
  label: string;
  color: string;         // accent colour for the sport tab
  detailPath: string;    // e.g. "/football" → links to /football/[id]
  slugFromCompetition: (name: string) => string;
}

const SPORT_CONFIGS: Record<string, SportConfig> = {
  football: {
    label: "Football",
    color: "var(--navy)",
    detailPath: "/football",
    slugFromCompetition,
  },
  basketball: {
    label: "Basketball",
    color: "#EA580C",
    detailPath: "/basketball",
    slugFromCompetition: () => "nba",
  },
  baseball: {
    label: "Baseball",
    color: "#002d72",
    detailPath: "/baseball",
    slugFromCompetition: () => "mlb",
  },
  f1: {
    label: "Formula 1",
    color: "#DC2626",
    detailPath: "/f1",
    slugFromCompetition: () => "f1",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Fallback data shape — pre-fetched server-side (see getUpcomingBySport in
// app/page.tsx) and passed in as a prop, since this component is client-only
// (it needs useSignalR) and can't fetch from the REST fixtures endpoints itself.
// ─────────────────────────────────────────────────────────────────────────────
export interface UpcomingFixture {
  id: string;
  /** ISO date string, or null if the schedule isn't confirmed yet. */
  dateISO: string | null;
  competition: string;
  home: { name: string; shortName: string; logo: string | null; score?: number | null };
  away: { name: string; shortName: string; logo: string | null; score?: number | null };
  href: string;
  /** "scheduled" (default) shows a date; "finished"/"live" show scores. */
  state?: "scheduled" | "live" | "finished";
}

// ─────────────────────────────────────────────────────────────────────────────
// F1 is race-based (no home/away), so it gets its own shape + card. Pre-fetched
// server-side (see getF1Races in app/page.tsx) and passed in as a prop.
// ─────────────────────────────────────────────────────────────────────────────
export interface F1Race {
  id: string;
  name: string;                 // Grand Prix name
  circuit: string;              // circuit / track name
  location: string;             // city, country
  dateISO: string | null;
  state: "scheduled" | "live" | "finished";
  href: string;                 // /f1/race/[id]
  sessionLabel?: string;        // e.g. "Race", "Qualifying" when live
}

// ─────────────────────────────────────────────────────────────────────────────
// Some ESPN timestamps arrive without seconds ("2026-08-23T13:00Z"), which a
// few browsers refuse to parse (→ Invalid Date → a stuck/zeroed countdown).
// Pad the seconds so it's always valid ISO; strings that already have seconds
// (or no time zone) are returned unchanged.
// ─────────────────────────────────────────────────────────────────────────────
function normalizeIso(iso: string | null): string | null {
  if (!iso) return null;
  return iso.replace(/T(\d{2}):(\d{2})(Z|[+-]\d{2}:?\d{2})?$/, "T$1:$2:00$3");
}
function parseMs(iso: string | null): number | null {
  const t = normalizeIso(iso);
  if (!t) return null;
  const ms = new Date(t).getTime();
  return Number.isNaN(ms) ? null : ms;
}

// ============================================================================
// ADDRESSED: make date formatting timezone-explicit
// ----------------------------------------------------------------------------
// Client-side toLocaleDateString/toLocaleTimeString uses the viewer's timezone
// and can show a different kickoff day/time from server-prepared labels or API
// expectations. suppressHydrationWarning hides the mismatch instead of fixing it.
//
// EXAMPLE:
//   const time = new Intl.DateTimeFormat("en-GB", {
//     timeZone: "UTC", weekday: "short", month: "short", day: "numeric",
//     hour: "2-digit", minute: "2-digit",
//   }).format(new Date(iso));
// ============================================================================
function formatUpcoming(iso: string | null): string {
  const ms = parseMs(iso);
  if (ms == null) return "Date TBD";
  const d = new Date(ms);
  const date = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Single upcoming-fixture card — same visual language as LiveMatchCard below,
// minus the score/live indicator, plus a formatted kickoff date/time.
// ─────────────────────────────────────────────────────────────────────────────
function UpcomingMatchCard({ fixture, sport }: { fixture: UpcomingFixture; sport: string }) {
  const config = SPORT_CONFIGS[sport] ?? SPORT_CONFIGS["football"];
  const isLive = fixture.state === "live";
  const isFinished = fixture.state === "finished";
  const hasScore = isLive || isFinished;
  const hs = fixture.home.score;
  const as = fixture.away.score;
  const homeWin = isFinished && (hs ?? 0) > (as ?? 0);
  const awayWin = isFinished && (as ?? 0) > (hs ?? 0);

  return (
    <Link href={fixture.href} style={{ textDecoration: "none" }}>
      <div className={`card-hover match-card tint-${sport}`} style={{
        background: isLive ? LIVE_GRADIENT : CARD_BG, border: `1px solid ${isLive ? LIVE_BORDER : "var(--border)"}`, boxShadow: isLive ? LIVE_GLOW : undefined,
        borderRadius: 14, padding: "16px 18px 15px", position: "relative", minHeight: 104,
        display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "62%" }}>
            {fixture.competition}
          </span>
          {isLive ? (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4d4d" }} className="live-dot" />
              <span style={{ fontSize: 10, fontWeight: 800, color: "#dc2626", letterSpacing: "0.5px" }}>LIVE</span>
            </span>
          ) : isFinished ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)" }}>FT</span>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 700, color: config.color }} suppressHydrationWarning>{formatUpcoming(fixture.dateISO)}</span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <TeamLogo logo={fixture.home.logo} shortName={fixture.home.shortName} highlight={homeWin} size={40} />
            <span style={{ fontSize: 14.5, fontWeight: homeWin ? 800 : 600, color: homeWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {fixture.home.shortName || fixture.home.name}
            </span>
          </div>

          {hasScore ? (
            <div className="score-num" style={{ fontSize: 26, fontWeight: 800, display: "flex", alignItems: "center", gap: 6, minWidth: 66, justifyContent: "center", flexShrink: 0 }}>
              <span style={{ color: homeWin ? "var(--obsidian)" : "var(--text-muted)" }}>{hs ?? "–"}</span>
              <span style={{ color: "var(--border)", fontSize: 16 }}>:</span>
              <span style={{ color: awayWin ? "var(--obsidian)" : "var(--text-muted)" }}>{as ?? "–"}</span>
            </div>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", flexShrink: 0, minWidth: 26, textAlign: "center" }}>vs</span>
          )}

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 14.5, fontWeight: awayWin ? 800 : 600, color: awayWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
              {fixture.away.shortName || fixture.away.name}
            </span>
            <TeamLogo logo={fixture.away.logo} shortName={fixture.away.shortName} highlight={awayWin} size={40} />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Map a race to its circuit SVG file in /public/f1/circuits (by venue keyword).
// ─────────────────────────────────────────────────────────────────────────────
const CIRCUIT_FILES: [string, string][] = [
  ["zandvoort", "netherlands"], ["netherlands", "netherlands"], ["dutch", "netherlands"],
  ["monza", "italy"], ["italian", "italy"], ["imola", "italy"], ["italy", "italy"],
  ["madring", "spain"], ["madrid", "spain"], ["spanish", "spain"], ["catalunya", "barcelona"], ["barcelona", "barcelona"], ["spain", "spain"],
  ["baku", "azerbaijan"], ["azerbaijan", "azerbaijan"],
  ["marina bay", "singapore"], ["singapore", "singapore"],
  ["americas", "usa"], ["austin", "usa"], ["cota", "usa"], ["united states", "usa"],
  ["miami", "miami"],
  ["las vegas", "lasvegas"], ["vegas", "lasvegas"],
  ["monte carlo", "monaco"], ["monaco", "monaco"],
  ["silverstone", "greatbritain"], ["great britain", "greatbritain"], ["british", "greatbritain"], ["britain", "greatbritain"],
  ["spa", "belgium"], ["belgian", "belgium"], ["belgium", "belgium"],
  ["hungaroring", "hungary"], ["hungarian", "hungary"], ["budapest", "hungary"], ["hungary", "hungary"],
  ["suzuka", "japan"], ["japanese", "japan"], ["japan", "japan"],
  ["shanghai", "china"], ["chinese", "china"], ["china", "china"],
  ["interlagos", "brazil"], ["sao paulo", "brazil"], ["brazilian", "brazil"], ["brazil", "brazil"],
  ["lusail", "qatar"], ["qatar", "qatar"],
  ["hermanos", "mexico"], ["mexican", "mexico"], ["mexico", "mexico"],
  ["albert park", "australia"], ["melbourne", "australia"], ["australian", "australia"], ["australia", "australia"],
  ["jeddah", "saudiarabia"], ["saudi", "saudiarabia"],
  ["yas marina", "abudhabi"], ["abu dhabi", "abudhabi"], ["abudhabi", "abudhabi"],
  ["montreal", "canada"], ["villeneuve", "canada"], ["canadian", "canada"], ["canada", "canada"],
  ["red bull ring", "austria"], ["spielberg", "austria"], ["austrian", "austria"], ["austria", "austria"],
  ["sakhir", "bahrain"], ["bahrain", "bahrain"],
];
function circuitSvgFile(race: F1Race): string | null {
  const s = `${race.name} ${race.circuit} ${race.location}`.toLowerCase();
  for (const [kw, file] of CIRCUIT_FILES) if (s.includes(kw)) return `/f1/circuits/${file}.svg`;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// F1 "next race" banner — venue circuit map + a live countdown to the race.
// ─────────────────────────────────────────────────────────────────────────────
function pad2(n: number): string { return String(n).padStart(2, "0"); }
function F1CountdownBanner({ race }: { race: F1Race }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const svg = circuitSvgFile(race);
  // Counts down to whatever race.dateISO is (getF1Races supplies the RACE
  // session's time). parseMs pads missing seconds so the date always parses.
  const target = parseMs(race.dateISO);
  const diff = now != null && target != null ? target - now : null;
  const isLive = race.state === "live" || (diff != null && diff <= 0);
  const dd = diff != null && diff > 0 ? Math.floor(diff / 86400000) : 0;
  const hh = diff != null && diff > 0 ? Math.floor((diff % 86400000) / 3600000) : 0;
  const mm = diff != null && diff > 0 ? Math.floor((diff % 3600000) / 60000) : 0;
  const ss = diff != null && diff > 0 ? Math.floor((diff % 60000) / 1000) : 0;
  const unit = (v: number, label: string) => (
    <div style={{ textAlign: "center", minWidth: 44 }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums", lineHeight: 1 }} suppressHydrationWarning>{pad2(v)}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.6px", marginTop: 4 }}>{label}</div>
    </div>
  );
  return (
    <Link href={race.href} style={{ textDecoration: "none" }}>
      <div className="card-hover" style={{
        position: "relative", overflow: "hidden", borderRadius: 16, padding: "22px 26px",
        background: "linear-gradient(115deg, #12121c 0%, #1c1c2b 52%, #3a121a 100%)",
        border: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap",
      }}>
        {svg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={svg} alt="" aria-hidden="true" style={{ position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)", height: 200, opacity: 0.15, filter: "brightness(0) invert(1)", pointerEvents: "none" }} />
        )}
        <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#DC2626", textTransform: "uppercase", letterSpacing: "1px" }}>{isLive ? "Live Now" : "Next Race"}</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: 4 }}>{race.name}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{[race.circuit, race.location].filter(Boolean).join(" · ")}</div>
        </div>
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          {svg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={svg} alt={race.circuit} style={{ height: 76, width: 76, objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.92 }} />
          )}
          {isLive ? (
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 999, background: "rgba(220,38,38,0.18)", border: "1px solid rgba(255,77,77,0.5)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff4d4d" }} className="live-dot" />
              <span style={{ fontSize: 13, fontWeight: 800, color: "#ff6b6b", letterSpacing: "0.5px" }}>LIVE</span>
            </div>
          ) : now == null ? (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }} suppressHydrationWarning>{formatUpcoming(race.dateISO)}</div>
          ) : (
            <div style={{ display: "flex", gap: 10 }}>{unit(dd, "Days")}{unit(hh, "Hrs")}{unit(mm, "Min")}{unit(ss, "Sec")}</div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single match card — sport-agnostic (live / finished / scheduled)
// ─────────────────────────────────────────────────────────────────────────────
function LiveMatchCard({ match, sport }: { match: Match; sport: string }) {
  const config = SPORT_CONFIGS[sport] ?? SPORT_CONFIGS["football"];
  const state  = classifyStatus(match.status);
  const isLive = state === "live";
  const isFinal = state === "finished";
  const homeWin = isFinal && (match.homeScore ?? 0) > (match.awayScore ?? 0);
  const awayWin = isFinal && (match.awayScore ?? 0) > (match.homeScore ?? 0);
  const slug = config.slugFromCompetition(match.competition ?? "");
  const href = `${config.detailPath}/${match.id}?league=${encodeURIComponent(slug)}`;

  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div className={`card-hover match-card tint-${sport}`} style={{
        background: isLive ? LIVE_GRADIENT : CARD_BG, border: `1px solid ${isLive ? LIVE_BORDER : "var(--border)"}`, boxShadow: isLive ? LIVE_GLOW : undefined,
        borderRadius: 14, padding: "16px 18px 15px", position: "relative", minHeight: 104,
        display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "62%" }}>
            {match.competition}
          </span>
          {isLive ? (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4d4d" }} className="live-dot" />
              <span style={{ fontSize: 10, fontWeight: 800, color: "#dc2626", letterSpacing: "0.5px" }}>LIVE</span>
            </span>
          ) : isFinal ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)" }}>FT</span>
          ) : match.kickoff ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: config.color }} suppressHydrationWarning>
              {new Date(match.kickoff).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <TeamLogo logo={match.homeTeam.logo} shortName={match.homeTeam.shortName} highlight={homeWin} size={40} />
            <span style={{ fontSize: 14.5, fontWeight: homeWin ? 800 : 600, color: homeWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {match.homeTeam.shortName || match.homeTeam.name}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 66, flexShrink: 0 }}>
            {(isLive || isFinal) ? (
              <div className="score-num" style={{ fontSize: 26, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: homeWin ? "var(--obsidian)" : "var(--text-muted)" }}>{match.homeScore ?? "–"}</span>
                <span style={{ color: "var(--border)", fontSize: 16 }}>:</span>
                <span style={{ color: awayWin ? "var(--obsidian)" : "var(--text-muted)" }}>{match.awayScore ?? "–"}</span>
              </div>
            ) : (
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>vs</span>
            )}
            {isLive && match.status && (
              <span style={{ fontSize: 10, color: "#dc2626", fontWeight: 700 }}>{match.status}</span>
            )}
          </div>

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 14.5, fontWeight: awayWin ? 800 : 600, color: awayWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
              {match.awayTeam.shortName || match.awayTeam.name}
            </span>
            <TeamLogo logo={match.awayTeam.logo} shortName={match.awayTeam.shortName} highlight={awayWin} size={40} />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
interface AllSportsLiveStripProps {
  /**
   * Pre-fetched upcoming fixtures, grouped by the same sport keys used in
   * SPORT_CONFIGS. Shown as a "few upcoming matches per sport" fallback
   * ONLY when there's currently nothing live. Add a sport to SPORT_CONFIGS
   * above and give it a non-empty entry here (see getUpcomingBySport in
   * app/page.tsx) and it slots into this fallback automatically — nothing
   * else in this file needs to change.
   */
  upcomingBySport?: Record<string, UpcomingFixture[]>;
  /** Pre-fetched F1 races (live first, then upcoming). Rendered as its own
   *  section after the team sports, since races have no home/away. */
  f1Races?: F1Race[];
}

export default function AllSportsLiveStrip({ upcomingBySport = {}, f1Races = [] }: AllSportsLiveStripProps) {
  const { matches: allMatches, state, lastUpdate } = useSignalR();

  // Group matches by sport — default "football" if sport field is absent
  const bySport: Record<string, Match[]> = {};
  for (const m of allMatches) {
    const sport = m.sport ?? "football";
    if (!bySport[sport]) bySport[sport] = [];
    bySport[sport].push(m);
  }

  // Build a unified list: every TEAM sport that has EITHER SignalR data or a
  // pooled fixtures entry. F1 is rendered separately (races, not team matches).
  const allSports = Object.keys(SPORT_CONFIGS).filter(
    (s) => s !== "f1" && ((bySport[s]?.length ?? 0) > 0 || (upcomingBySport[s]?.length ?? 0) > 0)
  );

  const f1Live = f1Races.filter(r => r.state === "live").length;
  const totalLive = allMatches.filter(m => classifyStatus(m.status) === "live").length + f1Live;

  if (allSports.length === 0 && f1Races.length === 0 && state !== "connected" && state !== "connecting") return null;

  return (
    <section style={{ paddingTop: 36, paddingBottom: 12 }}>
      <div className="container">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {totalLive > 0 && <span className="live-dot" />}
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 15, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", margin: 0 }}>
              {totalLive > 0 ? `${totalLive} Live Now` : "Upcoming Matches"}
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <LiveStatus state={state} lastUpdate={lastUpdate} />
          </div>
        </div>

        {/* Per-sport sections: for each sport show live matches when available,
            otherwise fall back to upcoming fixtures. Every sport with data appears. */}
        {allSports.length === 0 && f1Races.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
            No live matches right now — they&apos;ll appear here as they start.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {allSports.map(sport => {
              const config   = SPORT_CONFIGS[sport];
              const signalR  = bySport[sport] ?? [];
              const pool = (upcomingBySport[sport] ?? []).filter(f => f.state !== "finished");
              const live     = signalR.filter(m => classifyStatus(m.status) === "live");

              // Always aim for 6 cards per sport: live matches (from the hub)
              // first, then fill from the pooled scoreboard+fixtures games
              // (scheduled first, recent finished as fallback). Deduped by id.
              const CARDS = 6;
              const seen = new Set<string>();
              const liveCards: Match[] = [];
              for (const m of live) { const k = String(m.id); if (seen.has(k)) continue; seen.add(k); liveCards.push(m); if (liveCards.length >= CARDS) break; }
              const poolCards: UpcomingFixture[] = [];
              for (const f of pool) { if (liveCards.length + poolCards.length >= CARDS) break; const k = String(f.id); if (seen.has(k)) continue; seen.add(k); poolCards.push(f); }
              if (liveCards.length + poolCards.length === 0) return null;

              return (
                <div key={sport}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {liveCards.length > 0 && (
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4d4d", flexShrink: 0 }} />
                      )}
                      <span style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: SPORT_ACCENT[sport] ?? config.color }}>
                        {config.label}
                      </span>
                      {liveCards.length > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#dc2626" }}>
                          {liveCards.length} live
                        </span>
                      )}
                    </div>
                    <Link href={config.detailPath} style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>
                      All matches →
                    </Link>
                  </div>

                  <div className="matches-grid">
                    {liveCards.map(m => <LiveMatchCard key={m.id} match={m} sport={sport} />)}
                    {poolCards.map(f => <UpcomingMatchCard key={f.id} fixture={f} sport={sport} />)}
                  </div>
                </div>
              );
            })}

            {/* ── Formula 1 — one "next race" banner with the venue circuit map
                   and a live countdown (races have no home/away). ── */}
            {f1Races.length > 0 && (() => {
              const f1Config = SPORT_CONFIGS.f1;
              const next = f1Races[0];
              return (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {next.state === "live" && (
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4d4d", flexShrink: 0 }} />
                      )}
                      <span style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: SPORT_ACCENT.f1 }}>{f1Config.label}</span>
                    </div>
                    <Link href={f1Config.detailPath} style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>
                      All races →
                    </Link>
                  </div>
                  <F1CountdownBanner race={next} />
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </section>
  );
}