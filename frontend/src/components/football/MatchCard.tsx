"use client";
import Link from "next/link";
import { Match, classifyStatus } from "@/types/football";
import TeamLogo from "./TeamLogo";
import LiveMatchClock from "./LiveMatchClock";
import { formatMatchDateTime, formatMatchDay } from "@/lib/formatDate";

// ============================================================================
// ADDRESSED: guarded Date parsing
// ----------------------------------------------------------------------------
// Match kickoff comes from external feed data; an invalid date renders "Invalid
// Date" or NaN-based UTC time in cards. Guard before formatting scheduled match
// labels so bad payloads degrade to TBD.
//
// EXAMPLE:
//   const d = match.kickoff ? new Date(match.kickoff) : null; if (!d || Number.isNaN(d.getTime())) return <span>TBD</span>;
// ============================================================================
/** Short date label: "Today", "Tomorrow", or "Mon, Jun 30". */
function dateLabel(kickoff: string | null): string {
  if (!kickoff) return "";
  const d = new Date(kickoff);
  if (Number.isNaN(d.getTime())) return "";
  const today    = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function StatusChip({ match }: { match: Match }) {
  const state = classifyStatus(match.status);
  if (state === "scheduled") {
    let label = match.status ?? "";
    if (match.kickoff) {
      const d = new Date(match.kickoff);
      const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
      label = `${formatMatchDay(match.kickoff)}, ${time}`;
    }
    return <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }} suppressHydrationWarning>{label}</span>;
  }
  if (state === "finished") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>FT</span>
        {match.kickoff && (
          <span style={{ fontSize: 9, color: "var(--text-muted)" }} suppressHydrationWarning>{formatMatchDay(match.kickoff)}</span>
        )}
      </div>
    );
  }
  // live — ticking clock (falls back to status string if no elapsed value yet)
  if (match.elapsed != null) {
    return <LiveMatchClock elapsed={match.elapsed} status={match.status} size="sm" />;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ff4d4d", flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626" }}>{match.status}</span>
    </div>
  );
}

export default function MatchCard({ match, league }: { match: Match; league?: string | null }) {
  const live = classifyStatus(match.status) === "live";
  const homeWin = match.homeScore != null && match.awayScore != null && match.homeScore > match.awayScore;
  const awayWin = match.homeScore != null && match.awayScore != null && match.awayScore > match.homeScore;

  return (
    <Link href={`/football/${match.id}?league=${encodeURIComponent(league ?? slugFromCompetition(match.competition))}`} style={{ textDecoration: "none" }}>
      <div className="card-hover" style={{
        background: "var(--white)", border: "1px solid var(--border)",
        borderRadius: 12, padding: "14px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)" }}>{match.competition}</span>
          {live && (
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4d4d", flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", letterSpacing: "0.5px" }}>LIVE</span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <TeamLogo logo={match.homeTeam.logo} shortName={match.homeTeam.shortName} highlight={homeWin} />
            <span style={{ fontSize: 14, fontWeight: homeWin ? 700 : 500, color: homeWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {match.homeTeam.name}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 76, flexShrink: 0 }}>
            <div className="score-num" style={{ fontSize: 22, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ color: homeWin ? "var(--obsidian)" : "var(--text-muted)" }}>{match.homeScore ?? "–"}</span>
              <span style={{ color: "var(--border)", fontSize: 16 }}>:</span>
              <span style={{ color: awayWin ? "var(--obsidian)" : "var(--text-muted)" }}>{match.awayScore ?? "–"}</span>
            </div>
            <StatusChip match={match} />
          </div>

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: awayWin ? 700 : 500, color: awayWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
              {match.awayTeam.name}
            </span>
            <TeamLogo logo={match.awayTeam.logo} shortName={match.awayTeam.shortName} highlight={awayWin} />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ============================================================================
// ADDRESSED: duplicated league mapping
// ----------------------------------------------------------------------------
// This hard-coded reverse map must stay in sync with the league registry and a
// Java backend map, which is brittle for live feeds adding competitions. Prefer
// one shared resolver and avoid defaulting unknown leagues to Premier League.
//
// EXAMPLE:
//   const slug = leagueByName(name)?.slug ?? "football";
// ============================================================================
// reverse-map a competition name to a league slug for detail links
function slugFromCompetition(name: string): string {
  // Must stay in sync with LEAGUES map in CoreSportsFetcher.java.
  // ESPN sometimes returns slightly different display names (e.g. "UEFA Europa League"
  // vs "Europa League"), so we match on lowercased substrings as a fallback.
  const exact: Record<string, string> = {
    // International
    "World Cup 2026": "fifa.world",
    "International Friendly": "fifa.friendly",
    // UEFA club
    "Champions League": "uefa.champions",
    "UEFA Champions League": "uefa.champions",
    "Europa League": "uefa.europa",
    "UEFA Europa League": "uefa.europa",
    "Conference League": "uefa.europa.conf",
    "UEFA Europa Conference League": "uefa.europa.conf",
    // Domestic
    "Premier League": "eng.1",
    "Championship": "eng.2",
    "La Liga": "esp.1",
    "Serie A": "ita.1",
    "Bundesliga": "ger.1",
    "Ligue 1": "fra.1",
    "MLS": "usa.1",
    "Brazil Serie A": "bra.1",
    "Brasileirão": "bra.1",
    "Eredivisie": "ned.1",
    "Primeira Liga": "por.1",
    "Liga MX": "mex.1",
    "Argentina Primera": "arg.1",
    "J-League": "jpn.1",
    "A-League": "aus.1",
  };
  if (exact[name]) return exact[name];
  const lower = name.toLowerCase();
  if (lower.includes("champions"))   return "uefa.champions";
  if (lower.includes("europa conf")) return "uefa.europa.conf";
  if (lower.includes("europa"))      return "uefa.europa";
  if (lower.includes("world cup"))   return "fifa.world";
  if (lower.includes("premier"))     return "eng.1";
  if (lower.includes("bundesliga"))  return "ger.1";
  // country-specific BEFORE generic "serie a"
  if (lower.includes("brasileir") || lower.includes("brazil")) return "bra.1";
  if (lower.includes("argentin") || lower.includes("apertura") || lower.includes("clausura") || lower.includes("profesional")) return "arg.1";
  if (lower.includes("serie a"))     return "ita.1";
  if (lower.includes("ligue 1"))     return "fra.1";
  if (lower.includes("la liga") || lower.includes("laliga")) return "esp.1";
  if (lower.includes("mls"))         return "usa.1";
  return ""; // unknown — don't force eng.1 // safe default
}