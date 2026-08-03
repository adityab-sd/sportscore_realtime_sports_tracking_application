"use client";
import { useCallback } from "react";
import { getMatchDetail, type ESPNMatchDetail } from "@/lib/api/espn";
import { useLiveMatchDetail } from "@/hooks/useLiveMatchDetail";
import { classifyStatus } from "@/types/football";
import { toUnifiedMatch } from "@/lib/adaptMatch";
import { adaptPlays } from "@/lib/adaptPlays";
import ScoreHeader from "./ScoreHeader";
import ScoreSubBar from "./ScoreSubBar";
import MatchDetailLive from "./MatchDetailLive";
import MatchTabs from "./MatchTabs";
import MatchLeaders from "./MatchLeaders";
import CommentaryTab from "./CommentaryTab";
import LastFiveForm from "./LastFiveForm";
import MatchStatsComparison from "./MatchStatsComparison";
import MomentumChart from "./MomentumChart";

/**
 * MatchLiveSection — the ONE live owner of the match-detail middle column.
 *
 * A single 30s REST poll lives here. Its fresh data rebuilds the unified match
 * (with `elapsed` derived from the status string) and feeds BOTH the ScoreHeader
 * and the tabbed detail below. One poll, one source of truth.
 *
 * COST: 0 SignalR messages — pure REST polling, only while live.
 */
export default function MatchLiveSection({
  initialDetail,
  league,
  venue,
  competitionHref,
}: {
  initialDetail: ESPNMatchDetail;
  league: string;
  venue?: string | null;
  competitionHref?: string;
}) {
  const fetcher = useCallback(
    async (id: number): Promise<ESPNMatchDetail> => {
      const fresh = await getMatchDetail(league, String(id));
      if (!fresh) throw new Error("match detail unavailable");
      return fresh;
    },
    [league]
  );

  const { data, live, lastUpdated, isFetching } = useLiveMatchDetail<ESPNMatchDetail>(
    Number(initialDetail.id),
    initialDetail,
    fetcher,
    30_000
  );

  // ---- Everything below is INSIDE the component, so data/unified exist. ----
  const unified = toUnifiedMatch(data);

  // Guard: if the adapter couldn't build a valid match (e.g. first render with
  // incomplete data), don't crash — just render the header with what we have.
  if (!unified || !unified.homeTeam || !unified.awayTeam) {
    return (
      <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: "40px 0" }}>
        Loading match details…
      </div>
    );
  }

  const plays = adaptPlays(data, unified);

  // The new summary sections (leaders, teamStats, xg, form). Present once the
  // backend forwards a `summary` object; until then components show empty states.
  const summary = (data as any).summary ?? {};

  const homeShort = unified.homeTeam.shortName;
  const awayShort = unified.awayTeam.shortName;

  const detailVisible =
    data.statusState === "in" ||
    data.statusState === "post" ||
    live ||
    classifyStatus(data.status) === "finished";

  // Which tabs have data? Hide tabs that would be empty.
  const hasTeamStats =
    (summary.teamStats?.length ?? 0) > 0 ||
    (summary.homeForm?.length ?? 0) > 0 ||
    (summary.awayForm?.length ?? 0) > 0;
  const hasPlayerStats = (summary.leaders?.length ?? 0) > 0;
  const hasCommentary =
    plays.some((p) => p.text?.trim().length > 0) ||
    (unified.events?.length ?? 0) > 0;

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <ScoreHeader
          match={unified}
          league={league}
          venue={venue}
          competitionHref={competitionHref}
          compact
        />
        <ScoreSubBar match={unified} />
      </div>

      {detailVisible && (
        <MatchTabs
          teamStatsEnabled={hasTeamStats}
          playerStatsEnabled={hasPlayerStats}
          commentaryEnabled={hasCommentary}
          gamecast={
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <MatchDetailLive
                match={unified}
                detail={data}
                league={league}
                live={live}
                lastUpdated={lastUpdated}
                isFetching={isFetching}
              />
              <MomentumChart
                momentum={summary.momentum}
                plays={plays}
                homeShort={homeShort}
                awayShort={awayShort}
              />
            </div>
          }
          teamStats={
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Your MatchStatsComparison takes ESPN category arrays (home/away).
                  These come from the summary/boxscore the backend will forward;
                  until then pass [] so it renders nothing rather than crashing. */}
              <MatchStatsComparison
                home={summary.statsHome ?? []}
                away={summary.statsAway ?? []}
                homeTeam={unified.homeTeam}
                awayTeam={unified.awayTeam}
              />
              <LastFiveForm
                homeShort={homeShort}
                awayShort={awayShort}
                homeForm={summary.homeForm}
                awayForm={summary.awayForm}
              />
            </div>
          }
          playerStats={<MatchLeaders leaders={summary.leaders} league={league} />}
          commentary={
            <CommentaryTab
              plays={plays}
              events={unified.events}
              homeShort={homeShort}
              awayShort={awayShort}
              homeLogo={unified.homeTeam.logo}
              awayLogo={unified.awayTeam.logo}
            />
          }
        />
      )}
    </>
  );
}