"use client";

import type { BBGameDetail } from "@/lib/api/basketball";
import { Calendar, MapPin, Users, Tv } from "lucide-react";

interface Props {
  game: BBGameDetail;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    hour: "numeric", minute: "2-digit",
    month: "long", day: "numeric", year: "numeric",
  });
}

function fmtSpread(s: number | null) {
  return s == null ? "–" : s > 0 ? `+${s.toFixed(1)}` : s.toFixed(1);
}

export default function GameSidebar({ game }: Props) {
  const hasOdds = game.odds && game.odds.length > 0;
  const hasOfficials = game.officials && game.officials.length > 0;
  const topOdds = game.odds?.[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Game Info */}
      <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 800, color: "var(--obsidian)", letterSpacing: "-0.2px" }}>
          GAME INFORMATION
        </div>

        {game.tipoff && (
          <InfoRow icon={<Calendar size={14} />} label={fmtDate(game.tipoff)} />
        )}
        {game.venue && (
          <InfoRow icon={<MapPin size={14} />} label={game.venue} />
        )}
        {game.attendance != null && (
          <InfoRow icon={<Users size={14} />} label={`${game.attendance.toLocaleString()} attendance`} />
        )}
        <InfoRow icon={<Tv size={14} />} label="Broadcast info coming soon" muted />
      </div>

      {/* Odds */}
      {hasOdds && topOdds && (
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 800, color: "var(--obsidian)", letterSpacing: "-0.2px" }}>
            ODDS
          </div>
          <div style={{ padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <MiniStat label="Spread" value={fmtSpread(topOdds.spread)} />
            <MiniStat label="O/U" value={topOdds.overUnder != null ? topOdds.overUnder.toFixed(1) : "–"} />
          </div>
          {topOdds.details && (
            <div style={{ padding: "0 14px 12px", fontSize: 11, color: "var(--text-muted)" }}>{topOdds.details}</div>
          )}
        </div>
      )}

      {/* Officials */}
      {hasOfficials && (
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 800, color: "var(--obsidian)", letterSpacing: "-0.2px" }}>
            OFFICIATING CREW
          </div>
          <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
            {game.officials.sort((a, b) => a.order - b.order).map((o, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 60 }}>{o.position}:</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--obsidian)" }}>{o.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, muted }: { icon: React.ReactNode; label: string; muted?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 12, color: muted ? "var(--text-muted)" : "var(--text-secondary)", fontStyle: muted ? "italic" : "normal" }}>
      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{icon}</span>
      <span suppressHydrationWarning>{label}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center", padding: "6px 0" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 3 }}>{label}</div>
      <div className="stat-num" style={{ fontSize: 16, fontWeight: 800, color: "var(--obsidian)" }}>{value}</div>
    </div>
  );
}