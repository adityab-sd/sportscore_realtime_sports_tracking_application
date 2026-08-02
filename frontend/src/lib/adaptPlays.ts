import type { Match } from "@/types/football";
import type { PlayPoint, PlayResult } from "@/types/plays";

/**
 * adaptPlays — convert the ESPN match-detail `plays` array into PlayPoint[].
 *
 * The backend forwards ESPN plays (see backend DTO note in the integration
 * README). This maps them to the normalized shape the pitch components expect.
 *
 * DEFENSIVE: follows the project convention — Array.isArray guards and ?? on
 * every ESPN field, since the payload is often partial for live matches.
 *
 * Team resolution: ESPN gives a team id per play; we compare against the match's
 * home/away team ids to decide the "home"/"away" side.
 */

/** ESPN field/goal coordinates come on a 0..100 scale. Convert to 0..1 and
 *  clamp — ESPN sometimes emits slightly out-of-range values (e.g. 101.4, -1.0)
 *  for balls crossing the touchline, which would otherwise render off-pitch. */
function norm(v: unknown): number {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n / 100));
}

function toResult(type: string, scoring: boolean): PlayResult {
  // Any scoring play (incl. "penalty---scored", "goal") is a goal.
  if (scoring) return "goal";
  const t = (type ?? "").toLowerCase();
  // NOTE: ESPN emits a separate "save" play for the keeper AFTER the
  // "shot-on-target" play. We map the shot from shot-on-target and treat the
  // keeper's "save" play as non-plotted ("save") so shots aren't double-counted.
  if (t.includes("shot-on")) return "shot-on-target";
  if (t.includes("shot-off")) return "shot-off-target";
  // Match the real blocked-SHOT type only. ESPN also emits "blocked-pass"
  // (a defender blocking a pass) which contains "block" but is NOT a shot —
  // guarding on "shot-block" keeps those out of the shot map.
  if (t.includes("shot-block")) return "shot-blocked";
  if (t === "save") return "save";
  return "other";
}

// Accepts the loosely-typed ESPN detail object your backend returns.
export function adaptPlays(detail: any, match: Match): PlayPoint[] {
  const raw = detail?.plays;
  if (!Array.isArray(raw)) return [];

  // NOTE: ESPN's play teamId is a STRING ("17606") while Match.homeTeam.id is a
  // NUMBER. Compare as strings on both sides so strict equality actually matches.
  const homeId = match.homeTeam?.id != null ? String(match.homeTeam.id) : null;
  const awayId = match.awayTeam?.id != null ? String(match.awayTeam.id) : null;

  const out: PlayPoint[] = [];

  for (const p of raw) {
    if (!p) continue;

    const type = String(p.type ?? p.playType ?? "");
    const scoring = Boolean(p.scoring ?? p.scoringPlay ?? false);
    const rawTeamId = p.teamId ?? p.team?.id ?? null;
    const teamId = rawTeamId != null ? String(rawTeamId) : null;

    const team: "home" | "away" | null =
      teamId != null && teamId === homeId
        ? "home"
        : teamId != null && teamId === awayId
        ? "away"
        : null;

    out.push({
      id: String(p.id ?? `${p.clockSeconds ?? 0}-${out.length}`),
      clockSeconds: Number(p.clockSeconds ?? p.clock?.value ?? 0),
      minute: String(p.minute ?? p.clock?.displayValue ?? ""),
      period: Number(p.period ?? p.period?.number ?? 1),
      type,
      result: toResult(type, scoring),
      text: String(p.text ?? p.commentary ?? ""),
      team,
      player: p.player ?? null,
      playerId: p.playerId ?? p.athleteId ?? null,
      jersey: p.jersey != null ? String(p.jersey) : null,
      position: p.position ?? null,
      // ESPN returns coordinates on a 0..100 scale; normalize to 0..1 for the
      // pitch renderer. norm() also clamps stray out-of-range values (ESPN
      // occasionally emits e.g. 101.4 or -1.0 for balls that cross the line).
      fx: norm(p.fx ?? p.fieldPositionX),
      fy: norm(p.fy ?? p.fieldPositionY),
      f2x: norm(p.f2x ?? p.fieldPosition2X),
      f2y: norm(p.f2y ?? p.fieldPosition2Y),
      gx: norm(p.gx ?? p.goalPositionX),
      gy: norm(p.gy ?? p.goalPositionY),
      scoring,
      yellowCard: Boolean(p.yellowCard ?? false),
      redCard: Boolean(p.redCard ?? false),
      substitution: Boolean(p.substitution ?? false),
      priority: Boolean(p.priority ?? false),
    });
  }

  // Sort by clock so the tracker/feed are chronological.
  out.sort((a, b) => a.clockSeconds - b.clockSeconds);
  return out;
}