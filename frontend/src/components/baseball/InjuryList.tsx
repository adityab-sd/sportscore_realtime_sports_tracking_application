import { BBInjury } from "@/lib/api/baseball";

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("out") || s.includes("il")) return "#dc2626";
  if (s.includes("day")) return "#d97706";
  if (s.includes("active") || s.includes("probable")) return "var(--success)";
  return "var(--text-muted)";
}

export default function InjuryList({ injuries }: { injuries: BBInjury[] }) {
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      {injuries.map((inj, i) => (
        <div key={`${inj.athleteId ?? inj.athleteName}-${i}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < injuries.length - 1 ? "1px solid var(--border)" : "none" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor(inj.status), flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--obsidian)" }}>{inj.athleteName}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.3 }}>
              {inj.team ? `${inj.team} · ` : ""}{inj.description ?? inj.status}
            </div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: statusColor(inj.status), textTransform: "uppercase", letterSpacing: "0.4px", flexShrink: 0 }}>
            {inj.status}
          </span>
        </div>
      ))}
    </div>
  );
}
