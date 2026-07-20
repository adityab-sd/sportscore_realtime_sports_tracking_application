"use client";

import { BBOddsPick, BBTeamRef } from "@/lib/api/basketball";

function fmtSpread(s: number | null) { return s == null ? "–" : s > 0 ? `+${s.toFixed(1)}` : s.toFixed(1); }
function fmtOU(ou: number | null) { return ou == null ? "–" : `O/U ${ou.toFixed(1)}`; }

export default function GameOdds({ odds, homeTeam, awayTeam }: { odds: BBOddsPick[]; homeTeam: BBTeamRef; awayTeam: BBTeamRef }) {
  // ADDRESSED: array prop assumed non-null: a missing odds field from the detail API will throw on (odds ?? []).length. EXAMPLE: const safeOdds = Array.isArray(odds) ? odds : [];
  if ((odds ?? []).length === 0) return null;

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Odds</div>
      {(odds ?? []).map((o, i) => {
        const fav = o.favoriteTeamId === homeTeam.id ? homeTeam : o.favoriteTeamId === awayTeam.id ? awayTeam : null;
        return (
          {/* ADDRESSED: index key hides provider reordering: odds providers can be added/removed live, remounting the wrong row. EXAMPLE: <div key={o.provider ?? `${o.details}:${i}`}>...</div>. */}
          <div key={i} style={{ padding: "12px 18px", borderBottom: i < (odds ?? []).length - 1 ? "1px solid var(--border)" : "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)" }}>{o.provider}</div>
              {o.details && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{o.details}</div>}
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 2 }}>Spread</div>
                <div className="stat-num" style={{ fontSize: 14, fontWeight: 700, color: "var(--obsidian)" }}>{fmtSpread(o.spread)}</div>
              </div>
              <div style={{ width: 1, height: 28, background: "var(--border)" }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 2 }}>Total</div>
                <div className="stat-num" style={{ fontSize: 14, fontWeight: 700, color: "var(--obsidian)" }}>{fmtOU(o.overUnder)}</div>
              </div>
              {fav && (<>
                <div style={{ width: 1, height: 28, background: "var(--border)" }} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 2 }}>Favorite</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>{fav.shortName}</div>
                </div>
              </>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
