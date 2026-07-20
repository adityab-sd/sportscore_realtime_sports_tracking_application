"use client";

import { useState } from "react";
import type { RawJSON } from "@/lib/api/basketball";

interface ParsedPlay {
  id: string;
  text: string;
  homeScore: number;
  awayScore: number;
  quarter: number;
  clock: string;
  scoringPlay: boolean;
  teamId: string | null;
}

function parsePlays(data: RawJSON): { plays: ParsedPlay[]; quarters: number[] } {
  const gpj = data?.gamepackageJSON ?? data;
  const rawPlays = gpj?.plays ?? gpj?.items ?? [];
  const plays: ParsedPlay[] = [];

  for (const p of rawPlays) {
    plays.push({
      id: p.id ?? String(plays.length),
      text: p.text ?? "",
      homeScore: p.homeScore ?? 0,
      awayScore: p.awayScore ?? 0,
      quarter: p.period?.number ?? 1,
      clock: p.clock?.displayValue ?? "",
      scoringPlay: p.scoringPlay ?? false,
      teamId: p.team?.id ?? null,
    });
  }

  const quarters = [...new Set(plays.map((p) => p.quarter))].sort((a, b) => a - b);
  return { plays, quarters };
}

function quarterLabel(q: number): string {
  if (q <= 4) return `Q${q}`;
  const ot = q - 4;
  return ot === 1 ? "OT" : `${ot}OT`;
}

interface Props {
  data: RawJSON;
}

export default function PlayByPlay({ data }: Props) {
  const { plays, quarters } = parsePlays(data);
  // ADDRESSED: derived state can go stale: activeQ is initialized once, so new data with different quarters can leave the UI on an empty period. EXAMPLE: useEffect(() => setActiveQ(quarters.at(-1) ?? 1), [quarters]);
  const [activeQ, setActiveQ] = useState<number>(quarters[quarters.length - 1] ?? 1);

  if (plays.length === 0) return null;

  const filtered = plays
    .filter((p) => p.quarter === activeQ)
    .sort((a, b) => {
      // ADDRESSED: clock parsing assumes MM:SS: malformed clocks produce NaN and unstable ordering. EXAMPLE: const toSeconds = (clock: string) => /^\d+:\d{2}$/.test(clock) ? clock.split(":").reduce((m, v) => m * 60 + Number(v), 0) : -1;
      const [aM, aS] = a.clock.split(":").map(Number);
      const [bM, bS] = b.clock.split(":").map(Number);
      const aSec = (aM || 0) * 60 + (aS || 0);
      const bSec = (bM || 0) * 60 + (bS || 0);
      return bSec - aSec;
    });

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
          Play-by-Play
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          {quarters.map((q) => (
            <button
              key={q}
              onClick={() => setActiveQ(q)}
              className={`pill${activeQ === q ? " active" : ""}`}
              style={{ padding: "4px 12px", fontSize: 12 }}
            >
              {quarterLabel(q)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxHeight: 480, overflowY: "auto", padding: "4px 0" }}>
        {filtered.map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "8px 18px",
              borderBottom: "1px solid var(--border)",
              background: p.scoringPlay ? "rgba(234,88,12,0.03)" : "transparent",
            }}
          >
            <span
              className="stat-num"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                minWidth: 38,
                textAlign: "right",
                flexShrink: 0,
                paddingTop: 1,
              }}
            >
              {p.clock}
            </span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12,
                color: p.scoringPlay ? "var(--obsidian)" : "var(--text-secondary)",
                fontWeight: p.scoringPlay ? 600 : 400,
                lineHeight: 1.4,
              }}>
                {p.text}
              </div>
            </div>

            {p.scoringPlay && (
              <span
                className="stat-num"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--obsidian)",
                  flexShrink: 0,
                  background: "var(--cloud)",
                  padding: "2px 8px",
                  borderRadius: 6,
                }}
              >
                {p.awayScore}–{p.homeScore}
              </span>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{ padding: "24px 18px", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
            No plays recorded for this period.
          </div>
        )}
      </div>
    </div>
  );
}
