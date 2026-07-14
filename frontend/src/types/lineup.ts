export interface TeamLineup {
  formation: string;
  players: LineupPlayer[];
}

export interface LineupPlayer {
  id: string;
  name: string;
  shirtNumber: number;
  position?: string;
  events?: LineupPlayerEvent[];
}

// ============================================================================
// PLEASE review — Lineup events need direction-specific payloads
// ----------------------------------------------------------------------------
// A single union of string literals loses fields needed for substitutions and
// cards, and it cannot enforce that subOff has a replacement player. Use a
// discriminated union with event-specific properties.
//
// EXAMPLE:
//   type LineupPlayerEvent = { type: "goal"; minute: number } | { type: "subOff"; minute: number; replacementId: string };
// ============================================================================
export interface LineupPlayerEvent {
  type: "goal" | "yellowCard" | "redCard" | "subOff";
  minute: number;
}