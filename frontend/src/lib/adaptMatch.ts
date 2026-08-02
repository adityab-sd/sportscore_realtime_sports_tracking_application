import type { ESPNMatchDetail } from "@/lib/api/espn";
import type { Match as FootballMatch } from "@/types/football";
import { parseElapsedFromStatus } from "@/types/football";

/**
 * toUnifiedMatch — map an ESPN match-detail payload into the app's unified
 * `Match` shape. Shared by the server page (first paint) and the client live
 * section (every 30s poll) so both build the exact same object from the same
 * source of truth.
 *
 * Two things it does that matter for LIVE correctness:
 *  1. Derives `elapsed` from the status string (the detail payload has no
 *     dedicated clock field), so the ticking clock has something to anchor to.
 *  2. Deduplicates events (ESPN sometimes emits a generic "Goal"/"Goal" entry
 *     alongside the richer named one).
 */
export function toUnifiedMatch(m: ESPNMatchDetail): FootballMatch {
  const raw = m.events.map(e => ({
    minute: e.minute, type: e.type, detail: e.detail,
    player: e.player, assist: e.assist, teamId: Number(e.teamId),
  }));

  const deduped = raw.filter((ev, _idx, arr) => {
    const isGeneric = !ev.player || ev.player.toLowerCase() === ev.type.toLowerCase()
      || ev.player.toLowerCase() === ev.detail?.toLowerCase();
    if (!isGeneric) return true; // keep detailed entries always
    const hasRicher = arr.some(
      other => other !== ev
        && other.minute === ev.minute
        && String(other.teamId) === String(ev.teamId)
        && other.type === ev.type
        && other.player
        && other.player.toLowerCase() !== other.type.toLowerCase()
    );
    return !hasRicher; // drop generic if a richer duplicate exists
  });

  return {
    id: Number(m.id),
    sport: "football",
    status: m.status,
    // Derived from the status string — the detail endpoint carries no clock field.
    elapsed: parseElapsedFromStatus(m.status),
    kickoff: m.kickoff,
    competition: m.competition,
    homeTeam: { id: Number(m.homeTeam.id), name: m.homeTeam.name, shortName: m.homeTeam.shortName, logo: m.homeTeam.logo },
    awayTeam: { id: Number(m.awayTeam.id), name: m.awayTeam.name, shortName: m.awayTeam.shortName, logo: m.awayTeam.logo },
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    events: deduped,
  };
}