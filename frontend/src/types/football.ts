// ── Unified model (matches backend org.Spring.model exactly) ──

export interface Team {
  id: number;
  name: string;
  shortName: string;
  logo: string | null;
}

// ADDRESSED: Event type union is defeated by string — replaced `| string` with explicit `"unknown"` bucket
// so UI exhaustiveness checks (switch/if) can catch unsupported event icons or labels at compile time.
export type MatchEventType = "goal" | "card" | "subst" | "unknown";

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
  leagueSlug?: string;
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
  { slug: "arg.1",          name: "Argentine Primera", short: "Argentina",  logo: espnLogo(86), accent: "#75aadb" },
  { slug: "uefa.europa",    name: "Europa League",    short: "UEL",        logo: espnLogo(3),  accent: "#f47a20" },
  { slug: "uefa.europa.conf", name: "Europa Conf.",   short: "UECL",       logo: espnLogo(5),  accent: "#f47a20" },
  { slug: "fifa.friendly",  name: "International Friendlies", short: "Friendlies", logo: espnLogo(4), accent: "#e30b1c" },
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
  // Country-specific checks FIRST — before generic competition names they contain.
  if (lower.includes("brasileir") || lower.includes("brazil"))    return LEAGUES.find(l => l.slug === "bra.1");
  if (lower.includes("argentine") || lower.includes("argentina")) return LEAGUES.find(l => l.slug === "arg.1");
  if (lower.includes("serie a"))     return LEAGUES.find(l => l.slug === "ita.1");
  if (lower.includes("ligue 1"))     return LEAGUES.find(l => l.slug === "fra.1");
  if (lower.includes("la liga") || lower.includes("laliga")) return LEAGUES.find(l => l.slug === "esp.1");
  if (lower.includes("mls"))         return LEAGUES.find(l => l.slug === "usa.1");
  return undefined;
}

// ── Status classification ──

export type MatchState = "live" | "scheduled" | "finished";

export function classifyStatus(status: string | null | undefined): MatchState {
  if (!status) return "scheduled";
  const s = status.toUpperCase().trim();
  // Finished — check before ET to prevent AET being caught as live
  if (s === "FT" || s.includes("FULL TIME") || s.includes("FULL")) return "finished";
  if (s === "AET" || s.includes("AFTER EXTRA") || s.includes("PENALTIES")) return "finished";
  if (s === "POST" || s === "FINISHED" || s.includes("FINAL")) return "finished";
  // Scheduled
  if (s.includes("TBD") || s.includes("SCHEDULED") || s.includes("AT ")) return "scheduled";
  if (s.includes("NS") || s.includes("NOT STARTED")) return "scheduled";
  if (s.includes("CANCEL") || s.includes("POSTPON")) return "scheduled";
  // Live
  const hasMinute = /\d+'/.test(s);
  const inPlay = s.includes("1H") || s.includes("2H") || s.includes("HT") || s.includes("LIVE");
  const inET = s.includes("ET") && hasMinute; // ET only live if has minute marker
  return (hasMinute || inPlay || inET) ? "live" : "scheduled";
}

export const matchState = classifyStatus;
export const isLive = (status: string | null | undefined) => classifyStatus(status) === "live";

/**
 * parseElapsedFromStatus — derive the live match minute from the ESPN status
 * string, because the match-detail payload carries NO separate `elapsed`/clock
 * field (only the live-scores stream does). Without this the detail clock has
 * nothing to anchor to and either shows static text or ticks up from 0:00.
 *
 * Returns the elapsed minute for live matches, or null when it can't be derived
 * (e.g. "1H"/"2H"/"LIVE" with no minute) — in which case the ticking clock
 * simply holds its last good anchor rather than jumping.
 *
 * Examples: "63'" → 63 · "45'+2'" → 47 · "90'+4'" → 94 · "HT" → 45 ·
 *           "2H 58'" → 58 · "1H"/"FT"/"LIVE" → null
 */
export function parseElapsedFromStatus(status: string | null | undefined): number | null {
  if (!status) return null;
  if (classifyStatus(status) !== "live") return null;
  const s = status.toUpperCase().trim();
  if (s.includes("HT")) return 45; // halftime freezes at 45:00
  // Primary: a minute marker with a prime, e.g. "63'", "45'+2'", "90'+4'", "2H 58'"
  let m = s.match(/(\d+)\s*'\s*(?:\+\s*(\d+))?/);
  if (m) {
    const base = Number(m[1]);
    const added = m[2] ? Number(m[2]) : 0;
    if (!Number.isNaN(base)) return base + added;
  }
  // Secondary: pure numeric forms like "90+3" or "45" (NOT period markers 1H/2H)
  m = s.match(/^(\d+)(?:\s*\+\s*(\d+))?$/);
  if (m) {
    const base = Number(m[1]);
    const added = m[2] ? Number(m[2]) : 0;
    if (!Number.isNaN(base)) return base + added;
  }
  return null;
}

export function statusLabel(m: Match): string {
  const state = classifyStatus(m.status);
  if (state === "live") return m.status ?? "LIVE";
  if (state === "finished") return "FT";
  if (m.kickoff) {
    const d = new Date(m.kickoff);
    // ADDRESSED: guarded Date parsing — invalid kickoff now returns empty string instead of NaN:NaN
    if (Number.isNaN(d.getTime())) return m.status ?? "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return m.status ?? "";
}

/** Returns true for leagues that have a full standings table. */
export function leagueHasFullTable(slug: string): boolean {
  const noTable = new Set(["fifa.world", "fifa.friendly", "uefa.champions", "uefa.europa", "uefa.europa.conf"]);
  return !noTable.has(slug);
}