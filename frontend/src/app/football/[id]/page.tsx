import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchDetail } from "@/lib/api/espn";
import TeamLogo from "@/components/football/TeamLogo";
import MatchDetailLive from "@/components/football/MatchDetailLive";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ league?: string }>;
}

function EventIcon({ type, detail }: { type: string; detail: string }) {
  const d = detail.toLowerCase();
  if (type === "goal" || d.includes("goal")) return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--obsidian)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7l2.9 2.1-1.1 3.4h-3.6l-1.1-3.4z" fill="var(--obsidian)" stroke="none" />
    </svg>
  );
  if (d.includes("yellow")) return <svg width="14" height="14" viewBox="0 0 24 24"><rect x="6" y="3" width="11" height="18" rx="2" transform="rotate(8 12 12)" fill="#F5B500" /></svg>;
  if (d.includes("red"))    return <svg width="14" height="14" viewBox="0 0 24 24"><rect x="6" y="3" width="11" height="18" rx="2" transform="rotate(8 12 12)" fill="#DC2626" /></svg>;
  return null;
}

export default async function MatchPage({ params, searchParams }: Props) {
  const { id }             = await params;
  const { league = "eng.1" } = await searchParams;

  const match = await getMatchDetail(league, id);
  if (!match) return notFound();

  const homeWin = match.homeScore != null && match.awayScore != null && match.homeScore > match.awayScore;
  const awayWin = match.homeScore != null && match.awayScore != null && match.awayScore > match.homeScore;
  const isLive  = match.statusState === "in";

  return (
    <div className="container" style={{ maxWidth: 720, paddingTop: 24, paddingBottom: 40 }}>
      <Link href="/football" style={{ display: "inline-block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none", marginBottom: 20, padding: "6px 10px", borderRadius: 7, background: "var(--cloud)" }}>
        ← Football
      </Link>

      {/* Score header */}
      <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: "clamp(20px,4vw,32px) clamp(16px,4vw,28px)", textAlign: "center", marginBottom: 16 }}>
        {/* Competition */}
        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 20 }}>
          {match.competition}
          {match.venue && <span> · {match.venue}</span>}
        </div>

        {/* Teams + score */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "clamp(8px,3vw,16px)" }}>
          <Link href={`/football/team/${match.homeTeam.id}?league=${league}`} style={{ flex: 1, textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, minWidth: 0 }}>
            <TeamLogo logo={match.homeTeam.logo} shortName={match.homeTeam.shortName} size={56} highlight={homeWin} />
            <span style={{ fontSize: "clamp(13px,2.5vw,15px)", fontWeight: homeWin ? 700 : 600, color: homeWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
              {match.homeTeam.name}
            </span>
          </Link>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, minWidth: "clamp(90px,20vw,130px)", flexShrink: 0 }}>
            <div className="score-num" style={{ fontSize: "clamp(38px,8vw,56px)", lineHeight: 1, display: "flex", alignItems: "center", gap: "clamp(6px,2vw,12px)" }}>
              <span style={{ color: homeWin ? "var(--obsidian)" : "var(--text-muted)" }}>{match.homeScore ?? "–"}</span>
              <span style={{ color: "var(--border)", fontSize: "clamp(28px,5vw,38px)" }}>:</span>
              <span style={{ color: awayWin ? "var(--obsidian)" : "var(--text-muted)" }}>{match.awayScore ?? "–"}</span>
            </div>
            {/* Status */}
            {isLive ? (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4d4d" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>{match.status}</span>
              </div>
            ) : match.statusState === "post" ? (
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>Full Time</span>
            ) : (
              <span style={{ fontSize: 13, color: "var(--text-muted)" }} suppressHydrationWarning>
                {match.kickoff ? new Date(match.kickoff).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Scheduled"}
              </span>
            )}
          </div>

          <Link href={`/football/team/${match.awayTeam.id}?league=${league}`} style={{ flex: 1, textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, minWidth: 0 }}>
            <TeamLogo logo={match.awayTeam.logo} shortName={match.awayTeam.shortName} size={56} highlight={awayWin} />
            <span style={{ fontSize: "clamp(13px,2.5vw,15px)", fontWeight: awayWin ? 700 : 600, color: awayWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
              {match.awayTeam.name}
            </span>
          </Link>
        </div>
      </div>

      {/* If live, show real-time events from SignalR on top */}
      {isLive && <MatchDetailLive id={Number(id)} />}

      {/* Events from ESPN (goals + cards) */}
      {match.events.length > 0 && (
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
            Match Events
          </div>
          <div style={{ padding: "8px 0" }}>
            {[...match.events].sort((a,b) => b.minute - a.minute).map((e, i) => {
              const isHome = e.teamId === match.homeTeam.id;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 18px", flexDirection: isHome ? "row" : "row-reverse" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", minWidth: 28, textAlign: "center" }}>{e.minute}&apos;</span>
                  <EventIcon type={e.type} detail={e.detail} />
                  <div style={{ flex: 1, textAlign: isHome ? "left" : "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)" }}>
                      {e.player ?? "Unknown"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                      {e.detail}
                      {e.assist && ` · Assist: ${e.assist}`}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", background: "var(--cloud)", padding: "2px 6px", borderRadius: 4 }}>
                    {isHome ? match.homeTeam.shortName : match.awayTeam.shortName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {match.events.length === 0 && match.statusState !== "pre" && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>No events recorded for this match.</p>
      )}

      {match.statusState === "pre" && (
        <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
          <p style={{ fontSize: 14, margin: "0 0 4px", fontWeight: 600, color: "var(--text-secondary)" }}>Match not started yet</p>
          <p style={{ fontSize: 13, margin: 0 }}>Check back when the match kicks off.</p>
        </div>
      )}
    </div>
  );
}