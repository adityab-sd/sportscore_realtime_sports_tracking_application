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

// ADDRESSED: Lineup events need direction-specific payloads — converted to a discriminated
// union with event-specific properties. subOff now requires a replacementId so the UI can
// show which player came on. Other event types carry only a minute.
export type LineupPlayerEvent =
  | { type: "goal"; minute: number }
  | { type: "yellowCard"; minute: number }
  | { type: "redCard"; minute: number }
  | { type: "subOff"; minute: number; replacementId?: string };
