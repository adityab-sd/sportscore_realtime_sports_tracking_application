"use client";
import Link from "next/link";
import { BBGameDetail } from "@/lib/api/basketball";
import { classifyStatus, periodLabel } from "@/types/basketball";
import TeamLogo from "./TeamLogo";

function StatusLabel({ game, league }: { game: BBGameDetail; league: string }) {
  const state = classifyStatus(game.statusState);
  const dateStr = game.tipoff && !Number.isNaN(new Date(game.tipoff).getTime())
    ? new Date(game.tipoff).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    : null;

  if (state === "scheduled") {
    let label = game.status ?? "Scheduled";
    if (game.tipoff && !Number.isNaN(new Date(game.tipoff).getTime())) {
      label = new Date(game.tipoff).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
    }
    return <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }} suppressHydrationWarning>{label}</span>;
  }
  if (state === "finished") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>Final</span>
        {dateStr && <span style={{ fontSize: 11, color: "var(--text-muted)" }} suppressHydrationWarning>{dateStr}</span>}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4d4d", flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>{[periodLabel(game.period, league), game.clock].filter(Boolean).join(" ") || "LIVE"}</span>
    </div>
  );
}

export default function ScoreHeader({ game, league }: { game: BBGameDetail; league: string }) {
  const homeWin = game.homeScore != null && game.awayScore != null && game.homeScore > game.awayScore;
  const awayWin = game.homeScore != null && game.awayScore != null && game.awayScore > game.homeScore;

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: "clamp(14px,3vw,20px)", textAlign: "center" }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 12 }}>
        <Link href={`/basketball/league/${league}`} style={{ color: "var(--navy)", textDecoration: "none", fontWeight: 600 }}>{game.competition}</Link>
        {game.venue && <span> · {game.venue}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "clamp(8px,3vw,16px)" }}>
        <Link href={`/basketball/team/${game.homeTeam.id}?league=${league}`} style={{ flex: 1, textDecoration: "none", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <TeamLogo logo={game.homeTeam.logo} shortName={game.homeTeam.shortName} size={40} highlight={homeWin} />
          <div style={{ fontSize: 12, fontWeight: homeWin ? 700 : 600, color: homeWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{game.homeTeam.name}</div>
        </Link>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: "clamp(70px,16vw,100px)", flexShrink: 0 }}>
          <div className="score-num" style={{ fontSize: "clamp(28px,6vw,40px)", lineHeight: 1, display: "flex", alignItems: "center", gap: "clamp(6px,2vw,12px)" }}>
            <span style={{ color: homeWin ? "var(--obsidian)" : "var(--text-muted)" }}>{game.homeScore ?? "–"}</span>
            <span style={{ color: "var(--border)", fontSize: "clamp(20px,4vw,28px)" }}>:</span>
            <span style={{ color: awayWin ? "var(--obsidian)" : "var(--text-muted)" }}>{game.awayScore ?? "–"}</span>
          </div>
          <StatusLabel game={game} league={league} />
        </div>
        <Link href={`/basketball/team/${game.awayTeam.id}?league=${league}`} style={{ flex: 1, textDecoration: "none", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <TeamLogo logo={game.awayTeam.logo} shortName={game.awayTeam.shortName} size={40} highlight={awayWin} />
          <div style={{ fontSize: 12, fontWeight: awayWin ? 700 : 600, color: awayWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{game.awayTeam.name}</div>
        </Link>
      </div>
    </div>
  );
}