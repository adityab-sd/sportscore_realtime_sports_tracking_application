"use client";
import { useEffect, useRef, useState } from "react";
import { classifyStatus } from "@/types/football";

/**
 * useMatchClock — a client-side ticking match clock.
 *
 * WHY THIS EXISTS
 * ---------------
 * The backend only pushes SignalR updates when a NEW event happens, so between
 * events the clock never advances. This hook ticks the clock forward locally in
 * the browser, anchored to the last known `elapsed` value from the server.
 *
 * COST: 0 SignalR messages. Pure browser math (setInterval).
 *
 * DRIFT CORRECTION
 * ----------------
 * Every time a fresh `elapsedMinutes` arrives (from a 30s REST poll or a SignalR
 * push), we re-anchor: wall-clock "now" is pinned to that server minute. Any
 * accumulated drift is silently corrected. The clock never runs away from truth.
 *
 * @param elapsedMinutes  Latest server-reported elapsed minutes (Match.elapsed).
 * @param status          Match status string (used to decide if the clock runs).
 * @returns { display, totalSeconds, running }
 *          - display: "45:12" style string (or "" when not live)
 *          - totalSeconds: seconds since kickoff (for interpolation math)
 *          - running: whether the clock is currently ticking
 */
export function useMatchClock(
  elapsedMinutes: number | null | undefined,
  status: string | null | undefined
) {
  const state = classifyStatus(status);
  const isLive = state === "live";

  // Halftime: don't tick. ESPN sends "HT" — clock should freeze at 45:00.
  const isHalftime = (status ?? "").toUpperCase().includes("HT");

  const [totalSeconds, setTotalSeconds] = useState<number>(
    (elapsedMinutes ?? 0) * 60
  );

  // Anchor = the moment we last received a trustworthy server minute.
  const anchorRef = useRef<{ wall: number; serverSec: number }>({
    wall: Date.now(),
    serverSec: (elapsedMinutes ?? 0) * 60,
  });

  // Re-anchor whenever the server minute changes.
  useEffect(() => {
    if (elapsedMinutes == null) return;
    anchorRef.current = { wall: Date.now(), serverSec: elapsedMinutes * 60 };
    setTotalSeconds(elapsedMinutes * 60);
  }, [elapsedMinutes]);

  useEffect(() => {
    if (!isLive || isHalftime) return;

    const tick = () => {
      const { wall, serverSec } = anchorRef.current;
      const delta = (Date.now() - wall) / 1000;
      setTotalSeconds(serverSec + delta);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isLive, isHalftime]);

  if (!isLive) {
    return { display: "", totalSeconds: (elapsedMinutes ?? 0) * 60, running: false };
  }

  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  const display = `${mins}:${String(secs).padStart(2, "0")}`;

  return { display, totalSeconds: clamped, running: !isHalftime };
}