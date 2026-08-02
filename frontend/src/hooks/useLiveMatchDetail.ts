"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { classifyStatus } from "@/types/football";

/**
 * useLiveMatchDetail — polls the rich matchDetail endpoint on an interval while
 * a match is live, and stops once it finishes.
 *
 * WHY: The detail page previously relied on the thin SignalR stream (no player
 * names, duplicated against the REST fetch). This makes the REST detail endpoint
 * the single source of truth, polled every 30s. Player names, events, stats and
 * play coordinates all come from one place — no duplication, no SignalR needed.
 *
 * COST: 0 SignalR messages. Hits your Spring backend (which caches ESPN calls).
 *
 * SCALABILITY / SAFETY
 * --------------------
 * - Polls ONLY while live. Finished/scheduled → no polling.
 * - Pauses when the browser tab is hidden (visibilitychange) to save calls.
 * - Aborts in-flight requests on unmount / re-poll to avoid race conditions.
 * - Never throws into render; errors are surfaced via `error` and the last good
 *   data is kept on screen.
 *
 * @param matchId    The event id.
 * @param initial    Server-rendered initial detail (so first paint is instant).
 * @param fetcher    async (id) => detail — inject your lib/api call here.
 * @param intervalMs Poll cadence (default 30000).
 */
export function useLiveMatchDetail<T extends { status?: string }>(
  matchId: number,
  initial: T,
  fetcher: (id: number) => Promise<T>,
  intervalMs = 30_000
) {
  const [data, setData] = useState<T>(initial);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const live = classifyStatus(data.status) === "live";

  const poll = useCallback(async () => {
    // Cancel any in-flight request before starting a new one.
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
      // Not live: ensure no timer runs.
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const start = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (document.visibilityState === "visible") poll();
      }, intervalMs);
    };

    // Poll once immediately, then on interval.
    poll();
    start();

    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
      abortRef.current?.abort();
    };
  }, [live, poll, intervalMs]);

  return { data, isFetching, error, lastUpdated, live, refresh: poll };
}