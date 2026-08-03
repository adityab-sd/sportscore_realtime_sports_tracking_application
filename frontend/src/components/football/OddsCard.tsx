"use client";

/**
 * OddsCard — sidebar "Game Odds" panel, styled like ESPN's.
 * Renders only the data we actually have (spread, over/under, line details).
 * Returns null when there are no odds — no placeholder text.
 */

export interface OddsPick {
  provider?: string | null;
  details?: string | null;
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
  homeTeamId?: string | number;
}) {
  const pick = odds && odds.length > 0 ? odds[0] : null;
  if (!pick || (pick.spread == null && pick.overUnder == null && !pick.details)) {
    return null; // no odds → render nothing (no placeholder)
  }

  const favIsHome =
    pick.favoriteTeamId != null && homeTeamId != null &&
    String(pick.favoriteTeamId) === String(homeTeamId);

  // Spread is stated for the favourite; the underdog gets the opposite sign.
  const favSpread = pick.spread ?? null;
  const dogSpread = favSpread != null ? -favSpread : null;
  const fmt = (n: number | null) => (n == null ? "—" : n > 0 ? `+${n}` : `${n}`);

  const homeSpread = favIsHome ? favSpread : dogSpread;
  const awaySpread = favIsHome ? dogSpread : favSpread;

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 16 }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--obsidian)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Game Odds</span>
        {pick.provider && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{pick.provider}</span>}
      </div>

      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 16, padding: "10px 18px 6px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        <span></span>
        <span style={{ textAlign: "center", minWidth: 54 }}>Spread</span>
        <span style={{ textAlign: "center", minWidth: 54 }}>O/U</span>
      </div>

      {/* Home row */}
      <OddRow team={homeShort} spread={fmt(homeSpread)} ou={pick.overUnder != null ? `o${pick.overUnder}` : "—"} />
      {/* Away row */}
      <OddRow team={awayShort} spread={fmt(awaySpread)} ou={pick.overUnder != null ? `u${pick.overUnder}` : "—"} />

      {pick.details && (
        <div style={{ padding: "8px 18px 12px", fontSize: 11, color: "var(--text-muted)" }}>
          Line: {pick.details}
        </div>
      )}
    </div>
  );
}

function OddRow({ team, spread, ou }: { team: string; spread: string; ou: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 16, padding: "10px 18px", alignItems: "center", borderTop: "1px solid var(--border)" }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--obsidian)" }}>{team}</span>
      <span style={{ textAlign: "center", minWidth: 54, fontSize: 14, fontWeight: 800, color: "var(--obsidian)", background: "#f8fafc", borderRadius: 6, padding: "6px 0" }}>{spread}</span>
      <span style={{ textAlign: "center", minWidth: 54, fontSize: 14, fontWeight: 800, color: "var(--obsidian)", background: "#f8fafc", borderRadius: 6, padding: "6px 0" }}>{ou}</span>
    </div>
  );
}
