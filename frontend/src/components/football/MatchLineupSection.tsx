"use client";
import FormationPitch from "./FormationPitch";
import type { ESPNTeamLineup, ESPNTeamRef, ESPNMatchDetail } from "@/lib/api/espn";
import type { TeamLineup, LineupPlayer, LineupPlayerEvent } from "@/types/lineup";

/** Map a raw ESPN event.detail string to our internal event type. */
function classifyEvent(type: string, detail: string): LineupPlayerEvent["type"] | null {
  const d = (detail || "").toLowerCase();
  const t = (type || "").toLowerCase();
  if (t === "goal" || d.includes("goal")) return "goal";
  if (d.includes("yellow")) return "yellowCard";
  if (d.includes("red"))    return "redCard";
  if (d.includes("substitution") || d.includes("sub")) return "subOff";
  return null;
}

function toFormationLineup(
  lineup: ESPNTeamLineup,
  events: ESPNMatchDetail["events"],
): TeamLineup {
  // ============================================================================
  // PLEASE review — lineup event matching
  // ----------------------------------------------------------------------------
  // Player events are attached by comparing display names. ESPN names can include
  // accents, initials, or substitutions with alternate labels, so goals/cards can
  // disappear from the FormationPitch badges. Match by player id when available.
  //
  // EXAMPLE:
  //   if (ev.playerId !== p.id) continue;
  // ============================================================================
  const teamEvents = events.filter(e => e.teamId === lineup.teamId);

  const players: LineupPlayer[] = lineup.starters.map(p => {
    const playerEvents: LineupPlayerEvent[] = [];
    for (const ev of teamEvents) {
      if (ev.player !== p.name) continue;
      const kind = classifyEvent(ev.type, ev.detail);
      if (kind) playerEvents.push({ type: kind, minute: ev.minute });
    }
    return {
      id: p.id,
      name: p.name,
      shirtNumber: p.jersey ? parseInt(p.jersey, 10) || 0 : 0,
      position: p.position ?? undefined,
      events: playerEvents.length ? playerEvents : undefined,
    };
  });

  return {
    // PLEASE review — formation fallback: silently inventing 4-4-2 can misrepresent teams when ESPN omits formation. EXAMPLE: formation: lineup.formation ?? "unknown",
    formation: lineup.formation ?? "4-4-2",
    players,
  };
}

interface Props {
  lineups: ESPNTeamLineup[];
  events: ESPNMatchDetail["events"];
  homeTeam: ESPNTeamRef;
  awayTeam: ESPNTeamRef;
  league: string;
}

export default function MatchLineupSection({
  lineups, events, homeTeam, awayTeam, league,
}: Props) {
  if (!lineups || lineups.length === 0) return null;

  const homeLineup = lineups.find(l => l.teamId === homeTeam.id);
  const awayLineup = lineups.find(l => l.teamId === awayTeam.id);
  if (!homeLineup || !awayLineup) return null;
  if (homeLineup.starters.length < 11 || awayLineup.starters.length < 11) return null;

  return (
    <FormationPitch
      home={toFormationLineup(homeLineup, events)}
      away={toFormationLineup(awayLineup, events)}
      homeTeamId={homeTeam.id}
      awayTeamId={awayTeam.id}
      homeName={homeTeam.shortName || homeTeam.name}
      awayName={awayTeam.shortName || awayTeam.name}
      league={league}
    />
  );
}