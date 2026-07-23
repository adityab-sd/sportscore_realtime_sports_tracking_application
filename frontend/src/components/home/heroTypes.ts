// heroTypes.ts is now superseded by the types exported from HeroScrollClient.tsx.
// Kept for backward compatibility — HeroScrollRows.tsx still imports from here.
// Both files use the same shape.

export interface RealMatch {
  id: string;
  sport: "football" | "basketball";
  leagueSlug: string;
  leagueLabel: string;
  bgImage: string;
  home: string;
  away: string;
  homeLogo: string | null;
  awayLogo: string | null;
  kickoff: string | null;
  href: string;
}

export type Card =
  | { type: "match"; match: RealMatch };