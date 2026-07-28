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

// ─── Team schedule (direct ESPN, season-aware) ──────────────────────────────
async function fetchTeamSchedule(league: string, teamId: string, season: string): Promise<Match[]> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/teams/${teamId}/schedule?season=${season}`,
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
      `https://site.api.espn.com/apis/v2/sports/soccer/${league}/standings?season=${season}`,
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

  const [team, roster, standings, news, seedMatches, coreData] = await Promise.all([
    getTeam(league, id),
    getRoster(league, id),
    fetchStandings(league, selectedSeason),
    getNews(league, 12) as Promise<ESPNNews[]>,
    fetchTeamSchedule(league, id, selectedSeason),
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
      seedMatches={seedMatches}
      teamStats={teamStats}
      teamLeaders={teamLeaders}
      season={selectedSeason}
      availableSeasons={availableSeasons}
    />
  );
}