"use client";

import { useState, type ReactNode } from "react";

export interface TeamTab {
  id: string;
  label: string;
  content: ReactNode;
}

export default function TeamTabs({ tabs, initialTab }: { tabs: TeamTab[]; initialTab?: string }) {
  const validInitial = tabs.find(t => t.id === initialTab)?.id ?? tabs[0]?.id;
  const [active, setActive] = useState(validInitial);
  const activeTab = tabs.find(t => t.id === active) ?? tabs[0];

  return (
    <div>
      <div
        role="tablist"
        style={{
          display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--border)",
          overflowX: "auto",
        }}
      >
        {tabs.map(t => {
          const isActive = t.id === activeTab?.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.id)}
              style={{
                appearance: "none", background: "none", border: "none", cursor: "pointer",
                padding: "12px 16px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
                color: isActive ? "var(--navy)" : "var(--text-muted)",
                borderBottom: isActive ? "2px solid var(--navy)" : "2px solid transparent",
                marginBottom: -1, transition: "color 100ms",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {activeTab?.content}
    </div>
  );
}