// Baseball league registry + status helpers used by /baseball pages.
// Mirrors the shape of types/basketball.ts so the two sports share the same
// page/component structure, differing only in league metadata and the
// sport-specific status vocabulary (innings instead of periods).

export interface LeagueInfo {
  slug: string;
  name: string;
  short: string;
  logo: string;
  /** Brand color used for banners/accents (hex). */
  accent: string;
}

const espnLogo = (slug: string) =>
  `https://a.espncdn.com/i/teamlogos/leagues/500/${slug}.png`;

export const LEAGUES: LeagueInfo[] = [
  { slug: "mlb",              name: "MLB",                 short: "MLB",    logo: espnLogo("mlb"),  accent: "#002d72" },
  { slug: "college-baseball", name: "NCAA Baseball",       short: "NCAA",   logo: espnLogo("ncaa"), accent: "#0033a0" },
];

export const leagueName = (slug: string): string =>
  LEAGUES.find(l => l.slug === slug)?.name ?? slug;

export const leagueLogo = (slug: string): string =>
  LEAGUES.find(l => l.slug === slug)?.logo ?? "";

export const leagueBySlug = (slug: string): LeagueInfo | undefined =>
  LEAGUES.find(l => l.slug === slug);

// ── Status classification ──
// ESPN exposes a closed status state: "pre" | "in" | "post".

export type GameState = "live" | "scheduled" | "finished";

export type ESPNStatusState = "pre" | "in" | "post";

export function classifyStatus(statusState: string | null | undefined): GameState {
  if (statusState === "in")   return "live";
  if (statusState === "post") return "finished";
  if (statusState === "pre")  return "scheduled";
  if (statusState && statusState !== "pre") {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[baseball] Unknown ESPN statusState: "${statusState}", treating as scheduled`);
    }
  }
  return "scheduled";
}

export const isLive = (statusState: string | null | undefined) =>
  classifyStatus(statusState) === "live";

/**
 * Human label for the current inning. ESPN's `inningDetail` (e.g. "Top 5th",
 * "Bottom 9th", "Mid 3rd") is the richest source; fall back to a plain ordinal
 * built from the numeric inning when detail is absent.
 */
export function inningLabel(inning: number | null, inningDetail: string | null): string {
  if (inningDetail) return inningDetail;
  if (inning == null) return "";
  const suffix =
    inning % 10 === 1 && inning % 100 !== 11 ? "st" :
    inning % 10 === 2 && inning % 100 !== 12 ? "nd" :
    inning % 10 === 3 && inning % 100 !== 13 ? "rd" : "th";
  return `${inning}${suffix}`;
}
