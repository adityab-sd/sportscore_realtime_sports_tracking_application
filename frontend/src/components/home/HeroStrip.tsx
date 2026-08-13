import { getFixtures as getFootballFixtures } from "@/lib/api/espn";
import { getFixtures as getBasketballFixtures } from "@/lib/api/basketball";
import { getFixtures as getBaseballFixtures } from "@/lib/api/baseball";
import { leagueByName as footballLeagueInfo } from "@/types/football";
import HeroScrollClient, { type Card, type MatchCard, type AestheticCard, type RaceCard } from "./HeroScrollClient";

/* ------------------------------------------------------------------ */
/* Background images per league                                        */
/* ------------------------------------------------------------------ */

const FOOTBALL_BG: Record<string, string> = {
  "fifa.world":     "/cards/worldcup.jpeg",
  "eng.1":          "/cards/pl.jpeg",
  "esp.1":          "/cards/laliga.jpeg",
  "ger.1":          "/cards/bundesliga.jpeg",
  "ita.1":          "/cards/seriea.jpeg",
  "fra.1":          "/cards/ligue1.jpeg",
  "uefa.champions": "/cards/ucl.jpeg",
};

const BASKETBALL_BG: Record<string, string> = {
  "nba":                     "/cards/nba.jpeg",
  "wnba":                    "/cards/wnba.jpeg",
  "nba-summer-las-vegas":    "/cards/nba-2.jpeg",
  "mens-college-basketball": "/cards/nba-2.jpeg",
};

const BASEBALL_BG: Record<string, string> = {
  "mlb":              "/cards/mlb.jpeg",
  "college-baseball": "/cards/ncaa.jpeg",
};

/* ------------------------------------------------------------------ */
/* Aesthetic league/sport cards — one unique set per row so images     */
/* never repeat across rows. Scalable: append entries when adding a   */
/* new sport or league.                                                */
/* ------------------------------------------------------------------ */

const AESTHETICS_ROW1: AestheticCard[] = [
  { type: "aesthetic", image: "/cards/worldcup.jpeg",    label: "World Cup 2026",   href: "/football/league/fifa.world" },
  { type: "aesthetic", image: "/cards/aes-ucl.jpeg",     label: "Champions League", href: "/football/league/uefa.champions" },
  { type: "aesthetic", image: "/cards/aes-pl.jpeg",      label: "Premier League",   href: "/football/league/eng.1" },
  { type: "aesthetic", image: "/cards/aes-nba-1.jpeg",   label: "NBA",              href: "/basketball/league/nba" },
  { type: "aesthetic", image: "/cards/aes-mlb-1.jpeg",   label: "MLB",             href: "/baseball/league/mlb" },
  { type: "aesthetic", image: "/cards/aes-f1-1.jpeg",    label: "Formula 1",        href: "/f1" },
];

const AESTHETICS_ROW2: AestheticCard[] = [
  { type: "aesthetic", image: "/cards/aes-seriea.jpeg",  label: "Serie A",     href: "/football/league/ita.1" },
  { type: "aesthetic", image: "/cards/aes-bayern.jpeg",  label: "Bundesliga",  href: "/football/league/ger.1" },
  { type: "aesthetic", image: "/cards/aes-nba-2.jpeg",   label: "NBA",         href: "/basketball/league/nba" },
  { type: "aesthetic", image: "/cards/aes-mlb-2.jpeg", label: "MLB", href: "/baseball/league/mlb" },
  { type: "aesthetic", image: "/cards/aes-f1-2.jpeg",    label: "Formula 1",   href: "/f1" },
];

const AESTHETICS_ROW3: AestheticCard[] = [
  { type: "aesthetic", image: "/cards/aes-laliga.jpeg",  label: "La Liga",    href: "/football/league/esp.1" },
  { type: "aesthetic", image: "/cards/aes-ligue1.jpeg",  label: "Ligue 1",    href: "/football/league/fra.1" },
  { type: "aesthetic", image: "/cards/aes-nba-3.jpeg",   label: "NBA",         href: "/basketball/league/nba" },
  { type: "aesthetic", image: "/cards/aes-mlb-3.jpeg",   label: "MLB",        href: "/baseball/league/mlb" },
  { type: "aesthetic", image: "/cards/aes-f1-3.jpeg",    label: "Formula 1",   href: "/f1" },
];

