"use client";
import { useState } from "react";

export default function MatchColumnTabs({ tabs }: { tabs: { key: string; label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const current = tabs.find(t => t.key === active) ?? tabs[0];
  return (
    <div>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 16, overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActive(t.key)} style={{
            padding: "10px 16px", background: "none", border: "none", cursor: "pointer",
            fontSize: 14, fontWeight: 600, whiteSpace: "nowrap",
            color: active === t.key ? "var(--navy)" : "var(--text-muted)",
            borderBottom: active === t.key ? "2px solid var(--navy)" : "2px solid transparent",
            marginBottom: -1, transition: "all 0.15s",
          }}>{t.label}</button>
        ))}
      </div>
      <div>{current?.content}</div>
    </div>
  );
}