// Types for the ESPN match "summary" sections: leaders, boxscore team stats,
// and recent form. The backend needs to forward these (see BACKEND spec).
// All optional / nullable so components degrade gracefully before wiring.

/** A single match leader (top shooter, pass master, etc.) with player profile. */
export interface MatchLeader {
  category: string;        // e.g. "Shots", "Accurate Passes", "Defensive", "Goalkeeping"
  displayName: string;     // human label for the category
  playerId: string | null;
  player: string;          // player name
  jersey: string | null;
  position: string | null; // e.g. "Center Left Defender"
  team: "home" | "away";
  teamShort: string;
  value: string;           // headline stat, e.g. "4 shots" or "42/47"
  detail?: string | null;  // sub-line, e.g. "1 on goal, 0.12 xG"
  imageUrl?: string | null;
}

/** One row in the team-stats comparison (home vs away). */
export interface TeamStatRow {
  label: string;           // "Possession", "Total Shots", ...
  home: string;            // display value, e.g. "57.3%", "8 (0)"
  away: string;
  homePct?: number | null; // 0..100 for the bar fill (optional)
  awayPct?: number | null;
  group?: string;          // section header, e.g. "Attack", "Passes", "Duels"
}

/** Expected-goals breakdown block. */
export interface XgBreakdown {
  label: string;           // "Expected Goals (xG)", "xG Open Play", ...
  home: string;
  away: string;
}

/** A recent-form result for the last-five list. */
export interface FormResult {
  date: string;            // "7/29/26"
  opponentShort: string;   // "DYJ"
  homeAway: "H" | "A" | null;
  result: string;          // "2-1"
  outcome: "W" | "D" | "L" | null;
  competition: string;
}

/** The full match summary the backend should forward alongside MatchDetail. */
export interface MatchSummary {
  leaders?: MatchLeader[];
  teamStats?: TeamStatRow[];
  xg?: XgBreakdown[];
  homeForm?: FormResult[];
  awayForm?: FormResult[];
  momentum?: { minute: number; value: number }[];
  referee?: string | null;
  stadium?: string | null;
  location?: string | null;
}