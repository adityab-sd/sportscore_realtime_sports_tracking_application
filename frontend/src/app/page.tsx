import LiveTicker from "@/components/ui/LiveTicker";
import NewsCarousel from "@/components/news/NewsCarousel";
import NewsCard from "@/components/news/NewsCard";
import AllSportsLiveStrip, { type UpcomingFixture, type F1Race } from "@/components/home/AllSportsLiveStrip";
import MultiSportNews from "@/components/home/MultiSportNews";
import { getNews as getFootballNews, getFixtures as getFootballFixtures, getScoreboard as getFootballScoreboard } from "@/lib/api/espn";
import { getNews as getBasketballNews, getFixtures as getBasketballFixtures, getScoreboard as getBasketballScoreboard, BBNews } from "@/lib/api/basketball";
import { getNews as getBaseballNews, getFixtures as getBaseballFixtures, getScoreboard as getBaseballScoreboard } from "@/lib/api/baseball";
import { classifyStatus as classifyFootballStatus } from "@/types/football";
import { ESPNNews } from "@/lib/api/espn";
import HeroStrip from "@/components/home/HeroStrip";
import HeroSplit from "@/components/landing/HeroSplit";

export const dynamic = "force-dynamic";

// Merge each sport's news into one feed, tagging every article with its sport
// so links route to the correct /{sport}/news/[id].
type CarouselArticle = (ESPNNews | BBNews) & { sport: "football" | "basketball" | "baseball" | "f1" };

async function getCarouselNews(): Promise<CarouselArticle[]> {
  const [footballNews, basketballNews, baseballNews] = await Promise.allSettled([
    getFootballNews("eng.1", 8),
    getBasketballNews("nba", 8),
    getBaseballNews("mlb", 8),
  ]);
  const seen = new Set<string>();
  const all: CarouselArticle[] = [];
  const append = (items: (ESPNNews | BBNews)[], sport: CarouselArticle["sport"]) => {
    for (const a of items) {
      if (!seen.has(a.id)) { seen.add(a.id); all.push({ ...a, sport }); }
    }
  };
  if (footballNews.status   === "fulfilled") append(footballNews.value, "football");
  if (basketballNews.status === "fulfilled") append(basketballNews.value, "basketball");
  if (baseballNews.status   === "fulfilled") append(baseballNews.value, "baseball");
  return all
    .sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime())
    .slice(0, 8);
}

const UPCOMING_PER_SPORT = 8;

const FOOTBALL_UPCOMING_LEAGUES = ["fifa.world", "eng.1", "esp.1", "ger.1", "ita.1", "fra.1", "uefa.champions", "usa.1", "mex.1", "bra.1", "arg.1"];
const BASKETBALL_UPCOMING_LEAGUES = ["nba", "wnba"];
const BASEBALL_UPCOMING_LEAGUES = ["mlb", "college-baseball"];

function stateOfBB(statusState: string | null | undefined): "scheduled" | "live" | "finished" {
  return statusState === "in" ? "live" : statusState === "post" ? "finished" : "scheduled";
}

// League label per slug — used as the card's competition tag (ESPN often leaves it empty).
const LEAGUE_LABELS: Record<string, string> = {
  "fifa.world": "World Cup", "eng.1": "Premier League", "esp.1": "La Liga",
  "ger.1": "Bundesliga", "ita.1": "Serie A", "fra.1": "Ligue 1",
  "uefa.champions": "Champions League", "usa.1": "MLS", "mex.1": "Liga MX",
  "nba": "NBA", "wnba": "WNBA", "mlb": "MLB", "college-baseball": "NCAA Baseball",
  "bra.1": "Brasileirão", "arg.1": "Argentine Primera",
  "uefa.europa": "Europa League", "uefa.europa.conf": "Europa Conference",
  "fifa.friendly": "International Friendlies",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toFixture(g: any, dateField: string, path: string, slug: string, state: "scheduled" | "live" | "finished"): UpcomingFixture {
  return {
    id: String(g.id),
    dateISO: g[dateField] ?? null,
    competition: LEAGUE_LABELS[slug] ?? (g.competition || ""),
    home: { name: g.homeTeam?.name ?? "", shortName: g.homeTeam?.shortName ?? "", logo: g.homeTeam?.logo ?? null, score: g.homeScore ?? null },
    away: { name: g.awayTeam?.name ?? "", shortName: g.awayTeam?.shortName ?? "", logo: g.awayTeam?.logo ?? null, score: g.awayScore ?? null },
    href: `/${path}/${g.id}?league=${slug}`,
    state,
  };
}

async function collectFootball(slug: string): Promise<UpcomingFixture[]> {
  const [sbR, fxR] = await Promise.allSettled([getFootballScoreboard(slug), getFootballFixtures(slug)]);
  const out: UpcomingFixture[] = [];
  if (fxR.status === "fulfilled") for (const f of (fxR.value.upcoming ?? [])) out.push(toFixture(f, "kickoff", "football", slug, "scheduled"));
  if (sbR.status === "fulfilled") for (const g of (Array.isArray(sbR.value) ? sbR.value : [])) {
    const st = classifyFootballStatus(g.status);
    if (st !== "live") out.push(toFixture(g, "kickoff", "football", slug, st));
  }
  return out;
}

function makeBBCollector(path: string, dateField: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchSb: (s: string) => Promise<any>, fetchFx: (s: string) => Promise<any>) {
  return async (slug: string): Promise<UpcomingFixture[]> => {
    const [sbR, fxR] = await Promise.allSettled([fetchSb(slug), fetchFx(slug)]);
    const out: UpcomingFixture[] = [];
    if (fxR.status === "fulfilled") for (const f of (fxR.value?.upcoming ?? [])) out.push(toFixture(f, dateField, path, slug, "scheduled"));
    if (sbR.status === "fulfilled") for (const g of (Array.isArray(sbR.value) ? sbR.value : [])) {
      const st = stateOfBB(g.statusState);
      if (st !== "live") out.push(toFixture(g, dateField, path, slug, st));
    }
    return out;
  };
}

const ESPN_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
};

