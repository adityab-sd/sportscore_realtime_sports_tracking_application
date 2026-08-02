"use client";
import { useCallback } from "react";
import { getMatchDetail, type ESPNMatchDetail, type ESPNTeamRef } from "@/lib/api/espn";
import { useLiveMatchDetail } from "@/hooks/useLiveMatchDetail";
import { adaptPlays } from "@/lib/adaptPlays";
import LineupTab from "./LineupTab";

/**
 * LineupLiveSection — owns a 30s poll for the LEFT column so the lineup, subs
 * and bench update live. Mirrors MatchLiveSection's polling pattern (0 SignalR).
 * Polling stops automatically once the match is finished.
 */
export default function LineupLiveSection({
  initialDetail,
  league,
  homeTeam,
  awayTeam,
}: {
  initialDetail: ESPNMatchDetail;
  league: string;
  homeTeam: ESPNTeamRef;
  awayTeam: ESPNTeamRef;
}) {
  const fetcher = useCallback(
    async (id: number): Promise<ESPNMatchDetail> => {
      const fresh = await getMatchDetail(league, String(id));
      if (!fresh) throw new Error("match detail unavailable");
      return fresh;
    },
    [league]
  );

  const { data } = useLiveMatchDetail<ESPNMatchDetail>(
    Number(initialDetail.id),
    initialDetail,
    fetcher,
    30_000
  );

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