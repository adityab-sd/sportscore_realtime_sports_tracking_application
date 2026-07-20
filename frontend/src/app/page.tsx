import LiveTicker from "@/components/ui/LiveTicker";
import NewsCarousel from "@/components/news/NewsCarousel";
import NewsCard from "@/components/news/NewsCard";
import AllSportsLiveStrip, { type UpcomingFixture } from "@/components/home/AllSportsLiveStrip";
import MultiSportNews from "@/components/home/MultiSportNews";
import { getNews as getFootballNews, getFixtures as getFootballFixtures } from "@/lib/api/espn";
import { getNews as getBasketballNews, getFixtures as getBasketballFixtures, BBNews } from "@/lib/api/basketball";
import { ESPNNews } from "@/lib/api/espn";
import HeroStrip from "@/components/home/HeroStrip";
import HeroSplit from "@/components/landing/HeroSplit";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Fetch news from all active sports and merge into a single carousel feed.
// Add a new sport here when its backend news endpoint is ready.
// ─────────────────────────────────────────────────────────────────────────────
async function getCarouselNews(): Promise<(ESPNNews | BBNews)[]> {
  const [footballNews, basketballNews] = await Promise.allSettled([
    getFootballNews("eng.1", 8),
    getBasketballNews("nba", 8),
    // getBaseballNews("mlb", 8),  ← add future sports here
  ]);

  const seen = new Set<string>();
  const all: (ESPNNews | BBNews)[] = [];

  const append = (items: (ESPNNews | BBNews)[]) => {
    for (const a of items) {
      if (!seen.has(a.id)) { seen.add(a.id); all.push(a); }
    }
  };

  if (footballNews.status   === "fulfilled") append(footballNews.value);
  if (basketballNews.status === "fulfilled") append(basketballNews.value);

  // Interleave by date so carousel feels multi-sport rather than football-first
  return all
    .sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime())
    .slice(0, 8);
}

// ============================================================================
// PLEASE review — preserve article sport when merging feeds
// ----------------------------------------------------------------------------
// getCarouselNews returns a mixed football/basketball list, but HomePage later
// renders every carousel and side-card link with sport="football". Basketball
// stories will navigate to /football/news/[id], which breaks cross-sport news.
//
// EXAMPLE:
//   type CarouselArticle = (ESPNNews | BBNews) & { sport: "football" | "basketball" };
//   append(footballNews.value.map((a) => ({ ...a, sport: "football" })));
//   <NewsCarousel articles={mainArticles} />
// ============================================================================
// ─────────────────────────────────────────────────────────────────────────────
// Fetch a handful of upcoming (not-yet-started) fixtures per sport, sorted by
// date, for the "no live matches right now" fallback in AllSportsLiveStrip.
//
// Only sports with a real REST fixtures source are wired in below (football,
// basketball). Baseball and F1 are still "Coming Soon" placeholders in this
// project (see app/baseball/page.tsx, app/f1/page.tsx) — once either gets a
// real fixtures endpoint, add it here the same way and AllSportsLiveStrip
// picks it up automatically (it only renders sports present in this map).
// ─────────────────────────────────────────────────────────────────────────────
const UPCOMING_PER_SPORT = 5;
const FOOTBALL_UPCOMING_LEAGUES = ["fifa.world", "eng.1", "esp.1", "ger.1", "ita.1", "fra.1", "uefa.champions"];
const BASKETBALL_UPCOMING_LEAGUES = ["nba", "wnba"];

async function getUpcomingBySport(): Promise<Record<string, UpcomingFixture[]>> {
  const [footballSettled, basketballSettled] = await Promise.all([
    Promise.allSettled(FOOTBALL_UPCOMING_LEAGUES.map((slug) => getFootballFixtures(slug))),
    Promise.allSettled(BASKETBALL_UPCOMING_LEAGUES.map((slug) => getBasketballFixtures(slug))),
  ]);

  const football: UpcomingFixture[] = [];
  footballSettled.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const slug = FOOTBALL_UPCOMING_LEAGUES[i];
    for (const f of r.value.upcoming) {
      football.push({
        id: f.id,
        dateISO: f.kickoff,
        competition: f.competition,
        home: { name: f.homeTeam.name, shortName: f.homeTeam.shortName, logo: f.homeTeam.logo },
        away: { name: f.awayTeam.name, shortName: f.awayTeam.shortName, logo: f.awayTeam.logo },
        href: `/football/${f.id}?league=${slug}`,
      });
    }
  });

  const basketball: UpcomingFixture[] = [];
  basketballSettled.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const slug = BASKETBALL_UPCOMING_LEAGUES[i];
    for (const f of r.value.upcoming) {
      basketball.push({
        id: f.id,
        dateISO: f.tipoff,
        competition: f.competition,
        home: { name: f.homeTeam.name, shortName: f.homeTeam.shortName, logo: f.homeTeam.logo },
        away: { name: f.awayTeam.name, shortName: f.awayTeam.shortName, logo: f.awayTeam.logo },
        href: `/basketball/${f.id}?league=${slug}`,
      });
    }
  });

  // Earliest kickoff first within each sport; fixtures with no confirmed
  // date yet sort to the end rather than the front.
  const byDateAsc = (a: UpcomingFixture, b: UpcomingFixture) => {
    if (!a.dateISO && !b.dateISO) return 0;
    if (!a.dateISO) return 1;
    if (!b.dateISO) return -1;
    return new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime();
  };

  const bySport: Record<string, UpcomingFixture[]> = {};
  if (football.length > 0) bySport.football = football.sort(byDateAsc).slice(0, UPCOMING_PER_SPORT);
  if (basketball.length > 0) bySport.basketball = basketball.sort(byDateAsc).slice(0, UPCOMING_PER_SPORT);

  return bySport;
}

