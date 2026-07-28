import { notFound } from "next/navigation";
import {
  getStandings, getNews, getFixtures, getTeamsList, getRawLeaders,
  type ESPNNews, type RawJSON,
} from "@/lib/api/espn";
import { LEAGUES, Match } from "@/types/football";
import LeaguePageClient from "@/components/football/LeaguePageClient";

export const dynamic = "force-dynamic";
interface Props { params: Promise<{ slug: string }> }

function fixturesToMatches(fixtures: { results: any[]; upcoming: any[] }): Match[] {
  return [...fixtures.results, ...fixtures.upcoming].map(f => ({
    id: Number(f.id),
    sport: "football",
    status: f.status,
    elapsed: null,
    kickoff: f.kickoff,
    competition: f.competition,
    homeTeam: { id: Number(f.homeTeam.id), name: f.homeTeam.name, shortName: f.homeTeam.shortName, logo: f.homeTeam.logo },
    awayTeam: { id: Number(f.awayTeam.id), name: f.awayTeam.name, shortName: f.awayTeam.shortName, logo: f.awayTeam.logo },
    homeScore: f.homeScore,
    awayScore: f.awayScore,
    events: [],
  }));
}

function parseTeams(raw: RawJSON | null): { id: string; name: string; logo: string | null }[] {
  if (!raw) return [];
  const items = (raw as any)?.sports?.[0]?.leagues?.[0]?.teams ?? (raw as any)?.teams ?? [];
  return items.map((t: any) => {
    const team = t?.team ?? t;
    return { id: String(team?.id ?? ""), name: String(team?.displayName ?? team?.name ?? ""), logo: team?.logos?.[0]?.href ?? team?.logo ?? null };
  }).filter((t: any) => t.id && t.name);
}

export interface LeaderEntry {
  rank: number;
  athleteId: string;
  athleteName: string;
  teamName: string;
  teamLogo: string | null;
  headshot: string | null;
  displayValue: string;
  value: number;
}

export interface LeaderCategory {
  name: string;
  displayName: string;
  leaders: LeaderEntry[];
}

// Parse the raw Core API leaders response — resolves athlete names via backend
async function parseRawLeaders(raw: RawJSON | null, slug: string, rows: any[]): Promise<LeaderCategory[]> {
  if (!raw) return [];
  const categories: any[] = (raw as any)?.categories ?? [];
  
  // Collect all unique athlete IDs across all categories
  const athleteIds = new Set<string>();
  const seen = new Set<string>();
  const catData: { name: string; displayName: string; rawLeaders: any[] }[] = [];

  for (const cat of categories) {
    const displayName: string = cat.displayName ?? cat.name;
    if (seen.has(displayName)) continue;
    seen.add(displayName);
    const rawLeaders: any[] = (cat.leaders ?? []).slice(0, 10);
    for (const l of rawLeaders) {
      const athleteRef: string = l?.athlete?.$ref ?? "";
      const m = athleteRef.match(/athletes\/(\d+)/);
      if (m?.[1]) athleteIds.add(m[1]);
    }
    catData.push({ name: cat.name, displayName, rawLeaders });
  }

  // Resolve athlete names by fetching rosters for all standings teams
  const athleteNames = new Map<string, string>();
  const athleteTeams = new Map<string, { name: string; logo: string | null }>();
  try {
    const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8081/api/football';
    // Step 1: build name map from ALL teams in standings
    const teamIds = rows.map((r: any) => r.teamId).filter(Boolean);
    const rosterResults = await Promise.allSettled(
      teamIds.map((teamId: string) =>
        fetch(`${BASE}/${slug}/teams/${teamId}/roster`, { next: { revalidate: 3600 } })
          .then(r => r.ok ? r.json() : [])
          .then((players: any[]) => ({ teamId, players }))
          .catch(() => ({ teamId, players: [] }))
      )
    );
    for (const result of rosterResults) {
      if (result.status !== "fulfilled") continue;
      const { teamId, players } = result.value;
      if (!Array.isArray(players)) continue;
      const teamRow = rows.find((r: any) => r.teamId === teamId);
      for (const p of players) {
        const pid = String(p.id ?? "");
        if (pid && p.name) {
          athleteNames.set(pid, p.name);
          if (teamRow) athleteTeams.set(pid, { name: teamRow.shortName ?? teamRow.team ?? "", logo: teamRow.logo ?? null });
        }
      }
    }
    // Step 2: for any still-unresolved IDs, try ESPN Core API directly
    const unresolved = [...athleteIds].filter(id => !athleteNames.has(id));
    await Promise.allSettled(
      unresolved.map(async (id) => {
        try {
          const res = await fetch(
            `https://sports.core.api.espn.com/v2/sports/soccer/athletes/${id}?lang=en&region=us`,
            {
              headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json",
              },
              next: { revalidate: 86400 }
            }
          );
          if (!res.ok) return;
          const data = await res.json();
          const name = data?.displayName ?? data?.fullName ?? data?.shortName;
          if (name) athleteNames.set(id, name);
        } catch {}
      })
    );
  } catch {}

  // Build output
  const cats: LeaderCategory[] = [];
  for (const { name, displayName, rawLeaders } of catData) {
    const leaders: LeaderEntry[] = rawLeaders.map((l, i) => {
      const athleteRef: string = l?.athlete?.$ref ?? "";
      const athleteIdMatch = athleteRef.match(/athletes\/(\d+)/);
      const athleteId = athleteIdMatch?.[1] ?? "";
      const headshot = athleteId
        ? `https://a.espncdn.com/i/headshots/soccer/players/full/${athleteId}.png`
        : null;
      return {
        rank: i + 1,
        athleteId,
        athleteName: athleteNames.get(athleteId) ?? "",
        teamName: athleteTeams.get(athleteId)?.name ?? "",
        teamLogo: athleteTeams.get(athleteId)?.logo ?? null,
        headshot,
        displayValue: String(l?.value ?? ""),
        value: Number(l?.value ?? 0),
      };
    });
    if (leaders.length > 0) cats.push({ name, displayName, leaders });
  }
  return cats;
}

export default async function LeaguePage({ params }: Props) {
  const { slug } = await params;
  const league = LEAGUES.find(l => l.slug === slug);
  if (!league) return notFound();

  const currentYear = new Date().getFullYear();
  // Try current year first, fall back to previous year (handles both MLS and European leagues)
  const [rows, news, fixtures, teamsRaw, rawLeadersData] = await Promise.all([
    getStandings(slug),
    getNews(slug, 20),
    getFixtures(slug),
    getTeamsList(slug),
    getRawLeaders(slug, String(currentYear))
      .catch(() => getRawLeaders(slug, String(currentYear - 1)).catch(() => null)),
  ]);

  const seedMatches = fixturesToMatches(fixtures);
  const teams = parseTeams(teamsRaw);
  const leaderCategories = await parseRawLeaders(rawLeadersData, slug, rows);

  return (
    <LeaguePageClient
      league={league}
      standings={rows}
      news={news as ESPNNews[]}
      leaderCategories={leaderCategories}
      teams={teams}
      seedMatches={seedMatches}
      slug={slug}
    />
  );
}