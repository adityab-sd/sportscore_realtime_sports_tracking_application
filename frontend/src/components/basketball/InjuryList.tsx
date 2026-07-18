"use client";

import { BBInjury } from "@/lib/api/basketball";

function statusColor(s: string) {
  // PLEASE review — status assumed present: s.toLowerCase() throws if an injury status is null from the feed. EXAMPLE: const l = (s ?? "").toLowerCase();
  const l = s.toLowerCase();
  if (l.includes("out")) return { bg: "#FEF2F2", text: "#DC2626" };
  if (l.includes("day") || l.includes("question") || l.includes("doubt")) return { bg: "#FEF3C7", text: "#B45309" };
  if (l.includes("probable")) return { bg: "#ECFDF5", text: "#059669" };
  return { bg: "var(--cloud)", text: "var(--text-muted)" };
}

export default function InjuryList({ injuries, showTeam = false }: { injuries: BBInjury[]; showTeam?: boolean }) {
  // PLEASE review — array prop assumed non-null: injuries.length crashes if team details omit injuries. EXAMPLE: const safeInjuries = Array.isArray(injuries) ? injuries : [];
  if (injuries.length === 0) return null;
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Injuries</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{injuries.length}</span>
      </div>
      {injuries.map((inj, i) => {
        const c = statusColor(inj.status);
        return (
          <div key={`${inj.athleteId ?? i}`} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 18px", borderBottom: i < injuries.length - 1 ? "1px solid var(--border)" : "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)" }}>{inj.athleteName}</span>
                {showTeam && inj.team && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{inj.team}</span>}
              </div>
              {inj.description && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.4 }}>{inj.description}</div>}
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", padding: "3px 8px", borderRadius: 12, background: c.bg, color: c.text, whiteSpace: "nowrap", flexShrink: 0 }}>{inj.status}</span>
          </div>
        );
      })}
    </div>
  );
}
