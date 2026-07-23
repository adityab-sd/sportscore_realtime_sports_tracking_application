import type { BracketMatch } from "@/types/worldcup";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawJSON = Record<string, any> | null;

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

// ═══════════════════════════════════════════════════════════════
//  Shared interfaces
// ═══════════════════════════════════════════════════════════════

export interface ESPNTeamRef {
  id: string; name: string; shortName: string; logo: string | null;
}

export interface ESPNMatch {
  id: string; status: string; statusState: string; kickoff: string | null;
  competition: string; homeTeam: ESPNTeamRef; awayTeam: ESPNTeamRef;
  homeScore: number | null; awayScore: number | null; round?: string | null;
}
export type ESPNFixture = ESPNMatch;

export interface ESPNStandingRow {
  rank: number; teamId: string; team: string; shortName: string; logo: string | null;
  played: number; won: number; drawn: number; lost: number;
  goalsFor: number; goalsAgainst: number; goalDiff: number; points: number;
  note: string | null; group?: string | null;
}

export interface ESPNNews {
  id: string; headline: string; description: string; published: string;
  image: string | null; category: string; link: string | null;
}
export type NewsItem = ESPNNews;

export interface ESPNTeam {
  id: string; name: string; shortName: string; logo: string | null;
  color: string | null; venue: string | null; record: string | null;
}

export interface ESPNPlayer {
  id: string; name: string; jersey: string | null; position: string | null;
  age: number | null; nationality: string | null; headshot: string | null;
}

export interface ESPNLeader {
  rank: number; category: string; player: string; team: string;
  teamLogo: string | null; headshot: string | null; value: number; displayValue: string;
}

export interface ESPNLineupPlayer {
  id: string; name: string; jersey: string | null; position: string | null;
  starter: boolean; teamId: string;
}

export interface ESPNTeamLineup {
  teamId: string; formation: string | null;
  starters: ESPNLineupPlayer[]; bench: ESPNLineupPlayer[];
}

export interface ESPNOfficial { name: string; position: string; order: number; }
export interface ESPNOddsPick { provider: string; details: string | null; spread: number | null; overUnder: number | null; favoriteTeamId: string | null; }

export interface ESPNMatchDetail {
  id: string; status: string; statusState: string; kickoff: string | null;
  competition: string; venue: string | null; attendance: number | null;
  homeTeam: ESPNTeamRef; awayTeam: ESPNTeamRef;
  homeScore: number | null; awayScore: number | null;
  events: { minute: number; type: string; detail: string; player: string | null; assist: string | null; teamId: string; }[];
  lineups: ESPNTeamLineup[];
  officials?: ESPNOfficial[];
  odds?: ESPNOddsPick[];
}

export interface ESPNInjury {
  id: string; player: string; position: string | null; team: string;
  teamLogo: string | null; status: string; injury: string; details: string | null;
}

export interface ESPNTransaction {
  id: string; date: string; team: string; teamLogo: string | null;
  description: string; type: string | null;
}

// ═══════════════════════════════════════════════════════════════
//  Scoreboard & Fixtures
// ═══════════════════════════════════════════════════════════════

export const getScoreboard = (league: string) =>
  apiGet<ESPNMatch[]>(`/${league}/scoreboard`, [], 30);

export const getFixtures = (league: string) =>
  apiGet<{ results: ESPNFixture[]; upcoming: ESPNFixture[] }>(
    `/${league}/fixtures`, { results: [], upcoming: [] }, 60);

// ═══════════════════════════════════════════════════════════════
//  Standings, Groups, Rankings
// ═══════════════════════════════════════════════════════════════

export const getStandings = (league: string) =>
  apiGet<ESPNStandingRow[]>(`/${league}/standings`, [], 300);

export const getGroups = (league: string) =>
  apiGet<RawJSON>(`/${league}/groups`, null, 3600);

export const getRankings = (league: string) =>
  apiGet<RawJSON>(`/${league}/rankings`, null, 3600);

// ═══════════════════════════════════════════════════════════════
//  News
// ═══════════════════════════════════════════════════════════════

export const getNews = (league: string, limit = 12) =>
  apiGet<ESPNNews[]>(`/${league}/news?limit=${limit}`, [], 120);

// ═══════════════════════════════════════════════════════════════
//  Statistics & Leaders
// ═══════════════════════════════════════════════════════════════

export const getLeaders = (league: string) =>
  apiGet<ESPNLeader[]>(`/${league}/leaders`, [], 3600);

// Raw leaders from ESPN Core API — returns all categories with athlete $ref URLs
// The /types/1/ segment is required; omitting it causes a 400 error from ESPN
export const getRawLeaders = (league: string, season: string) =>
  apiGet<RawJSON>(`/${league}/seasons/${season}/leaders/raw`, null, 3600);

export const getStatistics = (league: string) =>
  apiGet<RawJSON>(`/${league}/statistics`, null, 3600);

export const getStatsByAthlete = (league: string) =>
  apiGet<RawJSON>(`/${league}/statistics/byathlete`, null, 3600);

// ═══════════════════════════════════════════════════════════════
//  League-wide: Injuries, Transactions, Venues, Calendar
// ═══════════════════════════════════════════════════════════════

