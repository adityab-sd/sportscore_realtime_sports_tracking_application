import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getGameDetail, getStandings, getCdnBoxscore, getCdnPlayByPlay, getTeam,
} from "@/lib/api/basketball";
import { periodLabel } from "@/types/basketball";
import TeamLogo from "@/components/football/TeamLogo";
import LineScoreTable from "@/components/basketball/LineScoreTable";
import ShotChart from "@/components/basketball/ShotChart";
import GameSidebar from "@/components/basketball/GameSidebar";
import BoxScore from "@/components/basketball/BoxScore";
import PlayByPlay from "@/components/basketball/PlayByPlay";
import ScoringPlays from "@/components/basketball/ScoringPlays";
import StandingsTable from "@/components/basketball/StandingsTable";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ league?: string }>;
}

export default async function GamePage({ params, searchParams }: Props) {
  const { id }             = await params;
  const { league = "nba" } = await searchParams;
  // ============================================================================
  // PLEASE review — validate dynamic route inputs
  // ----------------------------------------------------------------------------
  // id and league come straight from the URL. A typo or unsupported league still
  // fans out to every downstream fetch and can render links under the wrong
  // league namespace.
  //
  // EXAMPLE:
  //   const safeLeague = LEAGUES.some((l) => l.slug === league) ? league : "nba";
  //   if (!/^\d+$/.test(id)) return notFound();
  // ============================================================================

  const game = await getGameDetail(league, id);
  // PLEASE review — missing game correctly 404s [already correct — keep this]: dynamic game routes should not render a shell when the entity is absent. EXAMPLE: if (!game) return notFound();
  if (!game) return notFound();

  const isPost = game.statusState === "post";
  const isLive = game.statusState === "in";
  const hasScores = isPost || isLive;

  // ============================================================================
  // PLEASE review — optional side-panel fetches reject the whole page
  // ----------------------------------------------------------------------------
  // Once the game exists, standings, CDN boxscore/play-by-play, or team chrome are
  // additive data. Promise.all means one flaky optional feed prevents the primary
  // score header from rendering.
  //
  // EXAMPLE:
  //   const details = await Promise.allSettled([getCdnBoxscore(league, id), getCdnPlayByPlay(league, id)]);
  // ============================================================================
  const [standings, boxscoreRaw, pbpRaw, homeTeamInfo, awayTeamInfo] = await Promise.all([
    isPost ? getStandings(league) : Promise.resolve([]),
    hasScores ? getCdnBoxscore(league, id) : Promise.resolve(null),
    hasScores ? getCdnPlayByPlay(league, id) : Promise.resolve(null),
    getTeam(league, game.homeTeam.id),
    getTeam(league, game.awayTeam.id),
  ]);

  const homeWin = game.homeScore != null && game.awayScore != null && game.homeScore > game.awayScore;
  const awayWin = game.homeScore != null && game.awayScore != null && game.awayScore > game.homeScore;

  const homeColor = homeTeamInfo?.color ?? "#003F88";
  const awayColor = awayTeamInfo?.color ?? "#5C2D82";

  return (
    <div style={{ background: "var(--cloud)", minHeight: "100vh" }}>
      {/* ─── Score Header ─── */}
      <div style={{ background: "var(--white)", borderBottom: "1px solid var(--border)" }}>
        <div className="container" style={{ maxWidth: 1200, paddingTop: 12, paddingBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textAlign: "center", marginBottom: 8 }}>
            {game.competition}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "clamp(12px,4vw,32px)" }}>
            {/* Away team */}
            <Link href={`/basketball/team/${game.awayTeam.id}?league=${league}`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "clamp(8px,2vw,14px)", minWidth: 0 }}>
              <div className="desktop-only" style={{ textAlign: "right" }}>
                <div style={{ fontSize: "clamp(13px,2vw,16px)", fontWeight: awayWin ? 800 : 600, color: awayWin ? "var(--obsidian)" : "var(--text-secondary)" }}>{game.awayTeam.name}</div>
                {awayTeamInfo?.record && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{awayTeamInfo.record}</div>}
              </div>
              <TeamLogo logo={game.awayTeam.logo} shortName={game.awayTeam.shortName} size={44} highlight={awayWin} />
            </Link>

            {/* Score block */}
            <div style={{ display: "flex", alignItems: "center", gap: "clamp(8px,2vw,16px)", flexShrink: 0 }}>
              <span className="score-num" style={{ fontSize: "clamp(32px,6vw,48px)", color: awayWin ? "var(--obsidian)" : "var(--text-muted)" }}>{game.awayScore ?? "–"}</span>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 50 }}>
                {isLive ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4d4d" }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#dc2626" }}>
                      {periodLabel(game.period, league)}{game.clock ? ` ${game.clock}` : ""}
                    </span>
                  </div>
                ) : isPost ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>Final</span>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>vs</span>
                )}
              </div>

              <span className="score-num" style={{ fontSize: "clamp(32px,6vw,48px)", color: homeWin ? "var(--obsidian)" : "var(--text-muted)" }}>{game.homeScore ?? "–"}</span>
            </div>

            {/* Home team */}
            <Link href={`/basketball/team/${game.homeTeam.id}?league=${league}`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "clamp(8px,2vw,14px)", minWidth: 0 }}>
              <TeamLogo logo={game.homeTeam.logo} shortName={game.homeTeam.shortName} size={44} highlight={homeWin} />
              <div className="desktop-only">
                <div style={{ fontSize: "clamp(13px,2vw,16px)", fontWeight: homeWin ? 800 : 600, color: homeWin ? "var(--obsidian)" : "var(--text-secondary)" }}>{game.homeTeam.name}</div>
                {homeTeamInfo?.record && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{homeTeamInfo.record}</div>}
              </div>
            </Link>
          </div>

          {/* Line scores inline */}
          {game.lineScores?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <LineScoreTable game={game} league={league} />
            </div>
          )}
        </div>
      </div>

      {/* ─── Main Content: 3-column ─── */}
      <div className="container" style={{ maxWidth: 1200, paddingTop: 20, paddingBottom: 40 }}>
        <div className="game-layout">

          {/* LEFT SIDEBAR */}
          <aside className="game-sidebar-left">
            <GameSidebar game={game} />
          </aside>

          {/* CENTER COLUMN */}
          <div className="game-center">
            {/* Shot Chart */}
            {pbpRaw && (
              <ShotChart
                data={pbpRaw}
                homeTeamId={game.homeTeam.id}
                awayTeamId={game.awayTeam.id}
                homeColor={homeColor}
                awayColor={awayColor}
                homeShort={game.homeTeam.shortName}
                awayShort={game.awayTeam.shortName}
              />
            )}

            {/* Boxscore */}
            {boxscoreRaw && (
              <div style={{ marginTop: 16 }}>
                <BoxScore data={boxscoreRaw} />
              </div>
            )}

            {/* Scoring Plays */}
            {game.events?.length > 0 && (
              <details style={{ marginTop: 16 }}>
                <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, color: "var(--obsidian)", background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Scoring Plays</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{game.events.length} plays · tap to expand</span>
                </summary>
                <div style={{ marginTop: 4 }}>
                  <ScoringPlays events={game.events} homeTeam={game.homeTeam} awayTeam={game.awayTeam} />
                </div>
              </details>
            )}

            {/* Play-by-Play */}
            {pbpRaw && (
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, color: "var(--obsidian)", background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Full Play-by-Play</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>tap to expand</span>
                </summary>
                <div style={{ marginTop: 4 }}>
                  <PlayByPlay data={pbpRaw} />
                </div>
              </details>
            )}

            {/* Pre-game */}
            {game.statusState === "pre" && (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
                <p style={{ fontSize: 15, margin: "0 0 4px", fontWeight: 600, color: "var(--text-secondary)" }}>Game not started yet</p>
                <p style={{ fontSize: 13, margin: 0 }}>Check back at tipoff for live updates, shot chart, and boxscore.</p>
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR — Standings */}
          <aside className="game-sidebar-right">
            {isPost && standings.length > 0 && (
              <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "var(--obsidian)", letterSpacing: "-0.2px" }}>STANDINGS</span>
                  <Link href={`/basketball/standings?league=${league}`} style={{ fontSize: 11, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>Full →</Link>
                </div>
                <CompactStandings rows={standings} homeId={game.homeTeam.id} awayId={game.awayTeam.id} league={league} />
              </div>
            )}

            {/* Back nav */}
            <div style={{ marginTop: 12 }}>
              <Link href="/basketball" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "10px 14px", borderRadius: 10, textDecoration: "none", textAlign: "center" }}>
                ← All Basketball
              </Link>
            </div>
          </aside>
        </div>
      </div>

      {/* Scoped layout styles */}
      <style>{`
        .game-layout {
          display: grid;
          grid-template-columns: 260px 1fr 240px;
          grid-template-areas: "left center right";
          gap: 20px;
          align-items: start;
        }
        .game-sidebar-left  { grid-area: left; }
        .game-center        { grid-area: center; }
        .game-sidebar-right { grid-area: right; }

        @media (max-width: 1024px) {
          .game-layout {
            grid-template-columns: 1fr 240px;
            grid-template-areas:
              "center right"
              "left right";
          }
        }
        @media (max-width: 768px) {
          .game-layout {
            grid-template-columns: 1fr;
            grid-template-areas:
              "center"
              "left"
              "right";
          }
        }

        details summary::-webkit-details-marker { display: none; }
        details[open] summary { border-radius: 12px 12px 0 0; margin-bottom: 0; }
      `}</style>
    </div>
  );
}

