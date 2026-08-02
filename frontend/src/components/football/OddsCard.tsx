"use client";

/**
 * OddsCard — the "Game Odds" box (moneyline / spread / over-under), like ESPN.
 * Reads odds already present on the MatchDetail (provider, spread, overUnder,
 * details, favoriteTeamId) — no backend change needed for this one.
 */

export interface OddsPick {
  provider?: string | null;
  details?: string | null;        // e.g. "RIE -145" summary line
  spread?: number | null;
  overUnder?: number | null;
  favoriteTeamId?: string | null;
}

export default function OddsCard({
  odds,
  homeShort = "HOME",
  awayShort = "AWAY",
  homeTeamId,
}: {
  odds: OddsPick[] | undefined;
  homeShort?: string;
  awayShort?: string;
  homeTeamId?: number;
}) {
  const pick = odds && odds.length > 0 ? odds[0] : null;
  if (!pick) {
    return (
      <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: "20px 0" }}>
        Odds unavailable.
      </div>
    );
  }

  const favIsHome =
    pick.favoriteTeamId != null && homeTeamId != null &&
    String(pick.favoriteTeamId) === String(homeTeamId);
  const favShort = favIsHome ? homeShort : awayShort;

  const rows: { label: string; value: string }[] = [];
  if (pick.details) rows.push({ label: "Line", value: pick.details });
  if (pick.spread != null) rows.push({ label: "Spread", value: `${favShort} ${pick.spread > 0 ? "+" : ""}${pick.spread}` });
  if (pick.overUnder != null) rows.push({ label: "O/U", value: String(pick.overUnder) });

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12 }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
          Game Odds
        </span>
        {pick.provider && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{pick.provider}</span>}
      </div>
      <div style={{ display: "flex", padding: "14px 18px", gap: 20 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{r.label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--obsidian)" }}>{r.value}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "0 18px 12px", fontSize: 10, color: "var(--text-muted)" }}>
        Odds subject to change.
      </div>
    </div>
  );
}