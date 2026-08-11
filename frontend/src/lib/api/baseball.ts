/**
 * Baseball data layer — full surface of the Spring Boot backend at
 * /api/baseball/{league}/...
 *
 * Structurally identical to lib/api/basketball.ts (same fetch contract,
 * same fail-closed behaviour) but typed against the baseball DTOs: games are
 * keyed on innings + pitchers rather than periods, and line scores carry
 * runs / hits / errors.
 */

import { resolveApiBase } from "@/lib/api/base";

const API_BASE = resolveApiBase("baseball");

/**
 * Fetch a typed payload from the backend. Returns `fallback` on any failure
 * (missing base URL, non-2xx, network error, bad JSON) so callers never throw.
 * Every caller must still branch on the null/empty fallback before rendering.
 *
 * All failure paths log the reason via console.error before falling back, so
 * they show up in Vercel Runtime Logs instead of failing silently.
 */
async function apiGet<T>(path: string, fallback: T, revalidate = 60): Promise<T> {
  if (!API_BASE) {
    console.error(`[baseball.ts] NEXT_PUBLIC_BASEBALL_API_BASE is not set — skipping fetch for ${path}`);
    return fallback;
  }

  const url = `${API_BASE}${path}`;

  try {
    const res = await fetch(url, { next: { revalidate } });

    if (!res.ok) {
      console.error(`[baseball.ts] Fetch failed: ${res.status} ${res.statusText} for ${url}`);
      return fallback;
    }

    return (await res.json()) as T;
  } catch (err) {
    console.error(`[baseball.ts] Network/parse error for ${url}:`, err);
    return fallback;
  }
}

// ─────────────────────────────────────────────
// TYPED INTERFACES (match org.Spring.baseball.api.BaseballDto)
// ─────────────────────────────────────────────

export interface BBTeamRef {
  id: string;
  name: string;
  shortName: string;
  logo: string | null;
}

export interface BBGame {
  id: string;
  status: string;
  statusState: string;
  firstPitch: string | null;
  competition: string;
  homeTeam: BBTeamRef;
  awayTeam: BBTeamRef;
  homeScore: number | null;
  awayScore: number | null;
  inning: number | null;
  inningDetail: string | null;
  homePitcher: string | null;
  awayPitcher: string | null;
  _slug?: string;
}

export type BBFixture = BBGame;

export interface BBStandingRow {
  rank: number;
  teamId: string;
  team: string;
  shortName: string;
  logo: string | null;
  wins: number;
  losses: number;
  winPct: number;
  gamesBehind: number;
  divisionGamesBehind: number;
  streak: string | null;
  homeRecord: string | null;
  awayRecord: string | null;
  division: string | null;
}

export interface BBLineScore {
  teamId: string;
  innings: number[];
  runs: number;
  hits: number;
  errors: number;
}

export interface BBMatchEvent {
  minute: number;
  type: string;
  detail: string;
  player: string | null;
  assist: string | null;
  teamId: string;
}

export interface BBOfficial {
  name: string;
  position: string;
  order: number;
}

export interface BBOddsPick {
  provider: string;
  details: string | null;
  spread: number | null;
  overUnder: number | null;
  favoriteTeamId: string | null;
}

export interface BBGameDetail {
  id: string;
  status: string;
  statusState: string;
  firstPitch: string | null;
  competition: string;
  venue: string | null;
  attendance: number | null;
  homeTeam: BBTeamRef;
  awayTeam: BBTeamRef;
  homeScore: number | null;
  awayScore: number | null;
  inning: number | null;
  inningDetail: string | null;
  lineScores: BBLineScore[];
  events: BBMatchEvent[];
  officials: BBOfficial[];
  odds: BBOddsPick[];
}

export interface BBNews {
  id: string;
  headline: string;
  description: string;
  published: string;
  image: string | null;
  category: string;
  link: string | null;
}

export interface BBTeam {
  id: string;
  name: string;
  shortName: string;
  logo: string | null;
  color: string | null;
  venue: string | null;
  record: string | null;
}

export interface BBPlayer {
  id: string;
  name: string;
  jersey: string | null;
  position: string | null;
  age: number | null;
  nationality: string | null;
  headshot: string | null;
}

export interface BBLeader {
  rank: number;
  category: string;
  player: string;
  team: string;
  teamLogo: string | null;
  headshot: string | null;
  value: number;
  displayValue: string;
}

export interface BBInjury {
  athleteId: string | null;
  athleteName: string;
  team: string | null;
  status: string;
  description: string | null;
  date: string | null;
}

export interface BBTransaction {
  id: string;
  date: string | null;
  team: string | null;
  description: string;
}

export interface BBStatLine {
  label: string;
  value: string;
}

export interface BBAthleteOverview {
  id: string;
  name: string;
  position: string | null;
  team: string | null;
  headshot: string | null;
  jersey: string | null;
  age: number | null;
  nationality: string | null;
  seasonStats: BBStatLine[];
}

