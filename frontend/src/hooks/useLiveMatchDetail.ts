"use client";
import { useEffect, useRef, useState, useCallback } from "react";

/**
 * useLiveMatchDetail — polls a match/game detail endpoint every `intervalMs`
 * while the match is live, and stops once it finishes.
 *
 * SPORT-AGNOSTIC: liveness is decided by ESPN's universal `statusState` field
 * ("in" = live, "pre"/"post" = not). Override with the `isLive` param if a
 * sport needs custom logic. No import from any sport's types — works for
 * football, baseball, basketball, etc.
 *
 * COST: 0 SignalR messages. Polls only while live, pauses when the tab is
 * hidden, aborts stale requests, and keeps the last good data on error.
 *
 * @param matchId    event id
 * @param initial    server-rendered initial detail (instant first paint)
 * @param fetcher    async (id) => detail
 * @param intervalMs poll cadence (default 30000)
 * @param isLive     optional custom liveness check
 */
export function useLiveMatchDetail<T extends { status?: string; statusState?: string }>(
  matchId: number,
  initial: T,
  fetcher: (id: number) => Promise<T>,
  intervalMs = 30_000,
  isLive?: (data: T) => boolean,
) {
  const [data, setData] = useState<T>(initial);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const live = isLive ? isLive(data) : (data.statusState === "in");

  const poll = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setIsFetching(true);
    try {
      const fresh = await fetcher(matchId);
      if (!ac.signal.aborted) {
        setData(fresh);
        setLastUpdated(new Date());
        setError(null);
      }
    } catch (e) {
      if (!ac.signal.aborted) {
        setError(e instanceof Error ? e.message : "Failed to refresh");
      }
    } finally {
      if (!ac.signal.aborted) setIsFetching(false);
    }
  }, [matchId, fetcher]);

  useEffect(() => {
    if (!live) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const start = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (document.visibilityState === "visible") poll();
      }, intervalMs);
    };
    poll();
    start();
    const onVisible = () => { if (document.visibilityState === "visible") poll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
      abortRef.current?.abort();
    };
  }, [live, poll, intervalMs]);

  return { data, isFetching, error, lastUpdated, live, refresh: poll };
}