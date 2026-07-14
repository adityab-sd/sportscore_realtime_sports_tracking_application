// ────────────────────────────────────────────────────────────────────────────
// Shared World Cup bracket types — used by both the fetcher (lib/api/espn.ts)
// and the renderer (components/football/WorldCupBracket.tsx). Pulled out to
// its own file so a backend endpoint can be built against this exact contract
// without needing to import anything from the component.
// ────────────────────────────────────────────────────────────────────────────

export interface BracketTeam {
  name: string;
  code: string; // 3-letter code, used in the compact mobile-width view
  flag: string; // emoji (mock data) OR a crest image URL (live backend data) — WorldCupBracket.tsx's SlotRow renders whichever this actually is
}

/** A slot is either a confirmed team, or a placeholder for a team that hasn't been decided yet. */
export type BracketSlot = { kind: "team"; team: BracketTeam } | { kind: "tbd"; label: string };

export type Round = "R32" | "R16" | "QF" | "SF" | "3RD" | "F";

export interface BracketMatch {
  id: string;
  round: Round;
  home: BracketSlot;
  away: BracketSlot;
  homeScore?: number;
  awayScore?: number;
  /** Set when a match went to a shootout — these are penalty goals, not regulation. */
  penalties?: { home: number; away: number };
  status: "completed" | "upcoming";
  /** Display string only. */
  date: string;
  venue: string;
}

export const ROUND_LABELS: Record<Round, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinals",
  SF: "Semifinals",
  "3RD": "Third Place Playoff",
  F: "Final",
};

export const ROUND_ORDER: Round[] = ["R32", "R16", "QF", "SF", "3RD", "F"];