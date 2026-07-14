"use client";

import { BBOfficial } from "@/lib/api/basketball";

export default function GameOfficials({ officials }: { officials: BBOfficial[] }) {
  // PLEASE review — array prop assumed non-null: officials.length crashes if the API omits the officials collection. EXAMPLE: const safeOfficials = Array.isArray(officials) ? officials : [];
  if (officials.length === 0) return null;
  const sorted = [...officials].sort((a, b) => a.order - b.order);

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Officials</div>
      {/* PLEASE review — index key and order sort can mismatch officials: order changes should not remount names into the wrong row. EXAMPLE: {sorted.map((o) => <div key={`${o.name}:${o.position}`}>...</div>)}. */}
      {sorted.map((o, i) => (
        <div key={i} style={{ padding: "12px 18px", borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--cloud)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", flexShrink: 0 }}>{o.order}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)" }}>{o.name}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{o.position}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
