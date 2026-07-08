/**
 * Basketball reference data — served by Hema's Spring Boot backend at
 * /api/basketball/{league}/... which owns all ESPN basketball parsing.
 * Same pattern as lib/api/espn.ts. Returns typed clean DTOs.
 *
 * Live data (scoreboard) also flows through here — SignalR does not yet
 * carry basketball events, so we poll on page load.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_BASKETBALL_API_BASE ||
  "http://localhost:8081/api/basketball";

async function apiGet<T>(path: string, fallback: T, revalidate = 60): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

// ─────────────────────────────────────────────
// TYPES — match backend BasketballDto exactly
// ─────────────────────────────────────────────

export interface BBTeamRef {
  id: string;
  name: string;
  shortName: string;
  logo: string | null;
}

export interface BBGame {
  id: string;
  status: string;         // "Q2 8:23" | "Halftime" | "Final" | "8:00 PM ET"
  statusState: string;    // "pre" | "in" | "post"
  tipoff: string | null;
  competition: string;
  homeTeam: BBTeamRef;
  awayTeam: BBTeamRef;
  homeScore: number | null;
  awayScore: number | null;
  period: number | null;  // quarter number
  clock: string | null;   // game clock
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
}

// Shared shapes (identical to football's Dto):
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

// ─────────────────────────────────────────────
// FETCHERS
// ─────────────────────────────────────────────

export const getScoreboard = (league: string) =>
  apiGet<BBGame[]>(`/${league}/scoreboard`, [], 30);

export const getFixtures = (league: string) =>
  apiGet<{ results: BBFixture[]; upcoming: BBFixture[] }>(
    `/${league}/fixtures`,
    { results: [], upcoming: [] },
    60
  );

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