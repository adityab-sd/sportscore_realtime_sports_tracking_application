"use client";
import Link from "next/link";
import { useSignalR } from "@/hooks/useSignalR";
import { classifyStatus, Match } from "@/types/football";
import TeamLogo from "@/components/football/TeamLogo";
import LiveStatus from "@/components/ui/LiveStatus";

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
    slugFromCompetition: (name: string) => {
      const exact: Record<string, string> = {
        "World Cup 2026": "fifa.world", "Champions League": "uefa.champions",
        "Premier League": "eng.1", "La Liga": "esp.1", "Serie A": "ita.1",
        "Bundesliga": "ger.1", "Ligue 1": "fra.1", "MLS": "usa.1",
      };
      if (exact[name]) return exact[name];
      const l = name.toLowerCase();
      if (l.includes("champions")) return "uefa.champions";
      if (l.includes("premier"))   return "eng.1";
      if (l.includes("bundesliga")) return "ger.1";
      return "eng.1";
    },
  },
  basketball: {
    label: "Basketball",
    color: "#EA580C",
    detailPath: "/basketball",
    slugFromCompetition: () => "nba",
  },
  // ── Add future sports below ──────────────────────────────────────────────
  // baseball: {
  //   label: "Baseball",
  //   color: "#1a5276",
  //   detailPath: "/baseball",
  //   slugFromCompetition: () => "mlb",
  // },
  // f1: {
  //   label: "Formula 1",
  //   color: "#DC2626",
  //   detailPath: "/f1",
  //   slugFromCompetition: () => "f1",
  // },
};

// ─────────────────────────────────────────────────────────────────────────────
// Single match card — sport-agnostic
// ─────────────────────────────────────────────────────────────────────────────
function LiveMatchCard({ match, sport }: { match: Match; sport: string }) {
  const config = SPORT_CONFIGS[sport] ?? SPORT_CONFIGS["football"];
  const state   = classifyStatus(match.status);
  const isLive  = state === "live";
  const isFinal = state === "finished";
  const homeWin = isFinal && (match.homeScore ?? 0) > (match.awayScore ?? 0);
  const awayWin = isFinal && (match.awayScore ?? 0) > (match.homeScore ?? 0);

  const slug = config.slugFromCompetition(match.competition ?? "");
  const href = `${config.detailPath}/${match.id}?league=${encodeURIComponent(slug)}`;

  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div className="card-hover" style={{
        background: "var(--white)", border: `1px solid ${isLive ? config.color : "var(--border)"}`,
        borderRadius: 12, padding: "14px 16px", position: "relative",
      }}>
        {/* Live stripe */}
        {isLive && (
          <div style={{
            position: "absolute", left: 0, top: 10, bottom: 10,
            width: 3, borderRadius: "0 2px 2px 0", background: "#ff4d4d",
          }} />
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
            {match.competition}
          </span>
          {isLive && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ff4d4d" }} className="live-dot" />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", letterSpacing: "0.5px" }}>LIVE</span>
            </div>
          )}
          {isFinal && <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)" }}>FT</span>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <TeamLogo logo={match.homeTeam.logo} shortName={match.homeTeam.shortName} highlight={homeWin} />
            <span style={{ fontSize: 13, fontWeight: homeWin ? 700 : 500, color: homeWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {match.homeTeam.shortName || match.homeTeam.name}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 64, flexShrink: 0 }}>
            <div className="score-num" style={{ fontSize: 20, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: homeWin ? "var(--obsidian)" : "var(--text-muted)" }}>{match.homeScore ?? "–"}</span>
              <span style={{ color: "var(--border)", fontSize: 14 }}>:</span>
              <span style={{ color: awayWin ? "var(--obsidian)" : "var(--text-muted)" }}>{match.awayScore ?? "–"}</span>
            </div>
            {!isLive && !isFinal && match.kickoff && (
              <span style={{ fontSize: 10, color: "var(--text-muted)" }} suppressHydrationWarning>
                {new Date(match.kickoff).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            {isLive && match.status && (
              <span style={{ fontSize: 10, color: "#dc2626", fontWeight: 600 }}>{match.status}</span>
            )}
          </div>

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: awayWin ? 700 : 500, color: awayWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
              {match.awayTeam.shortName || match.awayTeam.name}
            </span>
            <TeamLogo logo={match.awayTeam.logo} shortName={match.awayTeam.shortName} highlight={awayWin} />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function AllSportsLiveStrip() {
  const { matches: allMatches, state, lastUpdate } = useSignalR();

  // Group matches by sport — default "football" if sport field is absent
  const bySport: Record<string, Match[]> = {};
  for (const m of allMatches) {
    const sport = m.sport ?? "football";
    if (!bySport[sport]) bySport[sport] = [];
    bySport[sport].push(m);
  }

  // Only show sports we have a config for
  const activeSports = Object.keys(SPORT_CONFIGS).filter(s => (bySport[s]?.length ?? 0) > 0);

  // Flatten to get live count across all sports
  const totalLive = allMatches.filter(m => classifyStatus(m.status) === "live").length;

  if (activeSports.length === 0 && state !== "connected" && state !== "connecting") return null;

  return (
    <section style={{ paddingTop: 36, paddingBottom: 12 }}>
      <div className="container">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {totalLive > 0 && <span className="live-dot" />}
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", margin: 0 }}>
              {totalLive > 0 ? `${totalLive} Live Now` : "Match Feed"}
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <LiveStatus state={state} lastUpdate={lastUpdate} />
          </div>
        </div>

        {/* Per-sport sections */}
        {activeSports.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
            No live matches right now — they&apos;ll appear here as they start.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {activeSports.map(sport => {
              const config  = SPORT_CONFIGS[sport];
              const matches = bySport[sport] ?? [];
              const live    = matches.filter(m => classifyStatus(m.status) === "live");
              const rest    = matches.filter(m => classifyStatus(m.status) !== "live").slice(0, 4);
              const strip   = [...live, ...rest].slice(0, 6);

              return (
                <div key={sport}>
                  {/* Sport label + link */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {live.length > 0 && (
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4d4d", flexShrink: 0 }} />
                      )}
                      <span style={{ fontSize: 14, fontWeight: 700, color: config.color }}>
                        {config.label}
                      </span>
                      {live.length > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#dc2626" }}>
                          {live.length} live
                        </span>
                      )}
                    </div>
                    <Link href={config.detailPath} style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>
                      All matches →
                    </Link>
                  </div>

                  <div className="matches-grid">
                    {strip.map(m => <LiveMatchCard key={m.id} match={m} sport={sport} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}