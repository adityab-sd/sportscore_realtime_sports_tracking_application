"use client";
import Link from "next/link";
import { Match, classifyStatus } from "@/types/football";
import TeamLogo from "./TeamLogo";

// ============================================================================
// ADDRESSED: scheduled kickoff validation
// ----------------------------------------------------------------------------
// StatusLabel parses match.kickoff without checking validity. Invalid feed values
// can render "Invalid Date UTC" in the primary score header. Guard external
// dates before displaying them.
//
// EXAMPLE:
//   const d = match.kickoff ? new Date(match.kickoff) : null; if (!d || Number.isNaN(d.getTime())) return <span>TBD</span>;
// ============================================================================
function StatusLabel({ match }: { match: Match }) {
  const state = classifyStatus(match.status);
  if (state === "scheduled") {
    let label = match.status ?? "Scheduled";
    if (match.kickoff) {
      const d = new Date(match.kickoff);
      if (Number.isNaN(d.getTime())) return <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>TBD</span>;
      label = d.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
    }
    return <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>{label}</span>;
  }
  if (state === "finished") return <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>Full Time</span>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4d4d", flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>{match.status}</span>
    </div>
  );
}

// ============================================================================
// ADDRESSED: required league context
// ----------------------------------------------------------------------------
// Team links include ?league=${league}, but MatchDetailClient passes an empty
// string, creating links without usable league context for team pages. Make the
// prop optional and omit the query, or require a resolved slug at the caller.
//
// EXAMPLE:
//   const qs = league ? `?league=${encodeURIComponent(league)}` : "";
// ============================================================================
export default function ScoreHeader({ match, league }: { match: Match; league: string }) {
  const homeWin = match.homeScore != null && match.awayScore != null && match.homeScore > match.awayScore;
  const awayWin = match.homeScore != null && match.awayScore != null && match.awayScore > match.homeScore;
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: "clamp(20px,4vw,32px) clamp(16px,4vw,28px)", textAlign: "center" }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 20 }}>{match.competition}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "clamp(8px,3vw,16px)" }}>
        <Link href={`/football/team/${match.homeTeam.id}?league=${league}`} style={{ flex: 1, textDecoration: "none", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <TeamLogo logo={match.homeTeam.logo} shortName={match.homeTeam.shortName} size={56} highlight={homeWin} />
          <div style={{ fontSize: "clamp(13px,2.5vw,15px)", fontWeight: homeWin ? 700 : 600, color: homeWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{match.homeTeam.name}</div>
        </Link>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, minWidth: "clamp(90px,20vw,130px)", flexShrink: 0 }}>
          <div className="score-num" style={{ fontSize: "clamp(38px,8vw,56px)", lineHeight: 1, display: "flex", alignItems: "center", gap: "clamp(6px,2vw,12px)" }}>
            <span style={{ color: homeWin ? "var(--obsidian)" : "var(--text-muted)" }}>{match.homeScore ?? "–"}</span>
            <span style={{ color: "var(--border)", fontSize: "clamp(28px,5vw,38px)" }}>:</span>
            <span style={{ color: awayWin ? "var(--obsidian)" : "var(--text-muted)" }}>{match.awayScore ?? "–"}</span>
          </div>
          <StatusLabel match={match} />
        </div>

        <Link href={`/football/team/${match.awayTeam.id}?league=${league}`} style={{ flex: 1, textDecoration: "none", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <TeamLogo logo={match.awayTeam.logo} shortName={match.awayTeam.shortName} size={56} highlight={awayWin} />
          <div style={{ fontSize: "clamp(13px,2.5vw,15px)", fontWeight: awayWin ? 700 : 600, color: awayWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{match.awayTeam.name}</div>
        </Link>
      </div>
    </div>
  );
}
