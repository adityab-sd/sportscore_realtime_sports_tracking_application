"use client";
import { useState, type ReactNode } from "react";

export type TabKey = "gamecast" | "teamstats" | "playerstats" | "commentary";

/**
 * MatchTabs — ESPN-style tab bar for the match page.
 * Gamecast · Team Stats · Player Stats · Commentary
 *
 * Presentational shell: you pass the content for each tab, it handles the
 * active-tab state and the tab bar UI. Works the same for live and finished
 * matches — the caller decides what each tab renders based on status.
 */
export default function MatchTabs({
  gamecast,
  teamStats,
  playerStats,
  commentary,
  initial = "gamecast",
}: {
  gamecast: ReactNode;
  teamStats: ReactNode;
  playerStats: ReactNode;
  commentary: ReactNode;
  initial?: TabKey;
}) {
  const [active, setActive] = useState<TabKey>(initial);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "gamecast", label: "Gamecast" },
    { key: "teamstats", label: "Team Stats" },
    { key: "playerstats", label: "Player Stats" },
    { key: "commentary", label: "Commentary" },
  ];

  const content: Record<TabKey, ReactNode> = {
    gamecast,
    teamstats: teamStats,
    playerstats: playerStats,
    commentary,
  };

  return (
    <div>
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border)",
          marginBottom: 20,
          overflowX: "auto",
        }}
      >
        {tabs.map((t) => {
          const on = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              style={{
                position: "relative",
                padding: "12px 18px",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: on ? 700 : 500,
                color: on ? "var(--obsidian)" : "var(--text-muted)",
                whiteSpace: "nowrap",
                transition: "color 0.15s",
              }}
            >
              {t.label}
              {on && (
                <span
                  style={{
                    position: "absolute",
                    left: 12,
                    right: 12,
                    bottom: -1,
                    height: 3,
                    borderRadius: 2,
                    background: "var(--navy)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      <div>{content[active]}</div>
    </div>
  );
}