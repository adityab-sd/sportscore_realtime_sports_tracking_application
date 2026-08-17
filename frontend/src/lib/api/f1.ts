/**
 * F1 data layer — talks to Spring Boot backend at /api/f1/...
 * Typed fetchers matching F1Controller endpoints.
 */

import { resolveApiBase } from "@/lib/api/base";
import { cachedApiGet } from "@/lib/api/persistentCache";

const API_BASE = resolveApiBase("f1");

async function apiGet<T>(path: string, fallback: T, revalidate = 120): Promise<T> {
  if (!API_BASE) {
    console.error(`[f1.ts] NEXT_PUBLIC_F1_API_BASE is not set — skipping fetch for ${path}`);
    return fallback;
  }

  const url = `${API_BASE}${path}`;

  return cachedApiGet(url, fallback, revalidate, "f1.ts");
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function apiGetRaw(path: string, revalidate = 120): Promise<any> {
  if (!API_BASE) {
    console.error(`[f1.ts] NEXT_PUBLIC_F1_API_BASE is not set — skipping fetch for ${path}`);
    return null;
  }

  const url = `${API_BASE}${path}`;

  return cachedApiGet(url, null, revalidate, "f1.ts");
}

// ─── Typed interfaces (match F1Dto.java) ────────────────────────────────────

export interface DriverResult {
  position: number;
  driverId: string;
  driver: string;
  team?: string | null;           // team name (for team colours / the Team column)
  country: string | null;
  flag: string | null;
  winner: boolean;
  laps?: number;                  // laps completed this session
  timeOrStatus?: string | null;   // "1:28:20.480", "+4.120s", "+1 Lap", "DNF", "Collision", ...
  points?: number;                // points awarded for this session
  isRetired?: boolean;            // styling helper for non-finishers
}

export interface SessionDto {
  id: string;
  type: string;
  label: string;
  date: string | null;
  statusState: string;
  statusDetail: string | null;
  grid: DriverResult[];
}

export interface RaceWeekend {
  id: string;
  name: string;
  circuit: string | null;
  city: string | null;
  country: string | null;
  startDate: string | null;
  endDate: string | null;
  statusState: string;
  sessions: SessionDto[];
}

export interface ScheduleEntry {
  id: string;
  name: string;
  circuit: string | null;
  city: string | null;
  country: string | null;
  startDate: string | null;
  endDate: string | null;
  statusState: string;
}

export interface DriverStanding {
  rank: number;
  driverId: string;
  driver: string;
  flag: string | null;
  team: string | null;
  points: number;
  wins: number;
}

export interface ConstructorStanding {
  rank: number;
  teamId: string;
  team: string;
  logo: string | null;
  points: number;
  wins: number;
}

export interface Standings {
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
}

export interface NewsItem {
  id: string;
  headline: string;
  description: string;
  published: string;
  image: string | null;
  category: string;
  link: string | null;
}

// ─── API fetchers ───────────────────────────────────────────────────────────

// Append ?year= only when a non-default season is requested. All fetchers accept
// an optional `year`; omitting it keeps the current-season behaviour.
function yq(year?: number, sep: "?" | "&" = "?"): string {
  return year ? `${sep}year=${year}` : "";
}

export async function getScoreboard(year?: number): Promise<RaceWeekend[]> {
  return apiGet<RaceWeekend[]>(`/scoreboard${yq(year)}`, []);
}

export async function getSchedule(year?: number): Promise<ScheduleEntry[]> {
  return apiGet<ScheduleEntry[]>(`/schedule${yq(year)}`, []);
}

export async function getResults(eventId: string, year?: number): Promise<RaceWeekend | null> {
  return apiGet<RaceWeekend | null>(`/results/${eventId}${yq(year)}`, null);
}

export async function getStandings(year?: number): Promise<Standings> {
  return apiGet<Standings>(`/standings${yq(year)}`, { drivers: [], constructors: [] });
}

export async function getNews(limit = 12, year?: number): Promise<NewsItem[]> {
  return apiGet<NewsItem[]>(`/news?limit=${limit}${yq(year, "&")}`, []);
}

export async function getAthleteNews(athleteId: string, limit = 12): Promise<any> {
  return apiGetRaw(`/athletes/${athleteId}/news?limit=${limit}`);
}

export async function getTeams(): Promise<any> {
  return apiGetRaw("/teams?limit=50");
}

export async function getDrivers(): Promise<any> {
  return apiGetRaw("/drivers?limit=50&active=true");
}

export async function getDriverProfile(driverId: string): Promise<any> {
  return apiGetRaw(`/drivers/${driverId}`);
}

export async function getEventDetail(eventId: string): Promise<any> {
  return apiGetRaw(`/events/${eventId}`);
}