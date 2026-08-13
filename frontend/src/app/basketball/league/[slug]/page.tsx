import { notFound } from "next/navigation";
import {
  getStandings, getScoreboard, getFixtures, getNews, getLeaders, getTeamsList,
  BBFixture, type RawJSON,
} from "@/lib/api/basketball";
import { LEAGUES } from "@/types/basketball";
import LeaguePageClient from "@/components/basketball/LeaguePageClient";

export const dynamic = "force-dynamic";
interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ season?: string }>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function parseTeams(raw: RawJSON | null): { id: string; name: string; logo: string | null }[] {
  if (!raw) return [];
  const items = (raw as any)?.sports?.[0]?.leagues?.[0]?.teams ?? (raw as any)?.teams ?? [];
  return items.map((t: any) => {
    const team = t?.team ?? t;
    return { id: String(team?.id ?? ""), name: String(team?.displayName ?? team?.name ?? ""), logo: team?.logos?.[0]?.href ?? team?.logo ?? null };
  }).filter((t: any) => t.id && t.name)
    .sort((a: any, b: any) => a.name.localeCompare(b.name));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default async function LeaguePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { season } = await searchParams;   // add searchParams to Props type
  const currentYear = new Date().getFullYear();
  const selectedSeason = season ?? String(currentYear);
  const availableSeasons = Array.from({ length: 5 }, (_, i) => String(currentYear - i));
  const league = LEAGUES.find(l => l.slug === slug);
  if (!league) return notFound();

  const [standings, scoreboard, fixtures, news, leaders, teamsRaw] = await Promise.all([
    getStandings(slug, selectedSeason),
    getScoreboard(slug),
    getFixtures(slug),
    getNews(slug, 12),
    getLeaders(slug, selectedSeason),
    getTeamsList(slug),
  ]);

  // Merge scoreboard (today/live) + fixtures window, deduped, so the date
  // picker has games across days AND today's live games appear.
  const byId = new Map<string, BBFixture>();
  for (const g of scoreboard) byId.set(g.id, g);
  for (const g of [...fixtures.results, ...fixtures.upcoming]) if (!byId.has(g.id)) byId.set(g.id, g);
  const seedGames = Array.from(byId.values());
  const teams = parseTeams(teamsRaw);

  return (
    <LeaguePageClient
      league={league}
      slug={slug}
      standings={standings}
      seedGames={seedGames}
      news={news}
      leaders={leaders}
      teams={teams}
      season={selectedSeason}
      availableSeasons={availableSeasons}
    />
  );
}