"use client";
import { useCallback } from "react";
import { getMatchDetail, type ESPNMatchDetail } from "@/lib/api/espn";
import { useLiveMatchDetail } from "@/hooks/useLiveMatchDetail";
import { classifyStatus } from "@/types/football";
import { toUnifiedMatch } from "@/lib/adaptMatch";
import { adaptPlays } from "@/lib/adaptPlays";
import ScoreHeader from "./ScoreHeader";
import MatchDetailLive from "./MatchDetailLive";
import MatchTabs from "./MatchTabs";
import MatchLeaders from "./MatchLeaders";
import CommentaryTab from "./CommentaryTab";
import LastFiveForm from "./LastFiveForm";
import MatchStatsComparison from "./MatchStatsComparison";

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
      </div>

      {detailVisible && (
        <MatchTabs
          gamecast={
            <MatchDetailLive
              match={unified}
              detail={data}
              league={league}
              live={live}
              lastUpdated={lastUpdated}
              isFetching={isFetching}
            />
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