// Play & shot coordinate types — the data the backend forwards from ESPN's
// /plays?limit=300 endpoint. These extend the existing football types without
// modifying them.
//
// BACKEND NOTE: your FootballService already fetches the plays endpoint to pull
// player names. You just need to forward these coordinate fields in the DTO
// instead of discarding them after name extraction.

export type PlayResult =
  | "goal"
  | "shot-on-target"
  | "shot-off-target"
  | "shot-blocked"
  | "save"
  | "other";

export interface PlayPoint {
  /** ESPN play id (stable, used for React keys + dedup). */
  id: string;
  /** Seconds from kickoff (from clock.value). The sync key for playback. */
  clockSeconds: number;
  /** Display minute (from clock.displayValue), e.g. "45+2'". */
  minute: string;
  /** Half / period number. */
  period: number;
  /** Raw ESPN type slug (e.g. "shot-on-target", "foul", "throw-in"). */
  type: string;
  /** Normalized result bucket for rendering. */
  result: PlayResult;
  /** Full commentary text (already includes player name). */
  text: string;
  /** "home" | "away" | null (resolved against competitor ids). */
  team: "home" | "away" | null;
  /** Primary player name, if resolvable. */
  player: string | null;
  /** ESPN athlete id for hyperlinking to the player page (if forwarded). */
  playerId?: string | null;
  /** Shirt number (if forwarded from participants[].jersey). */
  jersey?: string | null;
  /** Player position label, e.g. "Left Forward" (if forwarded). */
  position?: string | null;

  // Field position — normalized 0..1. (0,0) means "no coordinate".
  fx: number;
  fy: number;
  // Destination / trajectory end — normalized 0..1.
  f2x: number;
  f2y: number;
  // Goal-mouth placement — normalized 0..1 (only for shots on goal).
  gx: number;
  gy: number;

  // Flags mirrored from ESPN.
  scoring: boolean;
  yellowCard: boolean;
  redCard: boolean;
  substitution: boolean;
  priority: boolean;
}

/** A shot is just a PlayPoint whose result is a shot/goal. */
export type Shot = PlayPoint;

export function isShot(p: PlayPoint): p is Shot {
  return (
    p.result === "goal" ||
    p.result === "shot-on-target" ||
    p.result === "shot-off-target" ||
    p.result === "shot-blocked"
  );
}

/** Has usable field coordinates for plotting. */
export function hasFieldPos(p: PlayPoint): boolean {
  return p.fx > 0 || p.fy > 0;
}