"use client";
import { useMemo } from "react";
import { useSignalR } from "@/hooks/useSignalR";
import { Match, classifyStatus, leagueByName, LEAGUES } from "@/types/football";
import { getFixturesByDate, type ESPNFixture } from "@/lib/api/espn";
import LiveSportSection, { type LiveSportConfig } from "@/components/ui/LiveSportSection";
import LiveStatus from "@/components/ui/LiveStatus";
import MatchCard from "./MatchCard";
import LeagueBanner from "./LeagueBanner";

function mapFixtures(fx: { results: ESPNFixture[]; upcoming: ESPNFixture[] }, slug: string): Match[] {
  const name = LEAGUES.find(l => l.slug === slug)?.name;
  return [...fx.results, ...fx.upcoming].map(f => ({
    id: Number(f.id),
    sport: "football" as const,
    leagueSlug: slug,
    status: f.status,
    elapsed: null,
    kickoff: f.kickoff,
    competition: f.competition || name || "",
    homeTeam: { id: Number(f.homeTeam.id), name: f.homeTeam.name, shortName: f.homeTeam.shortName, logo: f.homeTeam.logo },
    awayTeam: { id: Number(f.awayTeam.id), name: f.awayTeam.name, shortName: f.awayTeam.shortName, logo: f.awayTeam.logo },
    homeScore: f.homeScore,
    awayScore: f.awayScore,
    events: [],
  }));
}

const competitionOf = (m: Match) => m.competition || "Other";
const slugForCompetition = (m: Match) => leagueByName(m.competition)?.slug ?? null;

const config: LiveSportConfig<Match> = {
  leagues: LEAGUES,
  fetchDay: (slug, ymd) => getFixturesByDate(slug, ymd).then(fx => mapFixtures(fx, slug)),
  getId: m => m.id,
  getState: m => classifyStatus(m.status),
  getDateIso: m => m.kickoff,
  groupKeyOf: competitionOf,
  groupNameOf: competitionOf,
  groupHrefOf: m => { const s = slugForCompetition(m); return s ? `/football/league/${s}` : null; },
  renderGroupBanner: m => <LeagueBanner name={competitionOf(m)} slug={slugForCompetition(m)} />,
  renderCard: m => <MatchCard match={m} league={m.leagueSlug ?? null} />,
  emptyIcon: "📅",
  emptyNoun: "fixtures",
};

export default function LiveFootball({ seed = [] }: { seed?: Match[] }) {
  const { matches: live, state, lastUpdate } = useSignalR();

  // Today = server seed merged with SignalR pushes, football only.
  const today = useMemo(() => {
    const byId = new Map<number, Match>();
    for (const m of seed) byId.set(m.id, m);
    for (const m of live) byId.set(m.id, m);
    return Array.from(byId.values()).filter(m => !m.sport || m.sport === "football");
  }, [seed, live]);

  return (
    <LiveSportSection
      config={config}
      seed={seed}
      today={today}
      liveEdgeSlot={<LiveStatus state={state} lastUpdate={lastUpdate} />}
      todayWaiting={state === "connecting"}
      todayWaitingLabel="Waiting for live match data…"
    />
  );
}
