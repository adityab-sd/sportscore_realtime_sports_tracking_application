"use client";
import { useMemo } from "react";
import type { PlayPoint } from "@/types/plays";

/**
 * MomentumChart — ESPN-style "Match Timeline & Momentum".
 *
 * Preferred: render `momentum[]` from the summary (per-minute values, positive
 * = home pressure, negative = away). This arrives via the same 30s poll as
 * everything else, so it refreshes live with no extra fetch.
 *
 * Fallback: if the backend doesn't send momentum yet, we APPROXIMATE it from
 * plays[] — bucketing attacking plays (shots, corners, box entries) per minute
 * per team. It's a rough proxy, clearly not ESPN's model, but gives a live feel
 * until real momentum data is wired.
 */

export interface MomentumPoint {
  minute: number;
  value: number; // + = home pressure, - = away pressure (roughly -100..100)
}

export default function MomentumChart({
  momentum,
  plays,
  homeShort = "HOME",
  awayShort = "AWAY",
  homeColor = "#003f88",
  awayColor = "#dc2626",
}: {
  momentum?: MomentumPoint[];
  plays?: PlayPoint[];
  homeShort?: string;
  awayShort?: string;
  homeColor?: string;
  awayColor?: string;
}) {
  // Use real momentum if present; otherwise approximate from plays.
  const series = useMemo<MomentumPoint[]>(() => {
    if (momentum && momentum.length > 0) return momentum;
    if (!plays || plays.length === 0) return [];

    // Approximate: for each minute, +weight for home attacking plays, -weight
    // for away. Shots/corners/box-entries weigh more than generic plays.
    const byMinute = new Map<number, number>();
    const weightOf = (p: PlayPoint) => {
      const t = `${p.type} ${p.text}`.toLowerCase();
      if (p.scoring) return 40;
      if (/shot|attempt/.test(t)) return 18;
      if (/corner/.test(t)) return 10;
      if (/box|penalty area|dangerous/.test(t)) return 8;
      return 2;
    };
    for (const p of plays) {
      const min = parseInt(p.minute, 10);
      if (Number.isNaN(min)) continue;
      const sign = p.team === "home" ? 1 : p.team === "away" ? -1 : 0;
      if (sign === 0) continue;
      byMinute.set(min, (byMinute.get(min) ?? 0) + sign * weightOf(p));
    }
    return [...byMinute.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([minute, value]) => ({ minute, value: Math.max(-100, Math.min(100, value)) }));
  }, [momentum, plays]);

  if (series.length === 0) {
    return null;
  }

  const approximated = !(momentum && momentum.length > 0);
  const W = 680, H = 150, mid = H / 2;
  const maxMin = Math.max(90, ...series.map((s) => s.minute));
  const x = (min: number) => (min / maxMin) * W;
  const barW = Math.max(2, (W / maxMin) * 0.7);

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: "clamp(12px,3vw,18px)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
          Match Timeline &amp; Momentum
        </span>
        {approximated && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>approx.</span>}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
        <span style={{ color: homeColor }}>{homeShort}</span>
        <span style={{ color: awayColor }}>{awayShort}</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {/* baseline */}
        <line x1="0" y1={mid} x2={W} y2={mid} stroke="var(--border)" strokeWidth="1" />
        {series.map((s) => {
          const h = (Math.abs(s.value) / 100) * (mid - 6);
          const isHome = s.value >= 0;
          return (
            <rect
              key={s.minute}
              x={x(s.minute) - barW / 2}
              y={isHome ? mid - h : mid}
              width={barW}
              height={h}
              rx="1"
              fill={isHome ? homeColor : awayColor}
              opacity="0.85"
            />
          );
        })}
        {/* HT marker */}
        <line x1={x(45)} y1="4" x2={x(45)} y2={H - 4} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
      </svg>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
        <span>KO</span><span>HT</span><span>FT</span>
      </div>
    </div>
  );
}
