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

export interface LineupPlayerEvent {
  type: "goal" | "yellowCard" | "redCard" | "subOff";
  minute: number;
}