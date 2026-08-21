import { notFound } from "next/navigation";
import {
  getTeam, getRoster, getNews,
  type ESPNTeam, type ESPNPlayer, type ESPNStandingRow, type ESPNNews, type RawJSON,
} from "@/lib/api/espn";
import { LEAGUES, Match } from "@/types/football";
import TeamPageClient from "@/components/football/TeamPageClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ league?: string; season?: string }>;
}

const ESPN_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
};

// ─── Map an ESPN competition NAME → one of OUR supported league slugs ───────
// ESPN's /all/ schedule tags each event only by name (e.g. "2026 Club Friendly",
// "2026-27 LALIGA") — there is no slug in the payload. We keyword-match those
// names to our LEAGUES. Option 2: anything that doesn't match is HIDDEN.
const LEAGUE_NAME_KEYWORDS: { slug: string; label: string; kws: string[] }[] = [
  { slug: "uefa.champions",   label: "Champions League",       kws: ["champions league", "uefa champions"] },
  { slug: "eng.1",            label: "Premier League",         kws: ["premier league", "english premier", "epl"] },
  { slug: "esp.1",            label: "La Liga",                 kws: ["laliga", "la liga", "spanish la"] },
  { slug: "ita.1",            label: "Serie A",                 kws: ["serie a", "italian serie"] },
  { slug: "ger.1",            label: "Bundesliga",             kws: ["bundesliga"] },
  { slug: "fra.1",            label: "Ligue 1",                 kws: ["ligue 1", "french ligue"] },
  { slug: "usa.1",            label: "MLS",                     kws: ["mls", "major league soccer"] },
  { slug: "bra.1",            label: "Brasileirão",            kws: ["brasileir", "brazilian serie", "brazil serie"] },
  { slug: "arg.1",            label: "Argentine Primera",       kws: ["argentine", "primera divisi", "liga profesional"] },
  { slug: "fifa.world",       label: "World Cup",               kws: ["world cup"] },
];

// Returns { slug, label } for a supported league, or null (→ hidden, Option 2).
function mapCompetition(name: string | null | undefined): { slug: string; label: string } | null {
  if (!name) return null;
  const n = name.toLowerCase();
  for (const L of LEAGUE_NAME_KEYWORDS) {
    if (L.kws.some(k => n.includes(k))) return { slug: L.slug, label: L.label };
  }
  return null;
}

// Parse one ESPN schedule "events" array into our Match[], keeping only events
// that map to a supported league. Each Match gets `competition` = the mapped
// LABEL (used by the Fixtures league dropdown).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseScheduleEvents(events: any[]): Match[] {
  const out: Match[] = [];
  for (const event of events ?? []) {
    // Competition name lives on seasonType.name / season.displayName.
    const compName: string =
      event?.seasonType?.name ?? event?.season?.displayName ?? event?.competitions?.[0]?.type?.text ?? "";
    const mapped = mapCompetition(compName);
    if (!mapped) continue; // Option 2: hide competitions we don't support.

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comp = event?.competitions?.[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const competitors: any[] = comp?.competitors ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const home = competitors.find((c: any) => c.homeAway === "home");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const away = competitors.find((c: any) => c.homeAway === "away");
    const statusName: string = event?.status?.type?.name ?? comp?.status?.type?.name ?? "STATUS_SCHEDULED";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scoreOf = (c: any) =>
      c?.score?.value != null ? Number(c.score.value)
      : (c?.score != null && typeof c.score !== "object" ? Number(c.score) : null);

    out.push({
      id: Number(event.id),
      sport: "football" as const,
      status: statusName,
      elapsed: null,
      kickoff: event.date ?? null,
      competition: mapped.label, // mapped LABEL, so the dropdown reads cleanly
      homeTeam: {
        id: Number(home?.team?.id ?? 0),
        name: home?.team?.displayName ?? home?.team?.name ?? "TBD",
        shortName: home?.team?.shortDisplayName ?? home?.team?.abbreviation ?? "TBD",
        logo: home?.team?.logos?.[0]?.href ?? home?.team?.logo ?? null,
      },
      awayTeam: {
        id: Number(away?.team?.id ?? 0),
        name: away?.team?.displayName ?? away?.team?.name ?? "TBD",
        shortName: away?.team?.shortDisplayName ?? away?.team?.abbreviation ?? "TBD",
        logo: away?.team?.logos?.[0]?.href ?? away?.team?.logo ?? null,
      },
      homeScore: scoreOf(home),
      awayScore: scoreOf(away),
      events: [],
    });
  }
  return out;
}

