"use client";
import { useMatchClock } from "@/hooks/useMatchClock";
import { classifyStatus } from "@/types/football";

/**
 * LiveMatchClock — the ticking timer shown for live matches.
 *
 * Renders "45:12" style text that advances every second, with a pulsing live
 * dot. For halftime it shows "HT"; for non-live it renders nothing (callers
 * fall back to their own status label).
 *
 * Drop into ScoreHeader / MatchCard where the live status currently renders.
 */
export default function LiveMatchClock({
  elapsed,
  status,
  size = "md",
}: {
  elapsed: number | null;
  status: string;
  size?: "sm" | "md" | "lg";
}) {
  const { display, running } = useMatchClock(elapsed, status);
  const state = classifyStatus(status);
  if (state !== "live") return null;

  const isHT = status.toUpperCase().includes("HT");
  const fontSize = size === "lg" ? 15 : size === "sm" ? 11 : 13;
  const dot = size === "lg" ? 7 : 6;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        aria-hidden
        style={{
          width: dot,
          height: dot,
          borderRadius: "50%",
          background: "#ff4d4d",
          flexShrink: 0,
          animation: running ? "sc-livepulse 1.4s ease-in-out infinite" : "none",
        }}
      />
      <span
        suppressHydrationWarning
        style={{
          fontSize,
          fontWeight: 700,
          color: "#dc2626",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.3px",
        }}
      >
        {isHT ? "HT" : display}
      </span>

      <style>{`
        @keyframes sc-livepulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(0.82); }
        }
      `}</style>
    </div>
  );
}