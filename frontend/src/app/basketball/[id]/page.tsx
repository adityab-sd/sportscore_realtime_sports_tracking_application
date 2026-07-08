import Link from "next/link";
import { notFound } from "next/navigation";
import { getGameDetail } from "@/lib/api/basketball";
import { periodLabel } from "@/types/basketball";
import TeamLogo from "@/components/football/TeamLogo";
import LineScoreTable from "@/components/basketball/LineScoreTable";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ league?: string }>;
}

export default async function GamePage({ params, searchParams }: Props) {
  const { id }             = await params;
  const { league = "nba" } = await searchParams;

  const game = await getGameDetail(league, id);
  if (!game) return notFound();

  const homeWin = game.homeScore != null && game.awayScore != null && game.homeScore > game.awayScore;
  const awayWin = game.homeScore != null && game.awayScore != null && game.awayScore > game.homeScore;
  const isLive  = game.statusState === "in";

  return (
    <div className="container" style={{ maxWidth: 720, paddingTop: 24, paddingBottom: 40 }}>
      <Link href="/basketball" style={{ display: "inline-block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none", marginBottom: 20, padding: "6px 10px", borderRadius: 7, background: "var(--cloud)" }}>
        ← Basketball
      </Link>

      {/* Score header */}
      <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: "clamp(20px,4vw,32px) clamp(16px,4vw,28px)", textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 20 }}>
          {game.competition}
          {game.venue && <span> · {game.venue}</span>}
          {game.attendance != null && <span> · {game.attendance.toLocaleString()} fans</span>}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "clamp(8px,3vw,16px)" }}>
          <Link href={`/basketball/team/${game.homeTeam.id}?league=${league}`} style={{ flex: 1, textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, minWidth: 0 }}>
            <TeamLogo logo={game.homeTeam.logo} shortName={game.homeTeam.shortName} size={56} highlight={homeWin} />
            <span style={{ fontSize: "clamp(13px,2.5vw,15px)", fontWeight: homeWin ? 700 : 600, color: homeWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
              {game.homeTeam.name}
            </span>
          </Link>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, minWidth: "clamp(90px,20vw,130px)", flexShrink: 0 }}>
            <div className="score-num" style={{ fontSize: "clamp(38px,8vw,56px)", lineHeight: 1, display: "flex", alignItems: "center", gap: "clamp(6px,2vw,12px)" }}>
              <span style={{ color: homeWin ? "var(--obsidian)" : "var(--text-muted)" }}>{game.homeScore ?? "–"}</span>
              <span style={{ color: "var(--border)", fontSize: "clamp(28px,5vw,38px)" }}>:</span>
              <span style={{ color: awayWin ? "var(--obsidian)" : "var(--text-muted)" }}>{game.awayScore ?? "–"}</span>
            </div>
            {isLive ? (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4d4d" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>
                  {periodLabel(game.period, league)}{game.clock ? ` ${game.clock}` : ""}
                </span>
              </div>
            ) : game.statusState === "post" ? (
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>Final</span>
            ) : (
              <span style={{ fontSize: 13, color: "var(--text-muted)" }} suppressHydrationWarning>
                {game.tipoff ? new Date(game.tipoff).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Scheduled"}
              </span>
            )}
          </div>

          <Link href={`/basketball/team/${game.awayTeam.id}?league=${league}`} style={{ flex: 1, textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, minWidth: 0 }}>
            <TeamLogo logo={game.awayTeam.logo} shortName={game.awayTeam.shortName} size={56} highlight={awayWin} />
            <span style={{ fontSize: "clamp(13px,2.5vw,15px)", fontWeight: awayWin ? 700 : 600, color: awayWin ? "var(--obsidian)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
              {game.awayTeam.name}
            </span>
          </Link>
        </div>
      </div>

      {/* Line scores */}
      {game.lineScores && game.lineScores.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <LineScoreTable game={game} league={league} />
        </div>
      )}

      {game.statusState === "pre" && (
        <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
          <p style={{ fontSize: 14, margin: "0 0 4px", fontWeight: 600, color: "var(--text-secondary)" }}>Game not started yet</p>
          <p style={{ fontSize: 13, margin: 0 }}>Check back at tipoff.</p>
        </div>
      )}
    </div>
  );
}