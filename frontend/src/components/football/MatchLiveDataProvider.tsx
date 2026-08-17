"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { getMatchDetail, type ESPNMatchDetail } from "@/lib/api/espn";
import { useLiveMatchDetail } from "@/hooks/useLiveMatchDetail";

type MatchLiveData = ReturnType<typeof useLiveMatchDetail<ESPNMatchDetail>>;

const MatchLiveDataContext = createContext<MatchLiveData | null>(null);

export default function MatchLiveDataProvider({
  initialDetail,
  league,
  children,
}: {
  initialDetail: ESPNMatchDetail;
  league: string;
  children: ReactNode;
}) {
  const fetcher = useCallback(
    async (id: number): Promise<ESPNMatchDetail> => {
      const fresh = await getMatchDetail(league, String(id));
      if (!fresh) throw new Error("match detail unavailable");
      return fresh;
    },
    [league]
  );

  const value = useLiveMatchDetail<ESPNMatchDetail>(
    Number(initialDetail.id),
    initialDetail,
    fetcher,
    30_000
  );

  return (
    <MatchLiveDataContext.Provider value={value}>
      {children}
    </MatchLiveDataContext.Provider>
  );
}

export function useFootballLiveMatch(): MatchLiveData {
  const value = useContext(MatchLiveDataContext);
  if (!value) {
    throw new Error("useFootballLiveMatch must be used within MatchLiveDataProvider");
  }
  return value;
}