// ─────────────────────────────────────────────
// Raw JSON type for passthrough endpoints
// ─────────────────────────────────────────────

export type RawJSON = Record<string, unknown>;

// ─────────────────────────────────────────────
// TYPED FETCHERS
// ─────────────────────────────────────────────

export const getScoreboard = (league: string) =>
  apiGet<BBGame[]>(`/${league}/scoreboard`, [], 30);

export const getFixtures = (league: string) =>
  apiGet<{ results: BBFixture[]; upcoming: BBFixture[] }>(
    `/${league}/fixtures`,
    { results: [], upcoming: [] },
    60,
  );
export const getFixturesByDate = (league: string, date: string) =>
  apiGet<{ results: BBFixture[]; upcoming: BBFixture[] }>(
    `/${league}/fixtures?date=${date}`, { results: [], upcoming: [] }, 30);
export const getStandings = (league: string) =>
  apiGet<BBStandingRow[]>(`/${league}/standings`, [], 300);

export const getNews = (league: string, limit = 12) =>
  apiGet<BBNews[]>(`/${league}/news?limit=${limit}`, [], 120);

export const getTeam = (league: string, teamId: string) =>
  apiGet<BBTeam | null>(`/${league}/teams/${teamId}`, null, 3600);

export const getRoster = (league: string, teamId: string) =>
  apiGet<BBPlayer[]>(`/${league}/teams/${teamId}/roster`, [], 3600);

export const getLeaders = (league: string) =>
  apiGet<BBLeader[]>(`/${league}/leaders`, [], 3600);

export const getGameDetail = (league: string, eventId: string) =>
  apiGet<BBGameDetail | null>(`/${league}/match/${eventId}`, null, 30);

export const getTeamInjuries = (league: string, teamId: string) =>
  apiGet<BBInjury[]>(`/${league}/teams/${teamId}/injuries`, [], 600);

export const getLeagueInjuries = (league: string) =>
  apiGet<BBInjury[]>(`/${league}/injuries`, [], 600);

export const getTransactions = (league: string, limit = 25) =>
  apiGet<BBTransaction[]>(`/${league}/transactions?limit=${limit}`, [], 600);

export const getAthleteOverview = (league: string, athleteId: string) =>
  apiGet<BBAthleteOverview | null>(
    `/${league}/athletes/${athleteId}/overview`,
    null,
    3600,
  );

// ─────────────────────────────────────────────
// RAW-JSON FETCHERS (passthrough endpoints)
// ─────────────────────────────────────────────

export const getTeamSchedule = (league: string, teamId: string) =>
  apiGet<RawJSON | null>(`/${league}/teams/${teamId}/schedule`, null, 600);

export const getTeamRecord = (league: string, teamId: string) =>
  apiGet<RawJSON | null>(`/${league}/teams/${teamId}/record`, null, 600);

export const getTeamDepthChart = (league: string, teamId: string) =>
  apiGet<RawJSON | null>(`/${league}/teams/${teamId}/depth-charts`, null, 3600);

export const getAthleteStats = (league: string, athleteId: string) =>
  apiGet<RawJSON | null>(`/${league}/athletes/${athleteId}/stats`, null, 3600);

export const getAthleteGamelog = (league: string, athleteId: string) =>
  apiGet<RawJSON | null>(`/${league}/athletes/${athleteId}/gamelog`, null, 3600);

export const getAthleteSplits = (league: string, athleteId: string) =>
  apiGet<RawJSON | null>(`/${league}/athletes/${athleteId}/splits`, null, 3600);

export const getAthleteNews = (league: string, athleteId: string, limit = 12) =>
  apiGet<RawJSON | null>(
    `/${league}/athletes/${athleteId}/news?limit=${limit}`,
    null,
    600,
  );

export const getStatsByAthlete = (
  league: string,
  opts?: { category?: string; season?: string; sort?: string },
) => {
  const params = new URLSearchParams();
  if (opts?.category) params.set("category", opts.category);
  if (opts?.season) params.set("season", opts.season);
  if (opts?.sort) params.set("sort", opts.sort);
  const qs = params.toString();
  return apiGet<RawJSON | null>(
    `/${league}/statistics/byathlete${qs ? `?${qs}` : ""}`,
    null,
    600,
  );
};

export const getStatistics = (league: string) =>
  apiGet<RawJSON | null>(`/${league}/statistics`, null, 3600);

export const getGroups = (league: string) =>
  apiGet<RawJSON | null>(`/${league}/groups`, null, 3600);

export const getRankings = (league: string) =>
  apiGet<RawJSON | null>(`/${league}/rankings`, null, 600);

export const getDraftByYear = (league: string, season: string) =>
  apiGet<RawJSON | null>(`/${league}/seasons/${season}/draft`, null, 3600);

export const getFreeAgents = (league: string, season: string) =>
  apiGet<RawJSON | null>(`/${league}/seasons/${season}/freeagents`, null, 3600);

export const getTeamsList = (league: string) =>
  apiGet<RawJSON | null>(`/${league}/teams`, null, 3600);

