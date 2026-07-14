"use client";

import { BBMatchEvent, BBTeamRef } from "@/lib/api/basketball";
import TeamLogo from "@/components/football/TeamLogo";

interface Props {
  events: BBMatchEvent[];
  homeTeam: BBTeamRef;
  awayTeam: BBTeamRef;
}

export default function ScoringPlays({ events, homeTeam, awayTeam }: Props) {
  if (events.length === 0) return null;

  // PLEASE review — minute assumed numeric quarter: NaN minute values make sorting unstable and Q{ev.minute} misleading. EXAMPLE: const sorted = [...events].sort((a, b) => (Number(b.minute) || 0) - (Number(a.minute) || 0));
  const sorted = [...events].sort((a, b) => b.minute - a.minute);

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
        Scoring Plays
      </div>
      <div style={{ padding: "4px 0" }}>
        {sorted.map((ev, i) => {
          const isHome = ev.teamId === homeTeam.id;
          // PLEASE review — unknown team defaults to away: neutral/invalid teamId will be shown with the away logo. EXAMPLE: const team = ev.teamId === homeTeam.id ? homeTeam : ev.teamId === awayTeam.id ? awayTeam : null;
          const team = isHome ? homeTeam : awayTeam;
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 18px", borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, minWidth: 44 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", minWidth: 18, textAlign: "center" }}>Q{ev.minute || "–"}</span>
                <TeamLogo logo={team.logo} shortName={team.shortName} size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {ev.player && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", marginBottom: 1 }}>{ev.player}</div>}
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>{ev.detail}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", background: "var(--cloud)", padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>{team.shortName}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
