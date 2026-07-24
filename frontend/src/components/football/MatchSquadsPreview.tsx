"use client";
import Link from "next/link";
import type { ESPNPlayer, ESPNTeamRef } from "@/lib/api/espn";

const POSITION_GROUPS: { label: string; keys: string[] }[] = [
  { label: "Goalkeepers", keys: ["goalkeeper", "gk", "keeper"] },
  { label: "Defenders",   keys: ["defender", "defence", "defense", "back"] },
  { label: "Midfielders", keys: ["midfielder", "midfield", "mid"] },
  { label: "Forwards",    keys: ["forward", "attacker", "striker", "winger"] },
];

function groupByPosition(players: ESPNPlayer[]) {
  const groups: { label: string; players: ESPNPlayer[] }[] = [];
  const assigned = new Set<string>();

  for (const g of POSITION_GROUPS) {
    const bucket = players.filter(p => {
      const pos = (p.position || "").toLowerCase();
      return g.keys.some(k => pos.includes(k));
    });
    if (bucket.length) {
      groups.push({ label: g.label, players: bucket });
      bucket.forEach(p => assigned.add(p.id));
    }
  }

  const rest = players.filter(p => !assigned.has(p.id));
  if (rest.length) groups.push({ label: "Other", players: rest });
  return groups;
}

function TeamColumn({
  team, roster, league,
}: {
  team: ESPNTeamRef;
  roster: ESPNPlayer[];
  league: string;
}) {
  // ============================================================================
  // ADDRESSED: roster input normalization
  // ----------------------------------------------------------------------------
  // TeamColumn assumes roster is always an array. That is true for the current
  // prop type, but ESPN detail payloads often omit one side's roster; normalize at
  // the boundary so a partial response can still render the other squad.
  //
  // EXAMPLE:
  //   const groups = groupByPosition(roster ?? []);
  // ============================================================================
  const groups = groupByPosition(roster);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 12, paddingBottom: 8,
        borderBottom: "1px solid var(--border)",
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--obsidian)" }}>
          {team.shortName || team.name}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
          {roster.length} players
        </span>
      </div>

      {groups.length === 0 && (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Squad unavailable.</p>
      )}

      {groups.map(g => (
        <div key={g.label} style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
            textTransform: "uppercase", letterSpacing: "0.6px",
            marginBottom: 6,
          }}>
            {g.label}
          </div>
          {g.players.map(p => (
            <Link
              key={p.id}
              href={`/football/player/${p.id}?league=${league}&team=${team.id}`}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "6px 4px", borderRadius: 6,
                  transition: "background 100ms",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--cloud)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{
                  fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
                  width: 20, textAlign: "center", flexShrink: 0,
                }}>
                  {p.jersey ?? "-"}
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 500, color: "var(--obsidian)",
                  flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {p.name}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}

interface Props {
  homeTeam: ESPNTeamRef;
  awayTeam: ESPNTeamRef;
  homeRoster: ESPNPlayer[];
  awayRoster: ESPNPlayer[];
  league: string;
}

export default function MatchSquadsPreview({
  homeTeam, awayTeam, homeRoster, awayRoster, league,
}: Props) {
  return (
    <div style={{
      background: "var(--white)", border: "1px solid var(--border)",
      borderRadius: 12,
    }}>
      <div style={{
        padding: "14px 18px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: "var(--text-muted)",
          textTransform: "uppercase", letterSpacing: "0.8px",
        }}>Squads</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Lineups released before kickoff
        </span>
      </div>

      <div style={{ display: "flex", gap: 24, padding: "16px 18px" }} className="page-split">
        <TeamColumn team={homeTeam} roster={homeRoster} league={league} />
        <TeamColumn team={awayTeam} roster={awayRoster} league={league} />
      </div>
    </div>
  );
}