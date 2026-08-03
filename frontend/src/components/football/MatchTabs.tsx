"use client";
import { useState, type ReactNode } from "react";

export type TabKey = "gamecast" | "teamstats" | "playerstats" | "commentary";

/**
 * MatchTabs — ESPN-style tab bar. Tabs with no data are hidden entirely.
 *
 * Each tab has an `enabled` flag; disabled tabs don't appear in the bar at all
 * (no empty tabs, no placeholders). The default active tab is the first enabled
 * one. Gamecast is expected to always be enabled.
 */
export default function MatchTabs({
  gamecast,
  teamStats,
  playerStats,
  commentary,
  teamStatsEnabled = true,
  playerStatsEnabled = true,
  commentaryEnabled = true,
}: {
  gamecast: ReactNode;
  teamStats: ReactNode;
  playerStats: ReactNode;
  commentary: ReactNode;
  teamStatsEnabled?: boolean;
  playerStatsEnabled?: boolean;
  commentaryEnabled?: boolean;
}) {
  const allTabs: { key: TabKey; label: string; enabled: boolean }[] = [
    { key: "gamecast", label: "Gamecast", enabled: true },
    { key: "teamstats", label: "Team Stats", enabled: teamStatsEnabled },
    { key: "playerstats", label: "Player Stats", enabled: playerStatsEnabled },
    { key: "commentary", label: "Commentary", enabled: commentaryEnabled },
  ];
  const tabs = allTabs.filter((t) => t.enabled);

  const [active, setActive] = useState<TabKey>(tabs[0]?.key ?? "gamecast");

  // If the active tab got disabled (data went away), fall back to first enabled.
  const activeExists = tabs.some((t) => t.key === active);
  const current = activeExists ? active : tabs[0]?.key ?? "gamecast";

  const content: Record<TabKey, ReactNode> = {
    gamecast,
    teamstats: teamStats,
    playerstats: playerStats,
    commentary,
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 20, overflowX: "auto" }}>
        {tabs.map((t) => {
          const on = current === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              style={{
                position: "relative", padding: "12px 18px", border: "none", background: "none",
                cursor: "pointer", fontSize: 14, fontWeight: on ? 700 : 500,
                color: on ? "var(--obsidian)" : "var(--text-muted)", whiteSpace: "nowrap",
                transition: "color 0.15s",
              }}
            >
              {t.label}
              {on && <span style={{ position: "absolute", left: 12, right: 12, bottom: -1, height: 3, borderRadius: 2, background: "var(--navy)" }} />}
            </button>
          );
        })}
      </div>
      <div>{content[current]}</div>
    </div>
  );
}