"use client";
import { useEffect, useState } from "react";

interface StatDef {
  category: string;
  key: string;
  label: string;
  isPercent?: boolean;
}
interface ESPNStatValue {
  name: string;
  value?: number;
  displayValue?: string;
}
interface ESPNStatCategory {
  name: string;
  stats: ESPNStatValue[];
}

const HEADLINE_STATS: StatDef[] = [
  { category: "offensive", key: "possessionPct",  label: "Possession",       isPercent: true },
  { category: "offensive", key: "totalShots",     label: "Total Shots" },
  { category: "offensive", key: "shotsOnTarget",  label: "Shots on Target" },
  { category: "general",   key: "wonCorners",     label: "Corners" },
  { category: "offensive", key: "totalPasses",    label: "Total Passes" },
  { category: "general",   key: "passPct",        label: "Pass Accuracy",   isPercent: true },
  { category: "general",   key: "foulsCommitted", label: "Fouls" },
  { category: "offensive", key: "offsides",       label: "Offsides" },
  { category: "general",   key: "yellowCards",    label: "Yellow Cards" },
  { category: "general",   key: "redCards",       label: "Red Cards" },
];

function findStat(categories: ESPNStatCategory[], categoryName: string, statName: string): ESPNStatValue | undefined {
  const cat = categories.find(c => c.name === categoryName);
  return cat?.stats.find(s => s.name === statName);
}

function toPercent(value: number): number {
  return value <= 1 ? value * 100 : value;
}

interface StatRow { def: StatDef; h?: ESPNStatValue; a?: ESPNStatValue; }

/** Starts both sides meeting at the center (50/50) and animates outward to the real split. */
function AnimatedSplitBar({ targetHomePct, homeColor, awayColor }: { targetHomePct: number; homeColor: string; awayColor: string }) {
  const [homePct, setHomePct] = useState(50);
  useEffect(() => {
    const id = requestAnimationFrame(() => setHomePct(targetHomePct));
    return () => cancelAnimationFrame(id);
  }, [targetHomePct]);
  return (
    <div style={{ display: "flex", height: 7, borderRadius: 4, overflow: "hidden", background: "var(--cloud)" }}>
      <div style={{ width: `${homePct}%`, background: homeColor, transition: "width 750ms cubic-bezier(0.22,1,0.36,1)" }} />
      <div style={{ width: `${100 - homePct}%`, background: awayColor, transition: "width 750ms cubic-bezier(0.22,1,0.36,1)" }} />
    </div>
  );
}

interface TeamRef { name: string; shortName: string; }

export default function MatchStatsComparison({
  home, away, homeTeam, awayTeam, homeColor, awayColor,
}: {
  home: ESPNStatCategory[];
  away: ESPNStatCategory[];
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  homeColor?: string | null;
  awayColor?: string | null;
}) {
  if ((!home || home.length === 0) && (!away || away.length === 0)) return null;

  const hColor = homeColor ? `#${homeColor.replace("#", "")}` : "var(--navy)";
  const aColor = awayColor ? `#${awayColor.replace("#", "")}` : "var(--border)";

  const rows: StatRow[] = [];
  for (const def of HEADLINE_STATS) {
    const h = findStat(home, def.category, def.key);
    const a = findStat(away, def.category, def.key);
    if (!h && !a) continue;
    if ((h?.value ?? 0) === 0 && (a?.value ?? 0) === 0) continue;
    rows.push({ def, h, a });
  }
  if (rows.length === 0) return null;

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 16 }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
        Match Stats
      </div>
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
          <span>{homeTeam.shortName || homeTeam.name}</span>
          <span>{awayTeam.shortName || awayTeam.name}</span>
        </div>

        {rows.map(({ def, h, a }) => {
          const hRaw = h?.value ?? 0;
          const aRaw = a?.value ?? 0;
          const hNorm = def.isPercent ? toPercent(hRaw) : hRaw;
          const aNorm = def.isPercent ? toPercent(aRaw) : aRaw;
          const total = hNorm + aNorm || 1;
          const homePct = (hNorm / total) * 100;
          const hDisplay = def.isPercent ? `${Math.round(hNorm)}%` : (h?.displayValue ?? "0");
          const aDisplay = def.isPercent ? `${Math.round(aNorm)}%` : (a?.displayValue ?? "0");

          return (
            <div key={def.key}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                <span style={{ color: "var(--obsidian)" }}>{hDisplay}</span>
                <span style={{ color: "var(--text-muted)" }}>{def.label}</span>
                <span style={{ color: "var(--obsidian)" }}>{aDisplay}</span>
              </div>
              <AnimatedSplitBar targetHomePct={homePct} homeColor={hColor} awayColor={aColor} />
            </div>
          );
        })}
      </div>
    </div>
  );
}