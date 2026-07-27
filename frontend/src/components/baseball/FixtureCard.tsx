"use client";
import Link from "next/link";
import { BBFixture } from "@/lib/api/baseball";
import { formatMatchDateTime, formatMatchDay } from "@/lib/formatDate";
import TeamLogo from "./TeamLogo";

export default function FixtureCard({ fixture, leagueSlug }: { fixture: BBFixture; leagueSlug?: string }) {
  const isPost = fixture.statusState === "post";
  const isPre = fixture.statusState === "pre";
  const homeLead = isPost && fixture.homeScore != null && fixture.awayScore != null && fixture.homeScore > fixture.awayScore;
  const awayLead = isPost && fixture.homeScore != null && fixture.awayScore != null && fixture.awayScore > fixture.homeScore;

  return (
    <Link href={`/baseball/${fixture.id}?league=${leagueSlug ?? "mlb"}`} style={{ textDecoration: "none" }}>
      <div className="card-hover" style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {fixture.competition || "Baseball"}
          </span>
          {isPost && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }} suppressHydrationWarning>{formatMatchDay(fixture.firstPitch)}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>Final</span>
            </span>
          )}
          {isPre && <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", flexShrink: 0 }} suppressHydrationWarning>{formatMatchDateTime(fixture.firstPitch)}</span>}
        </div>

        {/* Baseball convention: away @ home */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <TeamLogo logo={fixture.awayTeam.logo} shortName={fixture.awayTeam.shortName} size={24} highlight={awayLead} />
            <span style={{ fontSize: 13, fontWeight: awayLead ? 700 : 500, color: awayLead ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {fixture.awayTeam.name}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 52, flexShrink: 0 }}>
            {isPost ? (
              <span className="score-num" style={{ fontSize: 18 }}>
                <span style={{ color: awayLead ? "var(--obsidian)" : "var(--text-muted)" }}>{fixture.awayScore}</span>
                <span style={{ color: "var(--border)", fontSize: 14, margin: "0 3px" }}>–</span>
                <span style={{ color: homeLead ? "var(--obsidian)" : "var(--text-muted)" }}>{fixture.homeScore}</span>
              </span>
            ) : (
              <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>@</span>
            )}
          </div>

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 7, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: homeLead ? 700 : 500, color: homeLead ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
              {fixture.homeTeam.name}
            </span>
            <TeamLogo logo={fixture.homeTeam.logo} shortName={fixture.homeTeam.shortName} size={24} highlight={homeLead} />
          </div>
        </div>
      </div>
    </Link>
  );
}
