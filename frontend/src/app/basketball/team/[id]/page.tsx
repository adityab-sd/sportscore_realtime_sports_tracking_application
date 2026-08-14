import { notFound } from "next/navigation";
import { getTeam, getRoster, getStandings, getNews, BBGame, BBNews } from "@/lib/api/basketball";
import { LEAGUES } from "@/types/basketball";
import TeamPageClient from "@/components/basketball/TeamPageClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ league?: string; season?: string }>;
}

const ESPN_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
async function fetchTeamSchedule(league: string, teamId: string, season: string): Promise<BBGame[]> {
  try {
    const res = await fetch(
      `https://site.web.api.espn.com/apis/site/v2/sports/basketball/${league}/teams/${teamId}/schedule?season=${season}`,
      { headers: ESPN_HEADERS, next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const events: any[] = data.events ?? [];
    return events.map((event: any): BBGame => {
      const comp = event.competitions?.[0];
      const competitors: any[] = comp?.competitors ?? [];
      const home = competitors.find((c: any) => c.homeAway === "home");
      const away = competitors.find((c: any) => c.homeAway === "away");
      const status = event.status ?? comp?.status;
      return {
        id: String(event.id),
        status: status?.type?.shortDetail ?? status?.type?.description ?? "",
        statusState: status?.type?.state ?? "pre",
        tipoff: event.date ?? null,
        competition: comp?.type?.text ?? league,
        homeTeam: {
          id: String(home?.team?.id ?? 0),
          name: home?.team?.displayName ?? home?.team?.name ?? "TBD",
          shortName: home?.team?.shortDisplayName ?? home?.team?.abbreviation ?? "TBD",
          logo: home?.team?.logos?.[0]?.href ?? home?.team?.logo ?? null,
        },
        awayTeam: {
          id: String(away?.team?.id ?? 0),
          name: away?.team?.displayName ?? away?.team?.name ?? "TBD",
          shortName: away?.team?.shortDisplayName ?? away?.team?.abbreviation ?? "TBD",
          logo: away?.team?.logos?.[0]?.href ?? away?.team?.logo ?? null,
        },
        homeScore: home?.score?.value != null ? Number(home.score.value) : (home?.score != null && typeof home.score !== "object" ? Number(home.score) : null),
        awayScore: away?.score?.value != null ? Number(away.score.value) : (away?.score != null && typeof away.score !== "object" ? Number(away.score) : null),
        period: status?.period ?? null,
        clock: status?.displayClock ?? null,
      };
    });
  } catch {
    return [];
  }
}

async function fetchTeamStats(league: string, teamId: string, season: string) {
  const base = `https://sports.core.api.espn.com/v2/sports/basketball/leagues/${league}/seasons/${season}/types/2`;
  const [statsRes, leadersRes] = await Promise.allSettled([
    fetch(`${base}/teams/${teamId}/statistics`, { headers: ESPN_HEADERS, next: { revalidate: 3600 } }),
    fetch(`${base}/teams/${teamId}/leaders`, { headers: ESPN_HEADERS, next: { revalidate: 3600 } }),
  ]);
  const stats = statsRes.status === "fulfilled" && statsRes.value.ok ? await statsRes.value.json() : null;
  const leaders = leadersRes.status === "fulfilled" && leadersRes.value.ok ? await leadersRes.value.json() : null;
  return { stats, leaders };
}

function parseTeamStats(raw: any): { category: string; stats: { label: string; value: string }[] }[] {
  if (!raw) return [];
  const splits = raw?.splits?.categories ?? raw?.categories ?? [];
  return splits.map((cat: any) => ({
    category: cat.displayName ?? cat.name ?? "Stats",
    stats: (cat.stats ?? []).map((s: any) => ({ label: s.displayName ?? s.name, value: s.displayValue ?? String(s.value ?? "") })).filter((s: any) => s.label && s.value),
  })).filter((c: any) => c.stats.length > 0);
}

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
      headshot: athleteId ? `https://a.espncdn.com/i/headshots/nba/players/full/${athleteId}.png` : null,
    });
  }
  return result;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default async function TeamPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { league = "nba", season } = await searchParams;

  const leagueInfo = LEAGUES.find(l => l.slug === league) ?? null;
  const currentYear = new Date().getFullYear();
  const selectedSeason = season ?? String(currentYear);
  const availableSeasons = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  const [team, roster, standings, news, seedGames, coreData] = await Promise.all([
    getTeam(league, id),
    getRoster(league, id),
    getStandings(league),
    getNews(league, 12) as Promise<BBNews[]>,
    fetchTeamSchedule(league, id, selectedSeason),
    fetchTeamStats(league, id, selectedSeason).catch(() => ({ stats: null, leaders: null })),
  ]);

  if (!team) return notFound();

  const teamRow = standings.find(r => String(r.teamId) === String(id)) ?? null;
  const teamStats = parseTeamStats(coreData.stats);
  const teamLeaders = parseTeamLeaders(coreData.leaders);

  return (
    <TeamPageClient
      team={team} teamId={id} league={league} leagueInfo={leagueInfo}
      roster={roster} standingRow={teamRow} news={news} seedGames={seedGames}
      teamStats={teamStats} teamLeaders={teamLeaders}
      season={selectedSeason} availableSeasons={availableSeasons}
    />
  );
}
