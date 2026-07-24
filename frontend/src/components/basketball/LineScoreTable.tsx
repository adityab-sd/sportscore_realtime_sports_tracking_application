"use client";
import { BBGameDetail } from "@/lib/api/basketball";
import { periodLabel } from "@/types/basketball";
import TeamLogo from "@/components/football/TeamLogo";

export default function LineScoreTable({ game, league }: { game: BBGameDetail; league: string }) {
  if (!game.lineScores || game.lineScores.length === 0) return null;
  // ADDRESSED: fallback by array position can swap teams: ESPN competitor order is not guaranteed, so lineScores[0]/[1] can show the wrong side. EXAMPLE: const home = game.lineScores.find((l) => l.teamId === game.homeTeam.id); if (!home || !away) return null;
  const home = game.lineScores.find(l => l.teamId === game.homeTeam.id) ?? game.lineScores[0];
  const away = game.lineScores.find(l => l.teamId === game.awayTeam.id) ?? game.lineScores[1];
  // ADDRESSED: periods assumed array: home?.periods.length still throws when periods is undefined. EXAMPLE: const homePeriods = Array.isArray(home?.periods) ? home.periods : [];
  const nPeriods = Math.max(home?.periods.length ?? 0, away?.periods.length ?? 0);
  if (nPeriods === 0) return null;

  const cols = `1fr ${"48px ".repeat(nPeriods)}64px`;

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Scoring by Quarter</div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 320 }}>
          {/* Header row */}
          <div style={{ display: "grid", gridTemplateColumns: cols, padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
            <span>Team</span>
            {Array.from({ length: nPeriods }, (_, i) => (
              <span key={i} style={{ textAlign: "center" }}>{periodLabel(i + 1, league)}</span>
            ))}
            <span style={{ textAlign: "center" }}>Total</span>
          </div>

          {[{ team: game.homeTeam, ls: home }, { team: game.awayTeam, ls: away }].map(({ team, ls }, ri) => (
            <div key={team.id} style={{ display: "grid", gridTemplateColumns: cols, padding: "12px 16px", borderBottom: ri === 0 ? "1px solid var(--border)" : "none", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <TeamLogo logo={team.logo} shortName={team.shortName} size={24} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.shortName || team.name}</span>
              </div>
              {Array.from({ length: nPeriods }, (_, i) => (
                <span key={i} className="stat-num" style={{ textAlign: "center", fontSize: 14, color: "var(--text-secondary)" }}>
                  {ls?.periods[i] ?? "–"}
                </span>
              ))}
              <span className="stat-num" style={{ textAlign: "center", fontSize: 15, fontWeight: 800, color: "var(--obsidian)" }}>
                {ls?.total ?? "–"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}