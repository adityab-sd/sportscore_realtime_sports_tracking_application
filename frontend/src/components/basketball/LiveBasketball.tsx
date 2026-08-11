"use client";
import LiveSportSection, { type LiveSportConfig } from "@/components/ui/LiveSportSection";
import { BBGame, getFixturesByDate } from "@/lib/api/basketball";
import { classifyStatus, leagueName, LEAGUES } from "@/types/basketball";
import MatchCard from "./MatchCard";
import LeagueBanner from "./LeagueBanner";

const slugOf = (g: BBGame) => g._slug ?? "nba";

const config: LiveSportConfig<BBGame> = {
  leagues: LEAGUES,
  fetchDay: (slug, ymd) =>
    getFixturesByDate(slug, ymd).then(fx => [...fx.results, ...fx.upcoming].map(g => ({ ...g, _slug: slug }))),
  getId: g => g.id,
  getState: g => classifyStatus(g.statusState),
  getDateIso: g => g.tipoff,
  groupKeyOf: slugOf,
  groupNameOf: g => leagueName(slugOf(g)) || g.competition,
  groupHrefOf: g => `/basketball/league/${slugOf(g)}`,
  renderGroupBanner: g => <LeagueBanner name={leagueName(slugOf(g)) || g.competition} slug={slugOf(g)} />,
  renderCard: g => <MatchCard game={g} leagueSlug={g._slug} />,
  emptyIcon: "🏀",
  emptyNoun: "games",
};

export default function LiveBasketball({ seed = [] }: { seed?: BBGame[] }) {
  return <LiveSportSection config={config} seed={seed} />;
}
