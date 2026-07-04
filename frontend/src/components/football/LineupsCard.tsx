"use client";
import Link from "next/link";
import { ESPNTeamLineup, ESPNTeamRef } from "@/lib/api/espn";

interface Props {
  lineups: ESPNTeamLineup[];
  homeTeam: ESPNTeamRef;
  awayTeam: ESPNTeamRef;
  league: string;
}

function PlayerRow({
  jersey, name, position, playerId, teamId, league,
}: {
  jersey: string | null; name: string; position: string | null;
  playerId: string; teamId: string; league: string;
}) {
  return (
    <Link
      href={`/football/player/${playerId}?league=${league}&team=${teamId}`}
      style={{ textDecoration: "none" }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 4px", borderRadius: 6, transition: "background 100ms" }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--cloud)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", width: 22, textAlign: "center", flexShrink: 0 }}>
          {jersey ?? "-"}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </span>
        {position && (
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", background: "var(--cloud)", padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>
            {position}
          </span>
        )}
      </div>
    </Link>
  );
}

function TeamColumn({ lineup, team, league }: { lineup: ESPNTeamLineup; team: ESPNTeamRef; league: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--obsidian)" }}>{team.shortName || team.name}</span>
        {lineup.formation && (
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{lineup.formation}</span>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>
          Starting XI
        </div>
        {lineup.starters.map(p => (
          <PlayerRow key={p.id} jersey={p.jersey} name={p.name} position={p.position} playerId={p.id} teamId={lineup.teamId} league={league} />
        ))}
      </div>

      {lineup.bench.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>
            Substitutes
          </div>
          {lineup.bench.map(p => (
            <PlayerRow key={p.id} jersey={p.jersey} name={p.name} position={p.position} playerId={p.id} teamId={lineup.teamId} league={league} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LineupsCard({ lineups, homeTeam, awayTeam, league }: Props) {
  if (!lineups || lineups.length === 0) return null;

  const homeLineup = lineups.find(l => l.teamId === homeTeam.id);
  const awayLineup = lineups.find(l => l.teamId === awayTeam.id);
  if (!homeLineup && !awayLineup) return null;

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 16 }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
        Lineups
      </div>
      <div style={{ display: "flex", gap: 24, padding: "16px 18px" }} className="page-split">
        {homeLineup && <TeamColumn lineup={homeLineup} team={homeTeam} league={league} />}
        {awayLineup && <TeamColumn lineup={awayLineup} team={awayTeam} league={league} />}
      </div>
    </div>
  );
}