
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8081/api/football";

/** Fetch from our backend. Returns fallback on any failure — never throws. */
async function apiGet<T>(path: string, fallback: T, revalidate = 60): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export interface ESPNTeamRef {
  id: string;
  name: string;
  shortName: string;
  logo: string | null;
}

export interface ESPNMatch {
  id: string;
  status: string;         
  statusState: string;     
  kickoff: string | null;
  competition: string;
  homeTeam: ESPNTeamRef;
  awayTeam: ESPNTeamRef;
  homeScore: number | null;
  awayScore: number | null;
  round?: string | null;
}

export type ESPNFixture = ESPNMatch;

export interface ESPNStandingRow {
  rank: number;
  teamId: string;
  team: string;
  shortName: string;
  logo: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  note: string | null; 
  group?: string | null; 
}

export interface ESPNNews {
  id: string;
  headline: string;
  description: string;
  published: string;
  image: string | null;
  category: string;
  link: string | null;
}
export type NewsItem = ESPNNews;

export interface ESPNTeam {
  id: string;
  name: string;
  shortName: string;
  logo: string | null;
  color: string | null;
  venue: string | null;
  record: string | null;
}

export interface ESPNPlayer {
  id: string;
  name: string;
  jersey: string | null;
  position: string | null;
  age: number | null;
  nationality: string | null;
  headshot: string | null;
}

export interface ESPNLeader {
  rank: number;
  category: string;
  player: string;
  team: string;
  teamLogo: string | null;
  headshot: string | null;
  value: number;
  displayValue: string;
}

export interface ESPNLineupPlayer {
  id: string;
  name: string;
  jersey: string | null;
  position: string | null;
  starter: boolean;
  teamId: string;
}

export interface ESPNTeamLineup {
  teamId: string;
  formation: string | null;
  starters: ESPNLineupPlayer[];
  bench: ESPNLineupPlayer[];
}

export interface ESPNMatchDetail {
  id: string;
  status: string;
  statusState: string;
  kickoff: string | null;
  competition: string;
  venue: string | null;
  attendance: number | null;
  homeTeam: ESPNTeamRef;
  awayTeam: ESPNTeamRef;
  homeScore: number | null;
  awayScore: number | null;
  events: {
    minute: number;
    type: string;
    detail: string;
    player: string | null;
    assist: string | null;
    teamId: string;
  }[];
  lineups: ESPNTeamLineup[];
}

export const getScoreboard = (league: string) =>
  apiGet<ESPNMatch[]>(`/${league}/scoreboard`, [], 30);

/** Results (past) and upcoming (scheduled) for a league. */
export const getFixtures = (league: string) =>
  apiGet<{ results: ESPNFixture[]; upcoming: ESPNFixture[] }>(
    `/${league}/fixtures`,
    { results: [], upcoming: [] },
    60
  );

export const getStandings = (league: string) =>
  apiGet<ESPNStandingRow[]>(`/${league}/standings`, [], 300);

export const getNews = (league: string, limit = 12) =>
  apiGet<ESPNNews[]>(`/${league}/news?limit=${limit}`, [], 120);

export const getTeam = (league: string, teamId: string) =>
  apiGet<ESPNTeam | null>(`/${league}/teams/${teamId}`, null, 3600);

export const getRoster = (league: string, teamId: string) =>
  apiGet<ESPNPlayer[]>(`/${league}/teams/${teamId}/roster`, [], 3600);

export const getLeaders = (league: string) =>
  apiGet<ESPNLeader[]>(`/${league}/leaders`, [], 3600);

export const getMatchDetail = (league: string, eventId: string) =>
  apiGet<ESPNMatchDetail | null>(`/${league}/match/${eventId}`, null, 30);