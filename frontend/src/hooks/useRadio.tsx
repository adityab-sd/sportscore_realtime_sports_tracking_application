"use client";
import {
  createContext, useContext, useState, useCallback, useEffect,
  createElement, ReactNode,
} from "react";
import type { ESPNMatchDetail } from "@/lib/api/espn";
import { getMatchDetail } from "@/lib/api/espn";
import { useLiveMatchDetail } from "@/hooks/useLiveMatchDetail";

/**
 * Radio Mode context.
 *
 * The RadioBar lives globally (in the Navbar), but Radio Mode is deliberately
 * scoped to the match you're actually viewing. A match page mounts
 * <MatchRadioBinder/>, which registers itself as the active target and keeps
 * its detail fresh. When you leave the match, the binder unmounts and CLEARS
 * the target — so radio can never keep playing after you close the match.
 */

export interface ActiveMatch {
  sport: string;   // "football" (extendable to other sports later)
  league: string;  // e.g. "eng.1"
  matchId: number;
}

interface RadioValue {
  active: ActiveMatch | null;
  detail: ESPNMatchDetail | null;
  setActive: (m: ActiveMatch | null) => void;
  setDetail: (d: ESPNMatchDetail | null) => void;
}

const RadioContext = createContext<RadioValue>({
  active: null,
  detail: null,
  setActive: () => {},
  setDetail: () => {},
});

export function RadioProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveMatch | null>(null);
  const [detail, setDetail] = useState<ESPNMatchDetail | null>(null);
  return createElement(
    RadioContext.Provider,
    { value: { active, detail, setActive, setDetail } },
    children,
  );
}

export function useRadio(): RadioValue {
  return useContext(RadioContext);
}

/**
 * MatchRadioBinder — renders nothing. Mount it on a match page.
 *
 * While mounted it: (1) marks this match as the Radio Mode target, and
 * (2) keeps the match detail fresh using the same 30s live-poll pattern used
 * elsewhere (`useLiveMatchDetail` — polls only while live, pauses on hidden
 * tab, 0 SignalR messages, and — crucially — piggybacks the exact match-detail
 * fetch the page already makes, so it adds no new ESPN requests). On unmount it
 * clears the target so playback stops the moment you leave the match.
 */
export function MatchRadioBinder({
  sport,
  league,
  initialDetail,
}: {
  sport: string;
  league: string;
  initialDetail: ESPNMatchDetail;
}) {
  const { setActive, setDetail } = useRadio();
  const matchId = Number(initialDetail.id);

  const fetcher = useCallback(
    async (id: number): Promise<ESPNMatchDetail> => {
      const fresh = await getMatchDetail(league, String(id));
      if (!fresh) throw new Error("match detail unavailable");
      return fresh;
    },
    [league],
  );

  // Poll fresh detail while this match is live (stops when finished / unmounted).
  const { data } = useLiveMatchDetail<ESPNMatchDetail>(
    matchId,
    initialDetail,
    fetcher,
    30_000,
  );

  // Register / clear the active target.
  useEffect(() => {
    setActive({ sport, league, matchId });
    return () => {
      setActive(null);
      setDetail(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, league, matchId]);

  // Push the freshest detail into the shared context for the RadioBar to read.
  useEffect(() => {
    setDetail(data);
  }, [data, setDetail]);

  return null;
}