import type { ESPNMatchDetail } from "@/lib/api/espn";

function InfoRow({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: "1px solid var(--border)", alignItems: "flex-start" }}>
      <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

export default function GameInfoCard({ match }: { match: ESPNMatchDetail }) {
  const t = Date.parse(match.kickoff ?? "");
  const dateStr = Number.isFinite(t)
    ? new Date(t).toLocaleString("en-US", {
        timeZone: "UTC",
        hour: "2-digit", minute: "2-digit",
        month: "long", day: "numeric", year: "numeric",
      })
    : null;

  const officials = (match.officials ?? []).sort((a, b) => a.order - b.order);
  const consensusOdds = (match.odds ?? []).find(o => o.provider?.toLowerCase().includes("consensus")) ?? (match.odds ?? [])[0];

  const hasContent = dateStr || match.venue || match.attendance || officials.length > 0 || consensusOdds;
  if (!hasContent) return null;

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginTop: 16 }}>
      <div style={{ padding: "12px 18px", fontSize: 12, fontWeight: 700, color: "var(--obsidian)", textTransform: "uppercase", letterSpacing: "0.8px", borderBottom: "1px solid var(--border)" }}>
        Game Information
      </div>
      <div style={{ padding: "0 18px" }}>

        {/* Date & Time */}
        {dateStr && (
          <InfoRow icon="📅">
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>{dateStr} UTC</div>
          </InfoRow>
        )}

        {/* Venue */}
        {match.venue && (
          <InfoRow icon="📍">
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>{match.venue}</div>
          </InfoRow>
        )}

        {/* Attendance */}
        {match.attendance != null && match.attendance > 0 && (
          <InfoRow icon="👥">
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>
              Attendance: {match.attendance.toLocaleString()}
            </div>
          </InfoRow>
        )}

        {/* Odds */}
        {consensusOdds && (
          <InfoRow icon="📊">
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>Odds</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {consensusOdds.details && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.4px" }}>Line</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)" }}>{consensusOdds.details}</div>
                </div>
              )}
              {consensusOdds.spread != null && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.4px" }}>Spread</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)" }}>{consensusOdds.spread > 0 ? `+${consensusOdds.spread}` : consensusOdds.spread}</div>
                </div>
              )}
              {consensusOdds.overUnder != null && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.4px" }}>O/U</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)" }}>{consensusOdds.overUnder}</div>
                </div>
              )}
            </div>
          </InfoRow>
        )}

        {/* Match Officials */}
        {officials.length > 0 && (
          <InfoRow icon="🧑‍⚖️">
            <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500, marginBottom: 6 }}>Match Officials</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {officials.map((o, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: 13 }}>
                  <span style={{ color: "var(--text-secondary)", minWidth: 70 }}>{o.position}:</span>
                  <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{o.name}</span>
                </div>
              ))}
            </div>
          </InfoRow>
        )}

      </div>
    </div>
  );
}