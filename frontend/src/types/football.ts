// ── Unified model (matches backend org.Spring.model exactly) ──

export interface Team {
  id: number;
  name: string;
  shortName: string;
  logo: string | null;
}

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
}

const espnLogo = (id: number) =>
  `https://a.espncdn.com/combiner/i?img=%2Fi%2Fleaguelogos%2Fsoccer%2F500%2F${id}.png&w=40&h=40&scale=crop`;

export const LEAGUES: LeagueInfo[] = [
  { slug: "fifa.world",     name: "World Cup 2026",   short: "World Cup",  logo: espnLogo(4)  },
  { slug: "uefa.champions", name: "Champions League", short: "UCL",        logo: espnLogo(2)  },
  { slug: "eng.1",          name: "Premier League",   short: "PL",         logo: espnLogo(23) },
  { slug: "esp.1",          name: "La Liga",          short: "La Liga",    logo: espnLogo(15) },
  { slug: "ita.1",          name: "Serie A",          short: "Serie A",    logo: espnLogo(12) },
  { slug: "ger.1",          name: "Bundesliga",       short: "Bundesliga", logo: espnLogo(10) },
  { slug: "fra.1",          name: "Ligue 1",          short: "Ligue 1",    logo: espnLogo(9)  },
  { slug: "usa.1",          name: "MLS",              short: "MLS",        logo: espnLogo(19) },
  { slug: "bra.1",          name: "Brasileirão",      short: "Brazil",     logo: espnLogo(85) },
];

export const leagueName = (slug: string): string =>
  LEAGUES.find(l => l.slug === slug)?.name ?? slug;

export const leagueLogo = (slug: string): string =>
  LEAGUES.find(l => l.slug === slug)?.logo ?? "";

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