/* ─── Compact Standings for sidebar ─── */

import type { BBStandingRow } from "@/lib/api/basketball";

function CompactStandings({
  rows, homeId, awayId, league,
}: {
  rows: BBStandingRow[];
  homeId: string;
  awayId: string;
  league: string;
}) {
  const shown = rows.slice(0, 15);

  return (
    <div style={{ fontSize: 11 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 28px 28px 44px 32px", padding: "6px 14px", borderBottom: "1px solid var(--border)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", fontSize: 9 }}>
        <span>Team</span>
        <span style={{ textAlign: "center" }}>W</span>
        <span style={{ textAlign: "center" }}>L</span>
        <span style={{ textAlign: "center" }}>PCT</span>
        <span style={{ textAlign: "center" }}>STK</span>
      </div>
      {/* PLEASE review — index fallback weakens identity: team ids should be required for standings links; key={r.teamId || i} can hide missing ids and collide across leagues. EXAMPLE: if (!r.teamId) return null; return <Link key={`${league}:${r.teamId}`} href={`/basketball/team/${r.teamId}?league=${league}`}>...</Link>. */}
      {shown.map((r, i) => {
        const hl = r.teamId === homeId || r.teamId === awayId;
        return (
          <Link key={r.teamId || i} href={`/basketball/team/${r.teamId}?league=${league}`} style={{ textDecoration: "none" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 28px 28px 44px 32px",
              padding: "5px 14px",
              borderBottom: i < shown.length - 1 ? "1px solid var(--border)" : "none",
              background: hl ? "rgba(0,63,136,0.04)" : "transparent",
              fontWeight: hl ? 700 : 400,
              color: hl ? "var(--obsidian)" : "var(--text-secondary)",
              alignItems: "center",
            }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {hl && <span style={{ display: "inline-block", width: 3, height: 10, borderRadius: 2, background: "var(--navy)", marginRight: 5, verticalAlign: "middle" }} />}
                {r.shortName || r.team}
              </span>
              <span className="stat-num" style={{ textAlign: "center" }}>{r.wins}</span>
              <span className="stat-num" style={{ textAlign: "center" }}>{r.losses}</span>
              <span className="stat-num" style={{ textAlign: "center" }}>{r.winPct != null ? r.winPct.toFixed(3).replace(/^0/, "") : "–"}</span>
              <span className="stat-num" style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: r.streak?.startsWith("W") ? "var(--success)" : r.streak?.startsWith("L") ? "#dc2626" : "inherit" }}>
                {r.streak ?? "–"}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}