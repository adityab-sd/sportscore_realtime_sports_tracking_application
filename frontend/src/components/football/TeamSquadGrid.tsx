"use client";

import Link from "next/link";
import { ExpandableCard } from "@/components/football/ExpandableCard";
import type { ESPNPlayer } from "@/lib/api/espn";

const POSITION_GROUPS = [
  { key: ["G", "GK"], label: "Goalkeepers" },
  { key: ["D", "DF", "CB", "LB", "RB", "LWB", "RWB"], label: "Defenders" },
  { key: ["M", "MF", "CM", "CDM", "CAM", "LM", "RM"], label: "Midfielders" },
  { key: ["F", "FW", "ST", "CF", "LW", "RW", "SS"], label: "Attackers" },
];

const posFull: Record<string, string> = {
  G: "Goalkeeper", GK: "Goalkeeper", D: "Defender", DF: "Defender", CB: "Centre-Back",
  LB: "Left-Back", RB: "Right-Back", LWB: "Left Wing-Back", RWB: "Right Wing-Back",
  M: "Midfielder", MF: "Midfielder", CM: "Central Midfielder", CDM: "Defensive Midfielder",
  CAM: "Attacking Midfielder", LM: "Left Midfielder", RM: "Right Midfielder",
  F: "Forward", FW: "Forward", ST: "Striker", CF: "Centre-Forward",
  LW: "Left Winger", RW: "Right Winger", SS: "Second Striker",
};

function sortByJersey(players: ESPNPlayer[]) {
  return [...players].sort((a, b) => {
    const ja = parseInt(a.jersey ?? "", 10);
    const jb = parseInt(b.jersey ?? "", 10);
    return (Number.isFinite(ja) ? ja : 999) - (Number.isFinite(jb) ? jb : 999);
  });
}

function groupRoster(roster: ESPNPlayer[]) {
  const groups: { label: string; players: ESPNPlayer[] }[] = [];
  for (const g of POSITION_GROUPS) {
    const players = sortByJersey(roster.filter(p => p.position && g.key.includes(p.position)));
    if (players.length > 0) groups.push({ label: g.label, players });
  }
  const assigned = new Set(groups.flatMap(g => g.players.map(p => p.id)));
  const rest = sortByJersey(roster.filter(p => !assigned.has(p.id)));
  if (rest.length > 0) groups.push({ label: "Other", players: rest });
  return groups;
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
}

interface Props {
  roster: ESPNPlayer[];
  league: string;
  teamId: string;
  teamColor?: string | null;
}

export default function TeamSquadGrid({ roster, league, teamId, teamColor }: Props) {
  const grouped = groupRoster(roster);
  if (roster.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Squad data unavailable.</p>;
  }
  const accent = teamColor ? `#${teamColor.replace("#", "")}` : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {grouped.map(({ label, players }) => (
        <section key={label}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", margin: 0, letterSpacing: "-0.3px" }}>
              {label}
            </h3>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{players.length}</span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 14,
            }}
            className="squad-grid"
          >
            {players.map((p) => {
              const position = p.position ? (posFull[p.position] ?? p.position) : "Player";
              return (
                <ExpandableCard
                  key={p.id}
                  title={p.name}
                  src={p.headshot}
                  initials={initialsFor(p.name)}
                  accentColor={accent}
                  description={p.jersey ? `#${p.jersey} · ${position}` : position}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {p.age != null && <BioRow label="Age" value={String(p.age)} />}
                    {p.nationality && <BioRow label="Nationality" value={p.nationality} />}
                    {p.jersey && <BioRow label="Squad number" value={`#${p.jersey}`} />}
                    <BioRow label="Position" value={position} />
                  </div>
                  <Link
                    href={`/football/player/${p.id}?league=${league}&team=${teamId}`}
                    style={{
                      marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6,
                      fontSize: 13, fontWeight: 700, color: "var(--navy)", background: "var(--navy-light)",
                      padding: "9px 14px", borderRadius: 8, textDecoration: "none", width: "fit-content",
                    }}
                  >
                    Full player page →
                  </Link>
                </ExpandableCard>
              );
            })}
          </div>
        </section>
      ))}

      <style>{`
        @media (max-width: 900px) { .squad-grid { grid-template-columns: repeat(3, minmax(0,1fr)) !important; } }
        @media (max-width: 640px) { .squad-grid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; } }
      `}</style>
    </div>
  );
}

function BioRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
      <span style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</span>
      <span style={{ color: "var(--obsidian)", fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}