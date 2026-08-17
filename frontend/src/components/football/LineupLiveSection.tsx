"use client";
import type { ESPNTeamRef } from "@/lib/api/espn";
import { adaptPlays } from "@/lib/adaptPlays";
import { useFootballLiveMatch } from "./MatchLiveDataProvider";
import LineupTab from "./LineupTab";

/**
 * Reads the shared live match-detail snapshot so the lineup, subs and bench
 * update without starting a second poll for the same event.
 */
export default function LineupLiveSection({
  league,
  homeTeam,
  awayTeam,
}: {
  league: string;
  homeTeam: ESPNTeamRef;
  awayTeam: ESPNTeamRef;
}) {
  const { data } = useFootballLiveMatch();

  return (
    <LineupTab
      lineups={data.lineups ?? []}
      events={data.events}
      plays={adaptPlays(data, { homeTeam: { id: Number(homeTeam.id) }, awayTeam: { id: Number(awayTeam.id) } } as any)}
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      league={league}
    />
  );
}