export default async function HomePage() {
  const [carouselNews, upcomingBySport] = await Promise.all([
    getCarouselNews(),
    getUpcomingBySport(),
  ]);

  // Reserve up to 2 articles for the side cards, but never at the expense of
  // leaving the main carousel with nothing (or fewer than 2 slides) to show —
  // the split shrinks gracefully as the total article count drops.
  //
  // Capped at 2 (not 3): the carousel stretches to match the side stack's
  // natural height (see the height:100% note in NewsCarousel.tsx and the
  // comment on the grid below) — with 3 full cards that stack got tall
  // enough to push the carousel across more than a full page. 2 keeps it
  // close to the carousel's original, reasonable proportions.
  const sideCount = Math.min(2, Math.max(0, carouselNews.length - 2));
  const sideArticles = sideCount > 0 ? carouselNews.slice(-sideCount) : [];
  const mainArticles = carouselNews.slice(0, carouselNews.length - sideCount);

  return (
    <div>
      {/* ── Full-bleed split-screen hero — mounted first so it sits flush
             against the fixed Navbar (it applies its own mt-14 offset and
             fills calc(100vh - 56px) internally). ─────────────────────── */}
      <HeroSplit />

      {/* ── Live scores ticker bar ─────────────────────────────────────── */}
      <LiveTicker />

      {/* ── Live score section — falls back to a few upcoming matches per
             sport, sorted by date, when nothing is live right now ───────── */}
      <div style={{ borderBottom: "1px solid var(--border)" }}>
        <AllSportsLiveStrip upcomingBySport={upcomingBySport} />
      </div>

      {/* ── Top stories: big carousel + up to 2 boxed cards alongside ───── */}
      {mainArticles.length > 0 && (
        <section style={{
          background: "var(--cloud)",
          borderBottom: "1px solid var(--border)",
          paddingTop: 28,
          paddingBottom: 32,
        }}>
          <div className="container">
            <div className="section-label" style={{ marginBottom: 14 }}>Top Stories</div>

            {sideArticles.length > 0 ? (
              /*
                No forced height/aspect-ratio needed on this wrapper. Here's
                why the columns end up matching anyway:

                NewsCarousel's root div has height:100% (see NewsCarousel.tsx)
                instead of a hardcoded height. When a grid computes a row's
                auto height, percentage-height items are excluded from that
                calculation (to avoid a circular "my height depends on the row
                whose height depends on me" loop) — so the row's height ends
                up driven by the OTHER column: the 2-card stack's natural
                content height. The carousel's height:100% then resolves
                against that final, taller value and stretches to fill it —
                no gap underneath, and the cards keep their natural,
                undistorted proportions since they were never the one being
                squeezed. lg:flex-1 lg:min-h-0 on each NewsCard just evens out
                any small height difference between the 2 of them.

                Mobile (<lg) collapses to one column: the carousel falls back
                to its own natural 16/7 (no definite parent height there), and
                the cards stack at natural height below it — unchanged from before.
              */
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
                <NewsCarousel articles={mainArticles} sport="football" />
                <div className="flex flex-col gap-4">
                  {sideArticles.map((a) => (
                    <NewsCard key={a.id} article={a} sport="football" className="lg:flex-1 lg:min-h-0" />
                  ))}
                </div>
              </div>
            ) : (
              <NewsCarousel articles={mainArticles} sport="football" />
            )}
          </div>
        </section>
      )}

      {/* ── Multi-sport news grid ──────────────────────────────────────── */}
      <MultiSportNews />

      <HeroStrip />
    </div>
  );
}