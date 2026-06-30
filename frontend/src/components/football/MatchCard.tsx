"use client";
import Link from "next/link";
import { Match, classifyStatus } from "@/types/football";
import TeamLogo from "./TeamLogo";

function StatusChip({ match }: { match: Match }) {
  const state = classifyStatus(match.status);
  if (state === "scheduled") {
    let label = match.status ?? "";
    if (match.kickoff) {
      const d = new Date(match.kickoff);
      label = `${d.getUTCHours().toString().padStart(2,"0")}:${d.getUTCMinutes().toString().padStart(2,"0")}`;
    }
    return <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>;
  }
  if (state === "finished") {
    return <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>FT</span>;
  }
  // live
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ff4d4d", flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626" }}>{match.status}</span>
    </div>
  );
}

export default function MatchCard({ match }: { match: Match }) {
  const live = classifyStatus(match.status) === "live";
  const homeWin = match.homeScore != null && match.awayScore != null && match.homeScore > match.awayScore;
  const awayWin = match.homeScore != null && match.awayScore != null && match.awayScore > match.homeScore;

  return (
    <Link href={`/football/${match.id}?league=${encodeURIComponent(slugFromCompetition(match.competition))}`} style={{ textDecoration: "none" }}>
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

// reverse-map a competition name to a league slug for detail links
function slugFromCompetition(name: string): string {
  const map: Record<string,string> = {
    "World Cup 2026": "fifa.world", "Champions League": "uefa.champions",
    "Premier League": "eng.1", "La Liga": "esp.1", "Serie A": "ita.1",
    "Bundesliga": "ger.1", "Ligue 1": "fra.1", "MLS": "usa.1", "Brasileirão": "bra.1",
  };
  return map[name] ?? "eng.1";
}
