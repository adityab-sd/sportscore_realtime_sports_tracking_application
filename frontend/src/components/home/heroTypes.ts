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

export interface AestheticCardData {
  image: string;
  label: string;
  href: string;
}

export type Card =
  | { type: "match"; match: RealMatch }
  | ({ type: "aesthetic" } & AestheticCardData);
