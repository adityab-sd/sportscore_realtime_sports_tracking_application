// This file exports the league registry + status helpers used by pages.

export interface LeagueInfo {
  slug: string;
  name: string;
  short: string;
  logo: string;
}

const espnLogo = (slug: string) =>
  `https://a.espncdn.com/i/teamlogos/leagues/500/${slug}.png`;

export const LEAGUES: LeagueInfo[] = [
  { slug: "nba",                       name: "NBA",                          short: "NBA",      logo: espnLogo("nba")  },
  { slug: "wnba",                      name: "WNBA",                         short: "WNBA",     logo: espnLogo("wnba") },
  { slug: "nba-summer-las-vegas",      name: "NBA Summer League",            short: "Summer",   logo: espnLogo("nba")  },
  { slug: "mens-college-basketball",   name: "NCAA Men's Basketball",        short: "NCAAM",    logo: espnLogo("ncaa") },
  { slug: "womens-college-basketball", name: "NCAA Women's Basketball",      short: "NCAAW",    logo: espnLogo("ncaa_wbball") },
  { slug: "nba-development",           name: "NBA G League",                 short: "G-LG",     logo: espnLogo("nba")  },
];

export const leagueName = (slug: string): string =>
  LEAGUES.find(l => l.slug === slug)?.name ?? slug;

export const leagueLogo = (slug: string): string =>
  LEAGUES.find(l => l.slug === slug)?.logo ?? "";

// ── Status classification ──
// ESPN sends statusState "pre" | "in" | "post" — trivial to classify.

export type GameState = "live" | "scheduled" | "finished";

export function classifyStatus(statusState: string | null | undefined): GameState {
  if (statusState === "in")   return "live";
  if (statusState === "post") return "finished";
  return "scheduled";
}

export function periodLabel(period: number | null, league: string): string {
  if (period == null) return "";
  // NCAA uses halves, everything else uses quarters
  const isHalves = league.includes("college-basketball");
  if (isHalves) {
    if (period <= 2) return `H${period}`;
    const otNum = period - 2;
    return otNum === 1 ? "OT" : `${otNum}OT`;
  }
  const regulation = 4;
  if (period <= regulation) return `Q${period}`;
  const otNum = period - regulation;
  return otNum === 1 ? "OT" : `${otNum}OT`;
}