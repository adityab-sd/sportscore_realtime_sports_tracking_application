"use client";
import type { FormResult } from "@/types/matchSummary";

/**
 * LastFiveForm — recent form for both teams (last 5 matches), like ESPN's
 * "Last Five Matches". Shows W/D/L pill, opponent, result and competition.
 */
export default function LastFiveForm({
  homeShort,
  awayShort,
  homeForm,
  awayForm,
}: {
  homeShort: string;
  awayShort: string;
  homeForm: FormResult[] | undefined;
  awayForm: FormResult[] | undefined;
}) {
  const hasAny = (homeForm?.length ?? 0) > 0 || (awayForm?.length ?? 0) > 0;
  if (!hasAny) {
    return null;
  }

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12 }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
          Last Five Matches
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
        <FormColumn title={homeShort} rows={homeForm} />
        <FormColumn title={awayShort} rows={awayForm} borderLeft />
      </div>
    </div>
  );
}

function FormColumn({ title, rows, borderLeft }: { title: string; rows?: FormResult[]; borderLeft?: boolean }) {
  return (
    <div style={{ borderLeft: borderLeft ? "1px solid var(--border)" : "none" }}>
      <div style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "var(--obsidian)", textAlign: "center", background: "var(--cloud, #f8fafc)" }}>
        {title}
      </div>
      {(rows ?? []).map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderTop: "1px solid var(--border)" }}>
          <OutcomePill outcome={r.outcome} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--obsidian)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {r.homeAway === "A" ? "@ " : r.homeAway === "H" ? "vs " : ""}{r.opponentShort} · {r.result}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {r.date} · {r.competition}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function OutcomePill({ outcome }: { outcome: FormResult["outcome"] }) {
  const map = {
    W: { bg: "#16a34a", label: "W" },
    D: { bg: "#94a3b8", label: "D" },
    L: { bg: "#dc2626", label: "L" },
  } as const;
  const m = outcome ? map[outcome] : { bg: "var(--border)", label: "–" };
  return (
    <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: m.bg, color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {m.label}
    </span>
  );
}
