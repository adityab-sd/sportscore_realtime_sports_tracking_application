"use client";
import { useCallback } from "react";
import { getGameDetail, type BBGameDetail } from "@/lib/api/baseball";
import { useLiveMatchDetail } from "@/hooks/useLiveMatchDetail";
import ScoreHeader from "./ScoreHeader";

/**
 * BaseballLiveScoreHeader — live-polling wrapper around the baseball ScoreHeader.
 *
 * The match detail page is a server component (static). This client wrapper owns
 * a 30s REST poll so the score, inning and status update live while the game is
 * in progress. Polling stops automatically once the game finishes. 0 SignalR.
 */
export default function BaseballLiveScoreHeader({
  initialGame,
  league,
}: {
  initialGame: BBGameDetail;
  league: string;
}) {
  const fetcher = useCallback(
    async (id: number): Promise<BBGameDetail> => {
      const fresh = await getGameDetail(league, String(id));
      if (!fresh) throw new Error("game detail unavailable");
      return fresh;
    },
    [league]
  );

  const { data } = useLiveMatchDetail<BBGameDetail>(
    Number(initialGame.id),
    initialGame,
    fetcher,
    30_000
  );

  return <ScoreHeader game={data} league={league} />;
}
