// ── Unified model (matches backend org.Spring.model exactly) ──

export interface Team {
  id: number;
  name: string;
  shortName: string;
  logo: string | null;
}

// ============================================================================
// PLEASE review — Event type union is defeated by string
// ----------------------------------------------------------------------------
// Adding `| string` makes every value valid, so UI exhaustiveness checks cannot
// catch unsupported event icons or labels. Use an explicit unknown bucket instead.
//
// EXAMPLE:
//   export type MatchEventType = "goal" | "card" | "subst" | "unknown";
// ============================================================================
export type MatchEventType = "goal" | "card" | "subst" | string;

export interface MatchEvent {
  minute: number;
  type: string;
  detail: string;
  player: string | null;
  assist: string | null;
  teamId: number;
}

export interface Match {
  id: number;
  sport?: string; // "football" | "basketball" | "cricket" - filter to "football" on football pages
  status: string;
  elapsed: number | null;
  kickoff: string | null;
  competition: string;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
  events: MatchEvent[];
}

// ── League registry ──

export interface LeagueInfo {
  slug: string;
  name: string;
  short: string;
  logo: string;
  /** Brand color used for the league banner background (hex). */
  accent: string;
  /** Optional banner image URL - overrides the gradient when set. */
  banner?: string;
}

const espnLogo = (id: number) =>
  `https://a.espncdn.com/combiner/i?img=%2Fi%2Fleaguelogos%2Fsoccer%2F500%2F${id}.png&w=80&h=80&scale=crop`;

export const LEAGUES: LeagueInfo[] = [
  { slug: "fifa.world",     name: "World Cup 2026",   short: "World Cup",  logo: espnLogo(4),  accent: "#e30b1c" },
  { slug: "uefa.champions", name: "Champions League", short: "UCL",        logo: espnLogo(2),  accent: "#0033a0" },
  { slug: "eng.1",          name: "Premier League",   short: "PL",         logo: espnLogo(23), accent: "#38003c" },
  { slug: "esp.1",          name: "La Liga",          short: "La Liga",    logo: espnLogo(15), accent: "#ee8707" },
  { slug: "ita.1",          name: "Serie A",          short: "Serie A",    logo: espnLogo(12), accent: "#008fd7" },
  { slug: "ger.1",          name: "Bundesliga",       short: "Bundesliga", logo: espnLogo(10), accent: "#d20515" },
  { slug: "fra.1",          name: "Ligue 1",          short: "Ligue 1",    logo: espnLogo(9),  accent: "#091c3e" },
  { slug: "usa.1",          name: "MLS",              short: "MLS",        logo: espnLogo(19), accent: "#4f1681" },
  { slug: "bra.1",          name: "Brasileirão",      short: "Brazil",     logo: espnLogo(85), accent: "#009c3b" },
];

export const leagueName = (slug: string): string =>
  LEAGUES.find(l => l.slug === slug)?.name ?? slug;

export const leagueLogo = (slug: string): string =>
  LEAGUES.find(l => l.slug === slug)?.logo ?? "";

export const leagueBySlug = (slug: string): LeagueInfo | undefined =>
  LEAGUES.find(l => l.slug === slug);

/** Find LeagueInfo from a competition NAME (e.g. "Premier League"). Tolerant of variants. */
export function leagueByName(name: string): LeagueInfo | undefined {
  if (!name) return undefined;
  const exact = LEAGUES.find(l => l.name.toLowerCase() === name.toLowerCase());
  if (exact) return exact;
  const lower = name.toLowerCase();
  if (lower.includes("champions"))   return LEAGUES.find(l => l.slug === "uefa.champions");
  if (lower.includes("world cup"))   return LEAGUES.find(l => l.slug === "fifa.world");
  if (lower.includes("premier"))     return LEAGUES.find(l => l.slug === "eng.1");
  if (lower.includes("bundesliga"))  return LEAGUES.find(l => l.slug === "ger.1");
  if (lower.includes("serie a"))     return LEAGUES.find(l => l.slug === "ita.1");
  if (lower.includes("ligue 1"))     return LEAGUES.find(l => l.slug === "fra.1");
  if (lower.includes("la liga"))     return LEAGUES.find(l => l.slug === "esp.1");
  if (lower.includes("mls"))         return LEAGUES.find(l => l.slug === "usa.1");
  if (lower.includes("brasileir") || lower.includes("brazil")) return LEAGUES.find(l => l.slug === "bra.1");
  return undefined;
}

// ── Status classification ──

export type MatchState = "live" | "scheduled" | "finished";

export function classifyStatus(status: string | null | undefined): MatchState {
  if (!status) return "scheduled";
  const s = status.toUpperCase();
  if (s.includes("FT") || s.includes("FULL")) return "finished";
  if (s.includes("AT ") || s.includes("TBD") || s.includes("SCHEDULED")) return "scheduled";
  if (s.includes("NS") || s.includes("NOT STARTED")) return "scheduled";
  if (s.includes("CANCEL") || s.includes("POSTPON")) return "scheduled";
  const hasMinute = /\d+'/.test(s);
  const inPlay = s.includes("1H") || s.includes("2H") || s.includes("HT") || s.includes("ET") || s.includes("LIVE");
  return (hasMinute || inPlay) ? "live" : "finished";
}

export const matchState = classifyStatus;
export const isLive = (status: string | null | undefined) => classifyStatus(status) === "live";

export function statusLabel(m: Match): string {
  const state = classifyStatus(m.status);
  if (state === "live") return m.status ?? "LIVE";
  if (state === "finished") return "FT";
  if (m.kickoff) {
    const d = new Date(m.kickoff);
    const h = d.getUTCHours().toString().padStart(2, "0");
    const min = d.getUTCMinutes().toString().padStart(2, "0");
    return `${h}:${min}`;
  }
  return m.status ?? "";
}