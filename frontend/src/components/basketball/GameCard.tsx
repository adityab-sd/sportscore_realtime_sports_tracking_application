"use client";
import Link from "next/link";
import { BBGame } from "@/lib/api/basketball";
import { classifyStatus, periodLabel } from "@/types/basketball";
import TeamLogo from "@/components/football/TeamLogo";
import { formatMatchTime } from "@/lib/formatDate";

function StatusChip({ game, league }: { game: BBGame; league: string }) {
  const state = classifyStatus(game.statusState);
  if (state === "scheduled") {
    let label = game.status ?? "";
    if (game.tipoff) {
      // ADDRESSED: invalid tipoff not guarded: getUTCHours/getUTCMinutes can produce NaN:NaN for malformed dates. EXAMPLE: const t = Date.parse(game.tipoff); if (Number.isFinite(t)) { const d = new Date(t); label = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }); }
      const d = new Date(game.tipoff);
      label = `${d.getUTCHours().toString().padStart(2,"0")}:${d.getUTCMinutes().toString().padStart(2,"0")}`;
    }
    return <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>;
  }
  if (state === "finished") {
    return <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>FINAL</span>;
  }
  const q = periodLabel(game.period, league);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ff4d4d", flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626" }}>
        {q}{game.clock ? ` ${game.clock}` : ""}
      </span>
    </div>
  );
}

interface Props { game: BBGame; league?: string }

export default function GameCard({ game, league = "nba" }: Props) {
  // ADDRESSED: nested team fields assumed present: game.homeTeam.logo/name access will crash if a partial scoreboard row is returned. EXAMPLE: if (!game.homeTeam || !game.awayTeam) return null;
  const live = classifyStatus(game.statusState) === "live";
  const homeWin = game.homeScore != null && game.awayScore != null && game.homeScore > game.awayScore;
  const awayWin = game.homeScore != null && game.awayScore != null && game.awayScore > game.homeScore;

  return (
    <Link href={`/basketball/${game.id}?league=${league}`} style={{ textDecoration: "none" }}>
      <div className="card-hover" style={{
        background: "var(--white)", border: "1px solid var(--border)",
        borderRadius: 12, padding: "14px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)" }}>{game.competition}</span>
          {live && (
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4d4d", flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", letterSpacing: "0.5px" }}>LIVE</span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <TeamLogo logo={game.homeTeam.logo} shortName={game.homeTeam.shortName} highlight={homeWin} />
            <span style={{ fontSize: 14, fontWeight: homeWin ? 700 : 500, color: homeWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {game.homeTeam.name}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 84, flexShrink: 0 }}>
            <div className="score-num" style={{ fontSize: 22, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ color: homeWin ? "var(--obsidian)" : "var(--text-muted)" }}>{game.homeScore ?? "–"}</span>
              <span style={{ color: "var(--border)", fontSize: 16 }}>:</span>
              <span style={{ color: awayWin ? "var(--obsidian)" : "var(--text-muted)" }}>{game.awayScore ?? "–"}</span>
            </div>
            <StatusChip game={game} league={league} />
          </div>

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: awayWin ? 700 : 500, color: awayWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
              {game.awayTeam.name}
            </span>
            <TeamLogo logo={game.awayTeam.logo} shortName={game.awayTeam.shortName} highlight={awayWin} />
          </div>
        </div>
      </div>
    </Link>
  );
}