// Backend doesn't return upcoming MLB, so pull the next ~week straight from ESPN.
async function espnMlbUpcoming(): Promise<UpcomingFixture[]> {
  try {
    const fmt = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const now = new Date();
    const end = new Date(now); end.setDate(end.getDate() + 6);
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${fmt(now)}-${fmt(end)}`;
    const res = await fetch(url, { headers: ESPN_HEADERS, next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: any[] = Array.isArray(data?.events) ? data.events : [];
    // ESPN sends score as a string; "" / missing → null.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const num = (v: any) => (v === "" || v == null ? null : Number(v));
    const out: UpcomingFixture[] = [];
    for (const ev of events) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const comp: any = (ev.competitions ?? [])[0] ?? {};
      const state = comp.status?.type?.state ?? ev.status?.type?.state ?? "pre";
      if (state === "post") continue; // upcoming / live only
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const comps: any[] = comp.competitors ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pickC = (ha: string) => comps.find((c: any) => c.homeAway === ha) ?? {};
      const homeC = pickC("home"); const awayC = pickC("away");
      const home = homeC.team ?? {}; const away = awayC.team ?? {};
      out.push({
        id: String(ev.id),
        dateISO: comp.date ?? ev.date ?? null,
        competition: "MLB",
        home: { name: home.displayName ?? "", shortName: home.abbreviation ?? home.shortDisplayName ?? "", logo: home.logo ?? home.logos?.[0]?.href ?? null, score: num(homeC.score) },
        away: { name: away.displayName ?? "", shortName: away.abbreviation ?? away.shortDisplayName ?? "", logo: away.logo ?? away.logos?.[0]?.href ?? null, score: num(awayC.score) },
        href: `/baseball/${ev.id}?league=mlb`,
        state: state === "in" ? "live" : "scheduled",
      });
    }
    return out;
  } catch {
    return [];
  }
}

const bbBaseballBackend = makeBBCollector("baseball", "firstPitch", getBaseballScoreboard, getBaseballFixtures);

const COLLECTORS: { key: string; leagues: string[]; collect: (slug: string) => Promise<UpcomingFixture[]> }[] = [
  { key: "football",   leagues: FOOTBALL_UPCOMING_LEAGUES,   collect: collectFootball },
  { key: "basketball", leagues: BASKETBALL_UPCOMING_LEAGUES, collect: makeBBCollector("basketball", "tipoff", getBasketballScoreboard, getBasketballFixtures) },
  {
    key: "baseball", leagues: BASEBALL_UPCOMING_LEAGUES,
    collect: async (slug) => {
      const backend = await bbBaseballBackend(slug);
      if (slug === "mlb") return [...(await espnMlbUpcoming()), ...backend];
      return backend;
    },
  },
];

function rankState(f: UpcomingFixture): number { return f.state === "finished" ? 1 : 0; }
function byDate(a: UpcomingFixture, b: UpcomingFixture, dir: 1 | -1): number {
  if (!a.dateISO && !b.dateISO) return 0;
  if (!a.dateISO) return 1;
  if (!b.dateISO) return -1;
  return (new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime()) * dir;
}

async function getUpcomingBySport(): Promise<Record<string, UpcomingFixture[]>> {
  const bySport: Record<string, UpcomingFixture[]> = {};
  await Promise.all(
    COLLECTORS.map(async ({ key, leagues, collect }) => {
      const settled = await Promise.allSettled(leagues.map(collect));
      const raw: UpcomingFixture[] = [];
      for (const r of settled) if (r.status === "fulfilled") raw.push(...r.value);
      // Drop stale scheduled games already in the past (mis-dated / postponed).
      const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
      const list = raw.filter((f) => {
        if (f.state !== "scheduled") return true;
        if (!f.dateISO) return true;
        return new Date(f.dateISO).getTime() >= startToday.getTime();
      });
      list.sort((a, b) => rankState(a) - rankState(b) || byDate(a, b, a.state === "finished" ? -1 : 1));
      const seen = new Set<string>();
      const deduped: UpcomingFixture[] = [];
      for (const f of list) { if (seen.has(f.id)) continue; seen.add(f.id); deduped.push(f); }
      if (deduped.length > 0) bySport[key] = deduped.slice(0, UPCOMING_PER_SPORT);
    })
  );
  return bySport;
}

// F1 races come straight from ESPN (no backend). Live first, then upcoming, then recent finished.
async function getF1Races(): Promise<F1Race[]> {
  const fetchEvents = async (url: string) => {
    try {
      const res = await fetch(url, { headers: ESPN_HEADERS, next: { revalidate: 600 } });
      if (!res.ok) return [];
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return Array.isArray(data?.events) ? (data.events as any[]) : [];
    } catch {
      return [];
    }
  };
  try {
    const fmt = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const now = new Date();
    const end = new Date(now.getFullYear(), 11, 31);
    let events = await fetchEvents(`https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard?dates=${fmt(now)}-${fmt(end)}`);
    if (events.length === 0) events = await fetchEvents("https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard");
    const clean = (name: string) => name.replace(/^Formula 1\s+/i, "").replace(/\s+20\d\d$/, "").trim();
    const nowMs = Date.now();
    const races: F1Race[] = events.map((ev) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const comps: any[] = Array.isArray(ev.competitions) ? ev.competitions : [];
      // Pick the RACE session (explicit "race" type, else latest-dated).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const byType = comps.find((c: any) => (c?.type?.text ?? c?.type?.abbreviation ?? "").toString().toLowerCase().includes("race"));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const byLatest = comps.slice().sort((a: any, b: any) => new Date(b?.date ?? 0).getTime() - new Date(a?.date ?? 0).getTime())[0];
      const raceComp = byType ?? byLatest ?? comps[0] ?? {};
      const raceDate = raceComp.date ?? ev.date ?? null;
      const espnState = raceComp.status?.type?.state ?? ev.status?.type?.state ?? "pre";
      const t = raceDate ? new Date(raceDate).getTime() : NaN;
      // A future start can't be "finished" even if ESPN marks a done practice session.
      let state: "scheduled" | "live" | "finished";
      if (espnState === "in") state = "live";
      else if (Number.isFinite(t) && t > nowMs) state = "scheduled";
      else if (espnState === "post") state = "finished";
      else state = "scheduled";
      const circuit = raceComp.circuit ?? ev.circuit ?? ev.venue ?? {};
      const addr = circuit.address ?? {};
      return {
        id: String(ev.id),
        name: clean(String(ev.name ?? ev.shortName ?? "Grand Prix")),
        circuit: String(circuit.fullName ?? circuit.name ?? ""),
        location: [addr.city, addr.country].filter(Boolean).join(", "),
        dateISO: raceDate,
        state,
        href: `/f1/race/${ev.id}`,
      };
    });
    const upcoming = races.filter(r => r.state !== "finished");
    upcoming.sort((a, b) => {
      const rank = (r: F1Race) => (r.state === "live" ? 0 : 1);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      const ta = a.dateISO ? new Date(a.dateISO).getTime() : Infinity;
      const tb = b.dateISO ? new Date(b.dateISO).getTime() : Infinity;
      return ta - tb;
    });
    const list = upcoming.length > 0
      ? upcoming
      : races.sort((a, b) => new Date(b.dateISO ?? 0).getTime() - new Date(a.dateISO ?? 0).getTime());
    return list.slice(0, 6);
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [carouselNews, upcomingBySport, f1Races] = await Promise.all([
    getCarouselNews(),
    getUpcomingBySport(),
    getF1Races(),
  ]);

  // Up to 2 side cards, but never starve the carousel below 2 slides.
  const sideCount = Math.min(2, Math.max(0, carouselNews.length - 2));
  const sideArticles = sideCount > 0 ? carouselNews.slice(-sideCount) : [];
  const mainArticles = carouselNews.slice(0, carouselNews.length - sideCount);

  return (
    <div>
      <HeroSplit />
      <LiveTicker />

      <div style={{ borderBottom: "1px solid var(--border)" }}>
        <AllSportsLiveStrip upcomingBySport={upcomingBySport} f1Races={f1Races} />
      </div>

      {mainArticles.length > 0 && (
        <section style={{ background: "var(--cloud)", borderBottom: "1px solid var(--border)", paddingTop: 28, paddingBottom: 32 }}>
          <div className="container">
            <div className="section-label" style={{ marginBottom: 14 }}>Top Stories</div>
            {sideArticles.length > 0 ? (
              // Carousel uses height:100% so the grid row height is driven by the
              // side-card stack; the carousel then stretches to match it.
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
                <NewsCarousel articles={mainArticles} />
                <div className="flex flex-col gap-4">
                  {sideArticles.map((a) => (
                    <NewsCard key={a.id} article={a} className="lg:flex-1 lg:min-h-0" />
                  ))}
                </div>
              </div>
            ) : (
              <NewsCarousel articles={mainArticles} />
            )}
          </div>
        </section>
      )}

      <MultiSportNews />
      <HeroStrip />
    </div>
  );
}