/* ------------------------------------------------------------------ */
/* Fetch upcoming matches from all sports (next 7 days)                */
/* ------------------------------------------------------------------ */

const FOOTBALL_LEAGUES  = ["fifa.world", "eng.1", "esp.1", "ger.1", "ita.1", "fra.1", "uefa.champions"];
const BASKETBALL_LEAGUES = ["nba", "wnba", "nba-summer-las-vegas", "mens-college-basketball"];
const BASEBALL_LEAGUES = ["mlb", "college-baseball"];

async function getRealMatches(): Promise<MatchCard[]> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDays = startOfToday + 7 * 24 * 60 * 60 * 1000;

  const [footballSettled, basketballSettled, baseballSettled] = await Promise.all([
    Promise.allSettled(FOOTBALL_LEAGUES.map((slug) => getFootballFixtures(slug))),
    Promise.allSettled(BASKETBALL_LEAGUES.map((slug) => getBasketballFixtures(slug))),
    Promise.allSettled(BASEBALL_LEAGUES.map((slug) => getBaseballFixtures(slug))),
  ]);

  const matches: MatchCard[] = [];

  footballSettled.forEach((r, i) => {
    if (r.status !== "fulfilled" || !r.value) return;
    const slug = FOOTBALL_LEAGUES[i];
    for (const f of r.value.upcoming.slice(0, 5)) {
      if (f.kickoff) {
        const t = Date.parse(f.kickoff);
        if (Number.isFinite(t) && (t < startOfToday || t > sevenDays)) continue;
      }
      matches.push({
        type: "match",
        id: f.id,
        kickoff: f.kickoff,
        home: { name: f.homeTeam.name, short: f.homeTeam.shortName, logo: f.homeTeam.logo },
        away: { name: f.awayTeam.name, short: f.awayTeam.shortName, logo: f.awayTeam.logo },
        leagueLabel: footballLeagueInfo(f.competition)?.name ?? f.competition,
        bgImage: FOOTBALL_BG[slug] ?? "/cards/pl.jpeg",
        href: `/football/${f.id}?league=${slug}`,
      });
    }
  });

  basketballSettled.forEach((r, i) => {
    if (r.status !== "fulfilled" || !r.value) return;
    const slug = BASKETBALL_LEAGUES[i];
    const upcoming = r.value.upcoming ?? [];
    for (const f of upcoming.slice(0, 6)) {
      if (f.tipoff) {
        const t = Date.parse(f.tipoff);
        if (Number.isFinite(t) && (t < startOfToday || t > sevenDays)) continue;
      }
      matches.push({
        type: "match",
        id: f.id,
        kickoff: f.tipoff,
        home: { name: f.homeTeam.name, short: f.homeTeam.shortName, logo: f.homeTeam.logo },
        away: { name: f.awayTeam.name, short: f.awayTeam.shortName, logo: f.awayTeam.logo },
        leagueLabel: f.competition,
        bgImage: BASKETBALL_BG[slug] ?? "/cards/nba.jpeg",
        href: `/basketball/${f.id}?league=${slug}`,
      });
    }
  });

  baseballSettled.forEach((r, i) => {
    if (r.status !== "fulfilled" || !r.value) return;
    const slug = BASEBALL_LEAGUES[i];
    const upcoming = r.value.upcoming ?? [];
    for (const f of upcoming.slice(0, 6)) {
      if (f.firstPitch) {
        const t = Date.parse(f.firstPitch);
        if (Number.isFinite(t) && (t < startOfToday || t > sevenDays)) continue;
      }
      matches.push({
        type: "match",
        id: f.id,
        kickoff: f.firstPitch,
        home: { name: f.homeTeam.name, short: f.homeTeam.shortName, logo: f.homeTeam.logo },
        away: { name: f.awayTeam.name, short: f.awayTeam.shortName, logo: f.awayTeam.logo },
        leagueLabel: f.competition,
        bgImage: BASEBALL_BG[slug] ?? "/carousel/baseball/baseball-1.jpg",
        href: `/baseball/${f.id}?league=${slug}`,
      });
    }
  });

  return matches;
}

