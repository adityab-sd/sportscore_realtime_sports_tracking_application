"use client";
import { useCallback } from "react";
import { getGameDetail, type BBGameDetail } from "@/lib/api/basketball";
import { useLiveMatchDetail } from "@/hooks/useLiveMatchDetail";
import ScoreHeader from "./ScoreHeader";

/**
 * BasketballLiveScoreHeader — live-polling wrapper around the basketball
 * ScoreHeader. Owns a 30s REST poll so the score, period/clock and status
 * update live while the game is in progress; stops once it finishes. 0 SignalR.
 */
export default function BasketballLiveScoreHeader({
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
