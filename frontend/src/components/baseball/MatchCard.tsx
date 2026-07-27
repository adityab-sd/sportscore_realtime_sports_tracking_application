"use client";
import Link from "next/link";
import { BBGame } from "@/lib/api/baseball";
import { classifyStatus, inningLabel } from "@/types/baseball";
import TeamLogo from "./TeamLogo";

/** Short date label: "Today", "Tomorrow", or "Mon, Jun 30". */
function dayLabel(firstPitch: string | null): string {
  if (!firstPitch) return "";
  const d = new Date(firstPitch);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function StatusChip({ game }: { game: BBGame }) {
  const state = classifyStatus(game.statusState);

  if (state === "scheduled") {
    let label = game.status ?? "";
    if (game.firstPitch) {
      const d = new Date(game.firstPitch);
      if (!Number.isNaN(d.getTime())) {
        const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
        label = `${dayLabel(game.firstPitch)}, ${time}`;
      }
    }
    return <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }} suppressHydrationWarning>{label}</span>;
  }

  if (state === "finished") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>Final</span>
        {game.firstPitch && (
          <span style={{ fontSize: 9, color: "var(--text-muted)" }} suppressHydrationWarning>{dayLabel(game.firstPitch)}</span>
        )}
      </div>
    );
  }

  // live
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ff4d4d", flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626" }}>
        {inningLabel(game.inning, game.inningDetail) || "LIVE"}
      </span>
    </div>
  );
}

export default function MatchCard({ game, leagueSlug }: { game: BBGame; leagueSlug?: string }) {
  const slug = leagueSlug ?? game._slug ?? "mlb";
  const live = classifyStatus(game.statusState) === "live";
  const homeWin = game.homeScore != null && game.awayScore != null && game.homeScore > game.awayScore;
  const awayWin = game.homeScore != null && game.awayScore != null && game.awayScore > game.homeScore;

  return (
    <Link href={`/baseball/${game.id}?league=${encodeURIComponent(slug)}`} style={{ textDecoration: "none" }}>
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
            <TeamLogo logo={game.awayTeam.logo} shortName={game.awayTeam.shortName} highlight={awayWin} />
            <span style={{ fontSize: 14, fontWeight: awayWin ? 700 : 500, color: awayWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {game.awayTeam.name}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 76, flexShrink: 0 }}>
            <div className="score-num" style={{ fontSize: 22, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ color: awayWin ? "var(--obsidian)" : "var(--text-muted)" }}>{game.awayScore ?? "–"}</span>
              <span style={{ color: "var(--border)", fontSize: 16 }}>:</span>
              <span style={{ color: homeWin ? "var(--obsidian)" : "var(--text-muted)" }}>{game.homeScore ?? "–"}</span>
            </div>
            <StatusChip game={game} />
          </div>

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: homeWin ? 700 : 500, color: homeWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
              {game.homeTeam.name}
            </span>
            <TeamLogo logo={game.homeTeam.logo} shortName={game.homeTeam.shortName} highlight={homeWin} />
          </div>
        </div>
      </div>
    </Link>
  );
}