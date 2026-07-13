"use client";

import type { RawJSON } from "@/lib/api/basketball";

function parseDraftPicks(data: RawJSON): {
  picks: { round: number; pick: number; player: string; team: string; position: string }[];
} {
  const picks: { round: number; pick: number; player: string; team: string; position: string }[] = [];

  const rounds = data?.rounds ?? data?.draft?.rounds ?? [];
  if (Array.isArray(rounds)) {
    for (const round of rounds) {
      const roundNum = round?.round ?? round?.number ?? 1;
      const roundPicks = round?.picks ?? round?.selections ?? [];
      for (const p of roundPicks) {
        picks.push({
          round: roundNum,
          pick: p.overall ?? p.pick ?? p.number ?? 0,
          player: p.athlete?.displayName ?? p.athlete?.fullName ?? p.name ?? "–",
          team: p.team?.displayName ?? p.team?.abbreviation ?? "–",
          position: p.athlete?.position?.abbreviation ?? p.position?.abbreviation ?? "",
        });
      }
    }
  }

  const items = data?.items ?? data?.picks ?? [];
  if (picks.length === 0 && Array.isArray(items)) {
    for (const p of items) {
      picks.push({
        round: p.round ?? 1,
        pick: p.overall ?? p.pick ?? p.number ?? 0,
        player: p.athlete?.displayName ?? p.name ?? "–",
        team: p.team?.displayName ?? p.team?.abbreviation ?? "–",
        position: p.athlete?.position?.abbreviation ?? "",
      });
    }
  }

  return { picks };
}

export default function DraftBoard({ data }: { data: RawJSON }) {
  const { picks } = parseDraftPicks(data);

  if (picks.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "32px 0" }}>No draft data available.</p>;
  }

  const rounds = [...new Set(picks.map((p) => p.round))].sort((a, b) => a - b);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {rounds.map((round) => {
        const roundPicks = picks.filter((p) => p.round === round).sort((a, b) => a.pick - b.pick);

        return (
          <section key={round}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)", margin: 0 }}>Round {round}</h2>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{roundPicks.length} picks</span>
            </div>

            <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              {roundPicks.map((p, i) => (
                <div
                  key={p.pick}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 16px",
                    borderBottom: i < roundPicks.length - 1 ? "1px solid var(--border)" : "none",
                    transition: "background 100ms",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--cloud)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span className="stat-num" style={{ fontSize: 14, fontWeight: 800, color: p.pick <= 3 ? "#EA580C" : "var(--text-muted)", minWidth: 28, textAlign: "center" }}>
                    {p.pick}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)" }}>{p.player}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {[p.team, p.position].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
