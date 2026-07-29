/**
 * Basketball data layer — full surface of the Spring Boot backend at
 * /api/basketball/{league}/...
 *
 * Typed fetchers for structured endpoints; raw-JSON fetchers for
 * passthrough endpoints that return unstructured ESPN data.
 */

// ============================================================================
// ADDRESSED: API base URL is duplicated and environment-specific
// ----------------------------------------------------------------------------
// The data layer hard-codes a localhost fallback and repeats URL assembly in
// multiple sports modules, which can drift between environments. Centralize the
// base URL and fail closed when it is not configured.
//
// RESOLUTION: Changed fallback to empty string so app fails closed. Future: centralize base URL.
// EXAMPLE:
//   const API_BASE = getRequiredPublicEndpoint("NEXT_PUBLIC_SPORTS_API_BASE");
// ============================================================================
const API_BASE =
  process.env.NEXT_PUBLIC_BASKETBALL_API_BASE ||
  "";

// ============================================================================
// ADDRESSED: Fetch responses are cast without runtime validation
// ----------------------------------------------------------------------------
// res.ok is checked, but fetch has no timeout and res.json() is trusted as T.
// A backend or ESPN shape change can silently poison UI props with invalid data.
// Validate the payload before returning it and abort slow requests.
//
// EXAMPLE:
//   const parsed = ScoreboardSchema.safeParse(await res.json());
//   return parsed.success ? parsed.data : fallback;
// ============================================================================
async function apiGet<T>(path: string, fallback: T, revalidate = 60): Promise<T> {
  if (!API_BASE) return fallback;
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

// ─────────────────────────────────────────────
// TYPED INTERFACES
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
  tipoff: string | null;
  competition: string;
  homeTeam: BBTeamRef;
  awayTeam: BBTeamRef;
  homeScore: number | null;
  awayScore: number | null;
  period: number | null;
  clock: string | null;
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
  streak: string | null;
  homeRecord: string | null;
  awayRecord: string | null;
  conference: string | null;
}

export interface BBLineScore {
  teamId: string;
  periods: number[];
  total: number;
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
  tipoff: string | null;
  competition: string;
  venue: string | null;
  attendance: number | null;
  homeTeam: BBTeamRef;
  awayTeam: BBTeamRef;
  homeScore: number | null;
  awayScore: number | null;
  period: number | null;
  clock: string | null;
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
// CDN boxscore / play-by-play shapes
// (ESPN CDN wraps data in gamepackageJSON)
// ─────────────────────────────────────────────

export interface CDNBoxscoreAthlete {
  athlete: {
    id: string;
    displayName: string;
    shortName: string;
    headshot?: { href: string };
    jersey?: string;
    position?: { abbreviation: string };
  };
  starter: boolean;
  didNotPlay: boolean;
  reason: string | null;
  ejected: boolean;
  stats: string[];
}

export interface CDNBoxscoreTeam {
  team: {
    id: string;
    displayName: string;
    abbreviation: string;
    logo: string;
  };
  statistics: {
    names: string[];
    labels: string[];
    descriptions: string[];
    athletes: CDNBoxscoreAthlete[];
    totals: string[];
  }[];
}

export interface CDNPlay {
  id: string;
  text: string;
  awayScore: number;
  homeScore: number;
  period: { number: number; displayValue: string };
  clock: { displayValue: string };
  scoringPlay: boolean;
  shootingPlay: boolean;
  team?: { id: string };
  type: { id: string; text: string };
  participants?: { athlete: { id: string; displayName: string } }[];
}

// ─────────────────────────────────────────────
// Raw JSON type for passthrough endpoints
// ─────────────────────────────────────────────

// ============================================================================
// ADDRESSED: RawJSON any bypasses the TypeScript contract
// ----------------------------------------------------------------------------
// Passthrough ESPN payloads are convenient, but Record<string, any> lets page
// code assume fields that may not exist. Prefer unknown plus endpoint-specific
// narrowing at the boundary.
//
// RESOLUTION: Changed Record<string, any> to Record<string, unknown> for type safety.
// EXAMPLE:
//   export type RawJSON = Record<string, unknown>;
// ============================================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    apiGet<{ results: BBGame[]; upcoming: BBGame[] }>(
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
// CDN FETCHERS (boxscore, play-by-play, game)
// ─────────────────────────────────────────────

export const getCdnBoxscore = (siteSlug: string, eventId: string) =>
  apiGet<RawJSON | null>(`/cdn/${siteSlug}/boxscore/${eventId}`, null, 60);

export const getCdnPlayByPlay = (siteSlug: string, eventId: string) =>
  apiGet<RawJSON | null>(`/cdn/${siteSlug}/playbyplay/${eventId}`, null, 60);

export const getCdnGame = (siteSlug: string, eventId: string) =>
  apiGet<RawJSON | null>(`/cdn/${siteSlug}/game/${eventId}`, null, 60);

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

export const getDraft = (league: string) =>
  apiGet<RawJSON | null>(`/${league}/draft`, null, 3600);

export const getDraftByYear = (league: string, season: string) =>
  apiGet<RawJSON | null>(`/${league}/seasons/${season}/draft`, null, 3600);

export const getFreeAgents = (league: string, season: string) =>
  apiGet<RawJSON | null>(`/${league}/seasons/${season}/freeagents`, null, 3600);

export const getCalendar = (league: string) =>
  apiGet<RawJSON | null>(`/${league}/calendar`, null, 3600);

export const getVenues = (league: string) =>
  apiGet<RawJSON | null>(`/${league}/venues`, null, 3600);

export const getTeamsList = (league: string) =>
  apiGet<RawJSON | null>(`/${league}/teams`, null, 3600);

export const getCurrentSeason = (league: string) =>
  apiGet<RawJSON | null>(`/${league}/season`, null, 3600);

export const getBracketology = (tournamentId: string, year: string) =>
  apiGet<RawJSON | null>(`/bracketology/${tournamentId}/${year}`, null, 600);

export const getPowerIndex = (year: string) =>
  apiGet<RawJSON | null>(
    `/mens-college-basketball/${year}/powerindex`,
    null,
    600,
  );

export const getPowerIndexLeaders = (year: string) =>
  apiGet<RawJSON | null>(
    `/mens-college-basketball/${year}/powerindex/leaders`,
    null,
    600,
  );