export const getInjuries = (league: string) =>
  apiGet<ESPNInjury[]>(`/${league}/injuries`, [], 600);

export const getTransactions = (league: string, limit = 50) =>
  apiGet<ESPNTransaction[]>(`/${league}/transactions?limit=${limit}`, [], 600);

export const getVenues = (league: string) =>
  apiGet<RawJSON>(`/${league}/venues`, null, 3600);

export const getCalendar = (league: string) =>
  apiGet<RawJSON>(`/${league}/calendar`, null, 3600);

export const getSeason = (league: string) =>
  apiGet<RawJSON>(`/${league}/season`, null, 3600);

export const getSeasons = (league: string) =>
  apiGet<RawJSON>(`/${league}/seasons`, null, 3600);

// ═══════════════════════════════════════════════════════════════
//  Draft & Free Agents
// ═══════════════════════════════════════════════════════════════

export const getDraftByYear = (league: string, season: string) =>
  apiGet<RawJSON>(`/${league}/seasons/${season}/draft`, null, 3600);

export const getFreeAgents = (league: string, season: string) =>
  apiGet<RawJSON>(`/${league}/seasons/${season}/freeagents`, null, 3600);

// ═══════════════════════════════════════════════════════════════
//  Team-level endpoints
// ═══════════════════════════════════════════════════════════════

export const getTeamsList = (league: string) =>
  apiGet<RawJSON>(`/${league}/teams`, null, 3600);

export const getTeam = (league: string, teamId: string) =>
  apiGet<ESPNTeam | null>(`/${league}/teams/${teamId}`, null, 3600);

export const getRoster = (league: string, teamId: string) =>
  apiGet<ESPNPlayer[]>(`/${league}/teams/${teamId}/roster`, [], 3600);

export const getTeamSchedule = (league: string, teamId: string) =>
  apiGet<RawJSON>(`/${league}/teams/${teamId}/schedule`, null, 600);

export const getTeamRecord = (league: string, teamId: string) =>
  apiGet<RawJSON>(`/${league}/teams/${teamId}/record`, null, 600);

export const getTeamInjuries = (league: string, teamId: string) =>
  apiGet<ESPNInjury[]>(`/${league}/teams/${teamId}/injuries`, [], 600);

export const getTeamDepthChart = (league: string, teamId: string) =>
  apiGet<RawJSON>(`/${league}/teams/${teamId}/depth-charts`, null, 3600);

// ═══════════════════════════════════════════════════════════════
//  Athlete / Player endpoints
// ═══════════════════════════════════════════════════════════════

export const getAthleteOverviewRaw = (league: string, athleteId: string) =>
  apiGet<RawJSON>(`/${league}/athletes/${athleteId}/overview/raw`, null, 600);

export const getAthleteOverview = (league: string, athleteId: string) =>
  apiGet<RawJSON>(`/${league}/athletes/${athleteId}/overview`, null, 600);

export const getAthleteStats = (league: string, athleteId: string) =>
  apiGet<RawJSON>(`/${league}/athletes/${athleteId}/stats`, null, 600);

export const getAthleteGamelog = (league: string, athleteId: string) =>
  apiGet<RawJSON>(`/${league}/athletes/${athleteId}/gamelog`, null, 600);

export const getAthleteSplits = (league: string, athleteId: string) =>
  apiGet<RawJSON>(`/${league}/athletes/${athleteId}/splits`, null, 600);

export const getAthleteNews = (league: string, athleteId: string) =>
  apiGet<RawJSON>(`/${league}/athletes/${athleteId}/news`, null, 600);

// ═══════════════════════════════════════════════════════════════
//  Match detail
// ═══════════════════════════════════════════════════════════════

export const getMatchDetail = (league: string, eventId: string) =>
  apiGet<ESPNMatchDetail | null>(`/${league}/match/${eventId}`, null, 30);

// ═══════════════════════════════════════════════════════════════
//  CDN endpoints (boxscore, game/win-prob)
// ═══════════════════════════════════════════════════════════════

const siteSlug = (league: string): string => {
  const map: Record<string, string> = {
    "eng.1": "eng.1", "esp.1": "esp.1", "ita.1": "ita.1",
    "ger.1": "ger.1", "fra.1": "fra.1", "usa.1": "usa.1",
    "fifa.world": "fifa.world", "uefa.champions": "uefa.champions", "bra.1": "bra.1",
  };
  return map[league] ?? league;
};

export const getCdnBoxscore = (league: string, eventId: string) =>
  apiGet<RawJSON>(`/cdn/${siteSlug(league)}/boxscore/${eventId}`, null, 60);

export const getCdnGame = (league: string, eventId: string) =>
  apiGet<RawJSON>(`/cdn/${siteSlug(league)}/game/${eventId}`, null, 60);

export const getCdnScoreboard = (league: string) =>
  apiGet<RawJSON>(`/cdn/${siteSlug(league)}/scoreboard`, null, 30);

// ═══════════════════════════════════════════════════════════════
//  World Cup
// ═══════════════════════════════════════════════════════════════

export const getWorldCupBracket = () =>
  apiGet<BracketMatch[]>("/worldcup/bracket", [], 300);