"use client";
import Link from "next/link";
import { Match, classifyStatus } from "@/types/football";
import TeamLogo from "./TeamLogo";

function formatKickoffDate(kickoff: string, withYear: boolean) {
  const d = new Date(kickoff);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" as const } : {}),
  });
}

function StatusLabel({ match }: { match: Match }) {
  const state = classifyStatus(match.status);

  if (state === "scheduled") {
    let label = match.status ?? "Scheduled";
    if (match.kickoff) {
      const d = new Date(match.kickoff);
      if (Number.isNaN(d.getTime())) {
        return <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>TBD</span>;
      }
      label = d.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
    }
    return <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>{label}</span>;
  }

  if (state === "finished") {
    const dateStr = match.kickoff ? formatKickoffDate(match.kickoff, true) : null;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>Full Time</span>
        {dateStr && <span style={{ fontSize: 11, color: "var(--text-muted)" }} suppressHydrationWarning>{dateStr}</span>}
      </div>
    );
  }

  const dateStr = match.kickoff ? formatKickoffDate(match.kickoff, false) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4d4d", flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>{match.status}</span>
      </div>
      {dateStr && <span style={{ fontSize: 11, color: "var(--text-muted)" }} suppressHydrationWarning>{dateStr}</span>}
    </div>
  );
}

interface Props {
  match: Match;
  league: string;
  /** Optional — shown next to the competition name (e.g. venue). */
  venue?: string | null;
  /** Optional — if provided, competition name links here instead of rendering as plain text. */
  competitionHref?: string;
  /** Optional — shrinks padding/fonts for use alongside a sidebar layout. */
  compact?: boolean;
}

export default function ScoreHeader({ match, league, venue, competitionHref, compact }: Props) {
  const homeWin = match.homeScore != null && match.awayScore != null && match.homeScore > match.awayScore;
  const awayWin = match.homeScore != null && match.awayScore != null && match.awayScore > match.homeScore;

  const competitionNode = competitionHref ? (
    <Link href={competitionHref} style={{ color: "var(--navy)", textDecoration: "none", fontWeight: 600 }}>
      {match.competition}
    </Link>
  ) : (
    match.competition
  );

  const logoSize = compact ? 40 : 56;
  const scoreFont = compact ? "clamp(28px,6vw,40px)" : "clamp(38px,8vw,56px)";
  const padding = compact ? "clamp(14px,3vw,20px) clamp(14px,3vw,20px)" : "clamp(20px,4vw,32px) clamp(16px,4vw,28px)";

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding, textAlign: "center" }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: compact ? 12 : 20 }}>
        {competitionNode}
        {venue && <span> · {venue}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "clamp(8px,3vw,16px)" }}>
        <Link href={`/football/team/${match.homeTeam.id}?league=${league}`} style={{ flex: 1, textDecoration: "none", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <TeamLogo logo={match.homeTeam.logo} shortName={match.homeTeam.shortName} size={logoSize} highlight={homeWin} />
          <div style={{ fontSize: compact ? 12 : "clamp(13px,2.5vw,15px)", fontWeight: homeWin ? 700 : 600, color: homeWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
            {match.homeTeam.name}
          </div>
        </Link>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: compact ? "clamp(70px,16vw,100px)" : "clamp(90px,20vw,130px)", flexShrink: 0 }}>
          <div className="score-num" style={{ fontSize: scoreFont, lineHeight: 1, display: "flex", alignItems: "center", gap: "clamp(6px,2vw,12px)" }}>
            <span style={{ color: homeWin ? "var(--obsidian)" : "var(--text-muted)" }}>{match.homeScore ?? "–"}</span>
            <span style={{ color: "var(--border)", fontSize: compact ? "clamp(20px,4vw,28px)" : "clamp(28px,5vw,38px)" }}>:</span>
            <span style={{ color: awayWin ? "var(--obsidian)" : "var(--text-muted)" }}>{match.awayScore ?? "–"}</span>
          </div>
          <StatusLabel match={match} />
        </div>

        <Link href={`/football/team/${match.awayTeam.id}?league=${league}`} style={{ flex: 1, textDecoration: "none", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <TeamLogo logo={match.awayTeam.logo} shortName={match.awayTeam.shortName} size={logoSize} highlight={awayWin} />
          <div style={{ fontSize: compact ? 12 : "clamp(13px,2.5vw,15px)", fontWeight: awayWin ? 700 : 600, color: awayWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
            {match.awayTeam.name}
          </div>
        </Link>
      </div>
    </div>
  );
}