/* ------------------------------------------------------------------ */
/* Fetch upcoming F1 races (weekly, so we show the next few) directly   */
/* from ESPN's racing scoreboard.                                       */
/* ------------------------------------------------------------------ */

const ESPN_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
};
const F1_BG = ["/cards/f1.jpeg"];

async function getF1RaceCards(): Promise<RaceCard[]> {
  try {
    const fmt = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const now = new Date();
    const end = new Date(now.getFullYear(), 11, 31);
    const url = `https://site.web.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard?dates=${fmt(now)}-${fmt(end)}`;
    const res = await fetch(url, { headers: ESPN_HEADERS, next: { revalidate: 600 } });
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: any[] = Array.isArray(data?.events) ? data.events : [];
    const clean = (n: string) => n.replace(/^Formula 1\s+/i, "").replace(/\s+20\d\d$/, "").trim();
    const nowMs = Date.now();
    const races = events
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((ev: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const comps: any[] = Array.isArray(ev.competitions) ? ev.competitions : [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const byType = comps.find((c: any) => (c?.type?.text ?? c?.type?.abbreviation ?? "").toString().toLowerCase().includes("race"));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const byLatest = comps.slice().sort((a: any, b: any) => new Date(b?.date ?? 0).getTime() - new Date(a?.date ?? 0).getTime())[0];
        const raceComp = byType ?? byLatest ?? comps[0] ?? {};
        const raceDate: string | null = raceComp.date ?? ev.date ?? null;
        const espnState = raceComp.status?.type?.state ?? ev.status?.type?.state ?? "pre";
        const t = raceDate ? new Date(raceDate).getTime() : NaN;
        const finished = espnState === "post" && !(Number.isFinite(t) && t > nowMs);
        const circuit = raceComp.circuit ?? ev.circuit ?? ev.venue ?? {};
        return { id: String(ev.id), name: clean(String(ev.name ?? ev.shortName ?? "Grand Prix")), circuit: String(circuit.fullName ?? circuit.name ?? ""), dateISO: raceDate, t, finished };
      })
      .filter((r) => !r.finished)
      .sort((a, b) => (Number.isFinite(a.t) ? a.t : Infinity) - (Number.isFinite(b.t) ? b.t : Infinity))
      .slice(0, 4);

    return races.map((r, i): RaceCard => ({
      type: "race",
      id: r.id,
      kickoff: r.dateISO,
      name: r.name,
      circuit: r.circuit,
      bgImage: F1_BG[i % F1_BG.length],
      href: `/f1/race/${r.id}`,
    }));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Build 3 rows: interleave real matches with aesthetic league cards   */
/* ------------------------------------------------------------------ */

type RealCard = MatchCard | RaceCard;

/** Background image a card renders (what must not visibly repeat). */
function imgOf(c: Card): string {
  return c.type === "aesthetic" ? c.image : c.bgImage;
}

/*
 * Build 3 always-full rows with NO repeated background image inside a sliding
 * window (so a quick glance never shows the same image twice), including across
 * the infinite-scroll clone seam. Real matches/races are placed first (once
 * each); distinct aesthetic league cards fill the rest and may recur, but never
 * within the window.
 */
function buildRows(real: RealCard[]): [Card[], Card[], Card[]] {
  // Distinct aesthetic cards, de-duplicated by image.
  const distinctAes: AestheticCard[] = [];
  const seenImg = new Set<string>();
  for (const c of [...AESTHETICS_ROW1, ...AESTHETICS_ROW2, ...AESTHETICS_ROW3]) {
    if (!seenImg.has(c.image)) { seenImg.add(c.image); distinctAes.push(c); }
  }

  // Real content, earliest first.
  const content: RealCard[] = [...real].sort((a, b) => (a.kickoff ?? "").localeCompare(b.kickoff ?? ""));

  const TARGET = 14;   // cards per row (cloned for the seamless loop)
  const WINDOW = 6;    // no image may repeat within this many cards

  const rows: Card[][] = [[], [], []];
  const recent: string[][] = [[], [], []];
  const used = new Array(content.length).fill(false);
  let ci = 0, ai = 0, guard = 0;

  const fits = (r: number, c: Card): boolean => {
    const img = imgOf(c);
    if (recent[r].includes(img)) return false;
    // When filling the tail, also avoid the row's opening images so the
    // clone seam (…end | start…) has no repeat within the window either.
    if (rows[r].length >= TARGET - WINDOW) {
      const head = rows[r].slice(0, WINDOW).map(imgOf);
      if (head.includes(img)) return false;
    }
    return true;
  };
  const put = (r: number, c: Card) => {
    rows[r].push(c);
    recent[r].push(imgOf(c));
    if (recent[r].length > WINDOW) recent[r].shift();
  };

  while (!rows.every((row) => row.length >= TARGET) && guard++ < 3000) {
    for (let r = 0; r < 3; r++) {
      if (rows[r].length >= TARGET) continue;

      // 1) next unused real card that fits the window
      let done = false;
      for (let k = 0; k < content.length; k++) {
        const idx = (ci + k) % content.length;
        if (!used[idx] && fits(r, content[idx])) {
          used[idx] = true; put(r, content[idx]); ci = (idx + 1) % content.length; done = true; break;
        }
      }
      if (done) continue;

      // 2) an aesthetic card that fits
      for (let k = 0; k < distinctAes.length; k++) {
        const c = distinctAes[(ai + k) % distinctAes.length];
        if (fits(r, c)) { put(r, c); ai = (ai + k + 1) % distinctAes.length; done = true; break; }
      }
      if (done) continue;

      // 3) last resort (tiny pools): place any remaining real, else any aesthetic
      let placed = false;
      for (let k = 0; k < content.length; k++) {
        const idx = (ci + k) % content.length;
        if (!used[idx]) { used[idx] = true; put(r, content[idx]); ci = (idx + 1) % content.length; placed = true; break; }
      }
      if (!placed && distinctAes.length > 0) { put(r, distinctAes[ai % distinctAes.length]); ai = (ai + 1) % distinctAes.length; }
      if (!placed && distinctAes.length === 0) { rows[r].push(rows[r][0] ?? content[0]); } // degenerate guard
    }
  }

  return [rows[0], rows[1], rows[2]];
}

/* ------------------------------------------------------------------ */
/* Exported hero section                                               */
/* ------------------------------------------------------------------ */

export const dynamic = "force-dynamic";

export default async function HeroStrip() {
  const [matches, f1] = await Promise.all([getRealMatches(), getF1RaceCards()]);
  const [row1, row2, row3] = buildRows([...matches, ...f1]);

  return (
    <section
      style={{
        background: "linear-gradient(180deg, #0a0a1a 0%, #121228 100%)",
        padding: "40px 0 48px",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 32, padding: "0 20px" }}>
        <h1
          style={{
            color: "#fff",
            fontSize: "clamp(28px, 5vw, 48px)",
            fontWeight: 800,
            letterSpacing: "-1.5px",
            lineHeight: 1.1,
            margin: "0 0 12px",
          }}
        >
          Every sport. Every score.{" "}
          <span style={{ color: "var(--blue, #0066FF)" }}>One app.</span>
        </h1>
        <p
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: "clamp(14px, 2vw, 17px)",
            fontWeight: 500,
            margin: 0,
            maxWidth: 480,
            marginLeft: "auto",
            marginRight: "auto",
            letterSpacing: "-0.2px",
          }}
        >
          Live scores, AI commentary and instant analysis across football, basketball and baseball.
        </p>
      </div>

      <HeroScrollClient rows={[row1, row2, row3]} />

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 80,
          background: "linear-gradient(180deg, transparent, #0a0a1a)",
          pointerEvents: "none",
        }}
      />
    </section>
  );
}