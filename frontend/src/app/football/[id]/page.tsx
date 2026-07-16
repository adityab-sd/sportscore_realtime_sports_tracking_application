import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchDetail, getRoster, getStandings } from "@/lib/api/espn";
import StandingsTable from "@/components/football/StandingsTable";
import TeamLogo from "@/components/football/TeamLogo";
import MatchDetailLive from "@/components/football/MatchDetailLive";
import MatchLineupSection from "@/components/football/MatchLineupSection";
import MatchSquadsPreview from "@/components/football/MatchSquadsPreview";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ league?: string }>;
}

function EventIcon({ type, detail }: { type: string; detail: string }) {
  const d = detail.toLowerCase();
  if (type === "goal" || d.includes("goal")) return (
    <svg viewBox="0 0 64 64" width="18" height="18" fill="#0b1220" aria-hidden="true">
      <path d="M61.934 31.992c.021-.713.209-10.904-5.822-17.538c-.268-.593-1.539-2.983-5.641-5.904a41.959 41.959 0 0 0-5.775-3.763l-.008-.004C44.432 4.646 39.43 2 33.359 2c-.461 0-.917.027-1.368.058V2.05c-4.629-.101-9.227 1.09-11.998 2.341c-2.458 1.11-5.187 2.971-5.384 3.115C11.205 9.41 4.75 17.051 4.239 21.1c-2.063 2.637-3.787 14.482.004 21.697c2.658 10.027 12.664 15.045 13.46 15.43c.484.309 5.937 3.68 12.636 3.68c.281 0 1.98.094 2.586.094c7.241 0 17.971-5.104 20.217-9.102c6.171-4.514 9.37-16.147 8.792-20.907M17.758 47.055c-2.869-4.641-4.504-10.705-4.854-12.098c.908-1.361 5.387-7.965 7.939-9.952c1.445.266 7.479 1.374 13.17 2.404c.715 1.853 3.852 10.029 4.75 13.185c-.99 1.174-4.879 5.702-8.708 9.248c-4.065.019-10.979-2.326-12.297-2.787M53.824 14.58c-.012.45-.119 2.05-.885 3.887c-1.521-.777-5.344-2.441-10.584-2.722c-.793-1.171-3.777-5.254-8.49-8.086c.645-1.262 1.543-2.801 2.068-3.27c.17-.048.434-.092.836-.092c2.527 0 6.893 1.655 7.273 1.802c.403.213 8.251 4.439 9.782 8.481M11.773 34.012c-3.423-.584-5.458-1.648-6.066-2.008c-1.273-4.617-.248-9.607-.09-10.322c1.256-2.246 4.832-7.971 7.191-9.058c2.445-.499 5.494.121 6.736.424c-.117 1.615-.342 6.127.326 10.862c-2.706 2.178-6.989 8.447-8.097 10.102M31.685 3.53c.768.057 1.895.225 2.667.454c-.77 1.024-1.559 2.542-1.932 3.292c-1.57.257-7.533 1.397-12.211 4.43c-.943-.25-3.791-.917-6.488-.687c.668-1.293 1.666-2.249 1.773-2.347c.371-.266 7.513-5.263 16.191-5.155v.013m19.096 38.093c-1.17-.048-5.678-.305-10.621-1.466c-.947-3.302-4.074-11.444-4.789-13.296a556.586 556.586 0 0 1 6.928-9.654c5.688.312 9.682 2.387 10.455 2.82c3.295 5.299 4.018 10.711 4.117 11.615c-1.75 5.446-5.211 9.113-6.09 9.981M3.655 28.519c.084 1.266.287 2.599.654 3.917a11.738 11.738 0 0 0-.682 2.651a33.039 33.039 0 0 1 .028-6.568m9.644 23.359c1.508-1.453 3.367-2.867 4.088-3.401c1.63.574 8.324 2.837 12.591 2.837c.727.975 3.104 4.028 6.018 6.362c-1.814 1.775-4.434 2.613-4.897 2.752c-8.127.218-16.042-4.35-17.8-8.55m21.463 8.538c.922-.537 1.883-1.244 2.678-2.139c1.297-.179 6.863-1.137 11.893-4.832c.332.036.879.08 1.49.063c-3.018 2.957-10.382 6.26-16.061 6.908m15.424-8.376c1.807-4.708 1.73-8.258 1.641-9.392c.992-.972 4.396-4.599 6.285-10.113c1.018.17 1.68.429 1.994.574c.109.4.291 1.324.188 2.725c-.77 5.043-3.428 12.6-8.084 15.941c-.468.239-1.292.291-2.024.265" />
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

  // For upcoming matches we show squads rather than lineups (which don't exist yet).
  const isPre = match.statusState === "pre";
  const [homeRoster, awayRoster] = isPre
    ? await Promise.all([
        getRoster(league, match.homeTeam.id),
        getRoster(league, match.awayTeam.id),
      ])
    : [[], []];

  const isPost = match.statusState === "post";
  const standings = isPost ? await getStandings(league) : [];
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
        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 20 }}>
          <Link
            href={`/football/league/${league}`}
            style={{ color: "var(--navy)", textDecoration: "none", fontWeight: 600 }}
          >
            {match.competition}
          </Link>
          {match.venue && <span> · {match.venue}</span>}
        </div>

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
            {isLive ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4d4d" }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>{match.status}</span>
                </div>
                {match.kickoff && (
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }} suppressHydrationWarning>
                    {new Date(match.kickoff).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
            ) : match.statusState === "post" ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>Full Time</span>
                {match.kickoff && (
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }} suppressHydrationWarning>
                    {new Date(match.kickoff).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
              </div>
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

      {isLive && <MatchDetailLive id={Number(id)} />}

      {/* Match events */}
      {!isLive && match.events.length > 0 && (
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 16 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
            Match Events
          </div>
          <div style={{ padding: "8px 0" }}>
            {[...match.events].sort((a,b) => b.minute - a.minute).map((e, i) => {
              const isHome = e.teamId === match.homeTeam.id;
              const teamLineup = (match.lineups ?? []).find(l => l.teamId === e.teamId);
              const allTeamPlayers = teamLineup ? [...teamLineup.starters, ...teamLineup.bench] : [];
              const matchedPlayer = e.player
                ? allTeamPlayers.find(p => p.name === e.player)
                : undefined;

              const nameContent = e.player ?? "Unknown";
              const nameNode = matchedPlayer ? (
                <Link
                  href={`/football/player/${matchedPlayer.id}?league=${league}&team=${e.teamId}`}
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", textDecoration: "none" }}
                >
                  {nameContent}
                </Link>
              ) : (
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)" }}>{nameContent}</span>
              );

              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 18px", flexDirection: isHome ? "row" : "row-reverse" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", minWidth: 28, textAlign: "center" }}>{e.minute}&apos;</span>
                  <EventIcon type={e.type} detail={e.detail} />
                  <div style={{ flex: 1, textAlign: isHome ? "left" : "right" }}>
                    <div>{nameNode}</div>
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

      {!isLive && !isPre && match.events.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>
          No events recorded for this match.
        </p>
      )}

      {/* Lineups (after events) — pitch view for live/finished, squads for upcoming */}
      {isPre ? (
        <MatchSquadsPreview
          homeTeam={match.homeTeam}
          awayTeam={match.awayTeam}
          homeRoster={homeRoster}
          awayRoster={awayRoster}
          league={league}
        />
      ) : (
        <MatchLineupSection
          lineups={match.lineups ?? []}
          events={match.events}
          homeTeam={match.homeTeam}
          awayTeam={match.awayTeam}
          league={league}
        />
      )}
      {/* League standings — shown after finished matches */}
      {isPost && standings.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 12,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: "var(--text-muted)",
              textTransform: "uppercase", letterSpacing: "0.8px",
            }}>
              League Standings
            </div>
            <Link
              href={`/football/league/${league}`}
              style={{ fontSize: 12, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}
            >
              Full table →
            </Link>
          </div>
          <StandingsTable
            rows={standings}
            league={league}
            highlightTeamIds={[match.homeTeam.id, match.awayTeam.id]}
          />
        </div>
      )}
    </div>
  );
}