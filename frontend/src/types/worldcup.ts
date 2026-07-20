// ────────────────────────────────────────────────────────────────────────────
// Shared World Cup bracket types — used by both the fetcher (lib/api/espn.ts)
// and the renderer (components/football/WorldCupBracket.tsx). Pulled out to
// its own file so a backend endpoint can be built against this exact contract
// without needing to import anything from the component.
// ────────────────────────────────────────────────────────────────────────────

export interface BracketTeam {
  name: string;
  code: string;
  flag: string;
}

export type BracketSlot = { kind: "team"; team: BracketTeam } | { kind: "tbd"; label: string };

export type Round = "R32" | "R16" | "QF" | "SF" | "3RD" | "F";

// ADDRESSED: Bracket score fields should depend on status — converted to a discriminated
// union so completed matches require scores and upcoming matches cannot carry them.
// The renderer now handles each state safely via narrowing on status.
export type BracketMatch =
  | {
      id: string;
      round: Round;
      home: BracketSlot;
      away: BracketSlot;
      status: "completed";
      homeScore: number;
      awayScore: number;
      penalties?: { home: number; away: number };
      date: string;
      venue: string;
    }
  | {
      id: string;
      round: Round;
      home: BracketSlot;
      away: BracketSlot;
      status: "upcoming";
      homeScore?: never;
      awayScore?: never;
      penalties?: never;
      date: string;
      venue: string;
    };

export const ROUND_LABELS: Record<Round, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinals",
  SF: "Semifinals",
  "3RD": "Third Place Playoff",
  F: "Final",
};

export const ROUND_ORDER: Round[] = ["R32", "R16", "QF", "SF", "3RD", "F"];
