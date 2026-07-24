import Link from "next/link";
import type { ESPNStandingRow } from "@/lib/api/espn";
import TeamLogo from "./TeamLogo";

export default function MiniStandings({
  rows, league, homeTeamId, awayTeamId,
}: {
  rows: ESPNStandingRow[];
  league: string;
  homeTeamId: string;
  awayTeamId: string;
}) {
  const relevant = rows
    .filter(r => r.teamId === homeTeamId || r.teamId === awayTeamId)
    .sort((a, b) => a.rank - b.rank);
  if (relevant.length === 0) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
          Standings
        </div>
        <Link href={`/football/standings?league=${league}`} style={{ fontSize: 12, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>
          Full table →
        </Link>
      </div>
      <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {relevant.map((r, i) => (
          <div key={r.teamId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: i === relevant.length - 1 ? "none" : "1px solid var(--border)" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", width: 20 }}>{r.rank}</span>
            <TeamLogo logo={r.logo} shortName={r.shortName} size={22} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", flex: 1 }}>{r.team}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.played}P</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--obsidian)", minWidth: 44, textAlign: "right" }}>{r.points} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}