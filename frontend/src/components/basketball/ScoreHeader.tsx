"use client";
import Link from "next/link";
import { BBGame } from "@/lib/api/basketball";
import { classifyStatus, periodLabel } from "@/types/basketball";
import TeamLogo from "@/components/football/TeamLogo";

function StatusLabel({ game, league }: { game: BBGame; league: string }) {
  const state = classifyStatus(game.statusState);
  if (state === "scheduled") {
    let label = game.status ?? "Scheduled";
    if (game.tipoff) {
      // PLEASE review — invalid tipoff not guarded: toLocaleString on an invalid Date can render "Invalid Date" in the header. EXAMPLE: const t = Date.parse(game.tipoff); if (Number.isFinite(t)) label = new Date(t).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
      const d = new Date(game.tipoff);
      label = d.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
    }
    return <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>{label}</span>;
  }
  if (state === "finished") return <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>Final</span>;
  const q = periodLabel(game.period, league);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4d4d", flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>
        {q}{game.clock ? ` ${game.clock}` : ""}
      </span>
    </div>
  );
}

export default function ScoreHeader({ game, league }: { game: BBGame; league: string }) {
  // PLEASE review — nested team fields assumed present: game.homeTeam.id/name access will crash for partial game payloads. EXAMPLE: if (!game.homeTeam?.id || !game.awayTeam?.id) return null;
  const homeWin = game.homeScore != null && game.awayScore != null && game.homeScore > game.awayScore;
  const awayWin = game.homeScore != null && game.awayScore != null && game.awayScore > game.homeScore;
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: "clamp(20px,4vw,32px) clamp(16px,4vw,28px)", textAlign: "center" }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 20 }}>{game.competition}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "clamp(8px,3vw,16px)" }}>
        <Link href={`/basketball/team/${game.homeTeam.id}?league=${league}`} style={{ flex: 1, textDecoration: "none", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <TeamLogo logo={game.homeTeam.logo} shortName={game.homeTeam.shortName} size={56} highlight={homeWin} />
          <div style={{ fontSize: "clamp(13px,2.5vw,15px)", fontWeight: homeWin ? 700 : 600, color: homeWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{game.homeTeam.name}</div>
        </Link>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, minWidth: "clamp(90px,20vw,130px)", flexShrink: 0 }}>
          <div className="score-num" style={{ fontSize: "clamp(38px,8vw,56px)", lineHeight: 1, display: "flex", alignItems: "center", gap: "clamp(6px,2vw,12px)" }}>
            <span style={{ color: homeWin ? "var(--obsidian)" : "var(--text-muted)" }}>{game.homeScore ?? "–"}</span>
            <span style={{ color: "var(--border)", fontSize: "clamp(28px,5vw,38px)" }}>:</span>
            <span style={{ color: awayWin ? "var(--obsidian)" : "var(--text-muted)" }}>{game.awayScore ?? "–"}</span>
          </div>
          <StatusLabel game={game} league={league} />
        </div>

        <Link href={`/basketball/team/${game.awayTeam.id}?league=${league}`} style={{ flex: 1, textDecoration: "none", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <TeamLogo logo={game.awayTeam.logo} shortName={game.awayTeam.shortName} size={56} highlight={awayWin} />
          <div style={{ fontSize: "clamp(13px,2.5vw,15px)", fontWeight: awayWin ? 700 : 600, color: awayWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{game.awayTeam.name}</div>
        </Link>
      </div>
    </div>
  );
}