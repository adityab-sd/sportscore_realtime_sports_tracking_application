"use client";
import Link from "next/link";
import { BBFixture } from "@/lib/api/basketball";
import TeamLogo from "@/components/football/TeamLogo";

function fmt(tipoff: string | null): string {
  if (!tipoff) return "";
  // PLEASE review — invalid tipoff not guarded: Date methods can render NaN:NaN for malformed API dates. EXAMPLE: const t = Date.parse(tipoff); if (!Number.isFinite(t)) return ""; const d = new Date(t);
  const d = new Date(tipoff);
  const today    = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  const isToday  = d.toDateString() === today.toDateString();
  const isTmrw   = d.toDateString() === tomorrow.toDateString();
  const dayLabel = isToday ? "Today" : isTmrw ? "Tomorrow"
    : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  // PLEASE review — mixed timezone labels: dayLabel uses local time but time uses UTC, so late games can show the wrong day/time pair. EXAMPLE: const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
  const time = `${d.getUTCHours().toString().padStart(2,"0")}:${d.getUTCMinutes().toString().padStart(2,"0")}`;
  return `${dayLabel}, ${time}`;
}

export default function FixtureCard({ fixture, leagueSlug }: { fixture: BBFixture; leagueSlug?: string }) {
  const isPost = fixture.statusState === "post";
  const isPre  = fixture.statusState === "pre";
  const homeLead = isPost && fixture.homeScore != null && fixture.awayScore != null && fixture.homeScore > fixture.awayScore;
  const awayLead = isPost && fixture.homeScore != null && fixture.awayScore != null && fixture.awayScore > fixture.homeScore;

  return (
    <Link href={`/basketball/${fixture.id}?league=${leagueSlug ?? 'nba'}`} style={{ textDecoration: "none" }}>
      <div className="card-hover" style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{fixture.competition || "Basketball"}</span>
          {isPost && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>FINAL</span>}
          {isPre  && <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)" }} suppressHydrationWarning>{fmt(fixture.tipoff)}</span>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <TeamLogo logo={fixture.homeTeam.logo} shortName={fixture.homeTeam.shortName} size={24} highlight={homeLead} />
            <span style={{ fontSize: 13, fontWeight: homeLead ? 700 : 500, color: homeLead ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {fixture.homeTeam.name}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 52, flexShrink: 0 }}>
            {isPost ? (
              <span className="score-num" style={{ fontSize: 18 }}>
                <span style={{ color: homeLead ? "var(--obsidian)" : "var(--text-muted)" }}>{fixture.homeScore}</span>
                <span style={{ color: "var(--border)", fontSize: 14, margin: "0 3px" }}>–</span>
                <span style={{ color: awayLead ? "var(--obsidian)" : "var(--text-muted)" }}>{fixture.awayScore}</span>
              </span>
            ) : (
              <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>vs</span>
            )}
          </div>

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 7, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: awayLead ? 700 : 500, color: awayLead ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
              {fixture.awayTeam.name}
            </span>
            <TeamLogo logo={fixture.awayTeam.logo} shortName={fixture.awayTeam.shortName} size={24} highlight={awayLead} />
          </div>
        </div>
      </div>
    </Link>
  );
}