// UPCOMING fixtures across all competitions (?fixture=true, /all/, no season).
async function fetchTeamFixtures(teamId: string): Promise<Match[]> {
  try {
    const res = await fetch(
      `https://site.web.api.espn.com/apis/site/v2/sports/soccer/all/teams/${teamId}/schedule?fixture=true`,
      { headers: ESPN_HEADERS, next: { revalidate: 600 } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return parseScheduleEvents(data.events ?? []);
  } catch { return []; }
}

// FINISHED results for a given season (?fixture=false&season=YYYY, /all/).
async function fetchTeamResults(teamId: string, season: string): Promise<Match[]> {
  try {
    const res = await fetch(
      `https://site.web.api.espn.com/apis/site/v2/sports/soccer/all/teams/${teamId}/schedule?fixture=false&season=${season}`,
      { headers: ESPN_HEADERS, next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return parseScheduleEvents(data.events ?? []);
  } catch { return []; }
}

// ─── Team schedule (direct ESPN, season-aware) ──────────────────────────────
async function fetchTeamSchedule(league: string, teamId: string, season: string): Promise<Match[]> {
  try {
    const res = await fetch(
      `https://site.web.api.espn.com/apis/site/v2/sports/soccer/${league}/teams/${teamId}/schedule?season=${season}`,
      { headers: ESPN_HEADERS, next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const events: any[] = data.events ?? [];
    return events.map((event: any) => {
      const comp = event.competitions?.[0];
      const competitors: any[] = comp?.competitors ?? [];
      const home = competitors.find((c: any) => c.homeAway === "home");
      const away = competitors.find((c: any) => c.homeAway === "away");
      const statusName: string = event.status?.type?.name ?? comp?.status?.type?.name ?? "STATUS_SCHEDULED";
      return {
        id: Number(event.id),
        sport: "football" as const,
        status: statusName,
        elapsed: null,
        kickoff: event.date ?? null,
        competition: comp?.type?.text ?? event.seasonType?.name ?? league,
        homeTeam: {
          id: Number(home?.team?.id ?? 0),
          name: home?.team?.displayName ?? home?.team?.name ?? "TBD",
          shortName: home?.team?.shortDisplayName ?? home?.team?.abbreviation ?? "TBD",
          logo: home?.team?.logos?.[0]?.href ?? home?.team?.logo ?? null,
        },
        awayTeam: {
          id: Number(away?.team?.id ?? 0),
          name: away?.team?.displayName ?? away?.team?.name ?? "TBD",
          shortName: away?.team?.shortDisplayName ?? away?.team?.abbreviation ?? "TBD",
          logo: away?.team?.logos?.[0]?.href ?? away?.team?.logo ?? null,
        },
        homeScore: home?.score?.value != null ? Number(home.score.value) : (home?.score != null && typeof home.score !== "object" ? Number(home.score) : null),
        awayScore: away?.score?.value != null ? Number(away.score.value) : (away?.score != null && typeof away.score !== "object" ? Number(away.score) : null),
        events: [],
      };
    });
  } catch {
    return [];
  }
}

// ─── League standings (direct ESPN, season-aware) ───────────────────────────
async function fetchStandings(league: string, season: string): Promise<ESPNStandingRow[]> {
  try {
    // FIX 1: Corrected API path to apis/v2/ (removed duplicate /site/)
    const res = await fetch(
      `https://site.web.api.espn.com/apis/v2/sports/soccer/${league}/standings?season=${season}`,
      { headers: ESPN_HEADERS, next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    const data = await res.json();

    // FIX 2: Recursive entry extractor handles multi-tier groups/conferences (MLS, Champions League)
    const extractEntries = (node: any): any[] => {
      if (!node) return [];
      if (node.standings?.entries) return node.standings.entries;
      if (node.entries) return node.entries;
      if (Array.isArray(node.children)) {
        return node.children.flatMap(extractEntries);
      }
      return [];
    };

    const standings = extractEntries(data);
    const rows: ESPNStandingRow[] = [];

    for (const entry of standings) {
      const team = entry.team ?? {};
      const stats: Record<string, any> = {};

      for (const s of entry.stats ?? []) {
        if (s.name) stats[s.name] = s.value ?? s.displayValue ?? 0;
        if (s.type) stats[s.type] = s.value ?? s.displayValue ?? 0;
        if (s.abbreviation) stats[s.abbreviation] = s.value ?? s.displayValue ?? 0;
      }

      rows.push({
        rank: Number(stats.rank ?? entry.rank ?? entry.curatedRank?.current ?? 0),
        teamId: String(team.id ?? ""),
        team: team.displayName ?? team.name ?? "",
        shortName: team.shortDisplayName ?? team.abbreviation ?? "",
        logo: team.logos?.[0]?.href ?? null,
        played: Number(stats.gamesPlayed ?? stats.gp ?? 0),
        won: Number(stats.wins ?? stats.w ?? 0),
        drawn: Number(stats.ties ?? stats.d ?? stats.draws ?? 0),
        lost: Number(stats.losses ?? stats.l ?? 0),
        goalsFor: Number(stats.pointsFor ?? stats.gf ?? 0),
        goalsAgainst: Number(stats.pointsAgainst ?? stats.ga ?? 0),
        goalDiff: Number(stats.pointDifferential ?? stats.gd ?? 0),
        points: Number(stats.points ?? stats.pts ?? 0),
        note: entry.note?.description ?? null,
        group: null,
      });
    }

    rows.sort((a, b) => a.rank - b.rank);
    return rows;
  } catch {
    return [];
  }
}

// Fetch team stats + leaders from ESPN Core API
async function fetchTeamStats(league: string, teamId: string, season: string) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
  };
  const base = `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${league}/seasons/${season}/types/1`;
  const [statsRes, leadersRes] = await Promise.allSettled([
    fetch(`${base}/teams/${teamId}/statistics`, { headers, next: { revalidate: 3600 } }),
    fetch(`${base}/teams/${teamId}/leaders`, { headers, next: { revalidate: 3600 } }),
  ]);
  const stats = statsRes.status === "fulfilled" && statsRes.value.ok ? await statsRes.value.json() : null;
  const leaders = leadersRes.status === "fulfilled" && leadersRes.value.ok ? await leadersRes.value.json() : null;
  return { stats, leaders };
}

// Parse team statistics into categories
function parseTeamStats(raw: any): { category: string; stats: { label: string; value: string }[] }[] {
  if (!raw) return [];
  const splits = raw?.splits?.categories ?? raw?.categories ?? [];
  return splits.map((cat: any) => ({
    category: cat.displayName ?? cat.name ?? "Stats",
    stats: (cat.stats ?? []).map((s: any) => ({
      label: s.displayName ?? s.name,
      value: s.displayValue ?? String(s.value ?? ""),
    })).filter((s: any) => s.label && s.value),
  })).filter((c: any) => c.stats.length > 0);
}

// Parse team leaders
function parseTeamLeaders(raw: any): { category: string; name: string; value: string; athleteId: string; headshot: string | null }[] {
  if (!raw) return [];
  const cats = raw?.categories ?? [];
  const result: { category: string; name: string; value: string; athleteId: string; headshot: string | null }[] = [];
  for (const cat of cats) {
    const leader = cat.leaders?.[0];
    if (!leader) continue;
    const athleteRef: string = leader?.athlete?.$ref ?? "";
    const athleteId = athleteRef.match(/athletes\/(\d+)/)?.[1] ?? "";
    result.push({
      category: cat.displayName ?? cat.name,
      name: leader.athlete?.displayName ?? "",
      value: String(leader.displayValue ?? leader.value ?? ""),
      athleteId,
      headshot: athleteId ? `https://a.espncdn.com/i/headshots/soccer/players/full/${athleteId}.png` : null,
    });
  }
  return result;
}

export default async function TeamPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { league = "eng.1", season } = await searchParams;

  const leagueInfo = LEAGUES.find(l => l.slug === league);
  const currentYear = new Date().getFullYear();
  const selectedSeason = season ?? String(currentYear);
  const availableSeasons = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

const [team, roster, standings, news, teamFixtures, teamResults, coreData] = await Promise.all([
    getTeam(league, id),
    getRoster(league, id),
    fetchStandings(league, selectedSeason),
    getNews(league, 12) as Promise<ESPNNews[]>,
    fetchTeamFixtures(id),
    fetchTeamResults(id, selectedSeason),
    fetchTeamStats(league, id, selectedSeason).catch(() => ({ stats: null, leaders: null })),
  ]);

  if (!team) return notFound();

  // FIX 3: Safe string coercion matching
  const teamRow = standings.find(r => String(r.teamId) === String(id));
  const teamStats = parseTeamStats(coreData.stats);
  const teamLeaders = parseTeamLeaders(coreData.leaders);

  return (
    <TeamPageClient
      team={team}
      teamId={id}
      league={league}
      leagueInfo={leagueInfo ?? null}
      roster={roster}
      standingRow={teamRow ?? null}
      news={news}
      teamFixtures={teamFixtures}
      teamResults={teamResults}
      teamStats={teamStats}
      teamLeaders={teamLeaders}
      season={selectedSeason}
      availableSeasons={availableSeasons}
    />
  );
}