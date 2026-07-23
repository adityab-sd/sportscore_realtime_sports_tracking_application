import { getFixtures as getFootballFixtures } from "@/lib/api/espn";
import { getFixtures as getBasketballFixtures } from "@/lib/api/basketball";
import { leagueByName as footballLeagueInfo } from "@/types/football";
import HeroScrollClient, { type Card, type MatchCard } from "./HeroScrollClient";

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

/* ------------------------------------------------------------------ */
/* Aesthetic league/sport cards — one unique set per row so images     */
/* never repeat across rows. Scalable: append entries when adding a   */
/* new sport or league.                                                */
/* ------------------------------------------------------------------ */

const AESTHETICS_ROW1: Card[] = [
  { type: "aesthetic", image: "/cards/worldcup.jpeg",    label: "World Cup 2026",   href: "/football/world-cup" },
  { type: "aesthetic", image: "/cards/aes-ucl.jpeg",     label: "Champions League", href: "/football/league/uefa.champions" },
  { type: "aesthetic", image: "/cards/aes-pl.jpeg",      label: "Premier League",   href: "/football/league/eng.1" },
  { type: "aesthetic", image: "/cards/aes-nba-1.jpeg",   label: "NBA",              href: "/basketball/league/nba" },
  { type: "aesthetic", image: "/cards/aes-f1-1.jpeg",    label: "Formula 1",        href: "/f1" },
  { type: "aesthetic", image: "/cards/aes-cricket-1.jpeg", label: "Cricket",        href: "/cricket" },
];

const AESTHETICS_ROW2: Card[] = [
  { type: "aesthetic", image: "/cards/aes-seriea.jpeg",  label: "Serie A",     href: "/football/league/ita.1" },
  { type: "aesthetic", image: "/cards/aes-bayern.jpeg",  label: "Bundesliga",  href: "/football/league/ger.1" },
  { type: "aesthetic", image: "/cards/aes-nba-2.jpeg",   label: "NBA",         href: "/basketball/league/nba" },
  { type: "aesthetic", image: "/cards/aes-f1-2.jpeg",    label: "Formula 1",   href: "/f1" },
  { type: "aesthetic", image: "/cards/aes-cricket-2.jpeg", label: "Cricket",   href: "/cricket" },
];

const AESTHETICS_ROW3: Card[] = [
  { type: "aesthetic", image: "/cards/aes-laliga.jpeg",  label: "La Liga",    href: "/football/league/esp.1" },
  { type: "aesthetic", image: "/cards/aes-ligue1.jpeg",  label: "Ligue 1",    href: "/football/league/fra.1" },
  { type: "aesthetic", image: "/cards/aes-nba-3.jpeg",   label: "NBA",         href: "/basketball/league/nba" },
  { type: "aesthetic", image: "/cards/aes-f1-3.jpeg",    label: "Formula 1",   href: "/f1" },
  { type: "aesthetic", image: "/cards/aes-cricket-3.jpeg", label: "Cricket",   href: "/cricket" },
];

/* ------------------------------------------------------------------ */
/* Fetch upcoming matches from all sports (next 7 days)                */
/* ------------------------------------------------------------------ */

const FOOTBALL_LEAGUES  = ["fifa.world", "eng.1", "esp.1", "ger.1", "ita.1", "fra.1", "uefa.champions"];
const BASKETBALL_LEAGUES = ["nba", "wnba", "nba-summer-las-vegas", "mens-college-basketball"];

async function getRealMatches(): Promise<MatchCard[]> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDays = startOfToday + 7 * 24 * 60 * 60 * 1000;

  const [footballSettled, basketballSettled] = await Promise.all([
    Promise.allSettled(FOOTBALL_LEAGUES.map((slug) => getFootballFixtures(slug))),
    Promise.allSettled(BASKETBALL_LEAGUES.map((slug) => getBasketballFixtures(slug))),
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

  return matches;
}

/* ------------------------------------------------------------------ */
/* Build 3 rows: interleave real matches with aesthetic league cards   */
/* ------------------------------------------------------------------ */

function buildRows(matches: MatchCard[]): [Card[], Card[], Card[]] {
  // Each row gets its own aesthetic pool
  const aesPools = [AESTHETICS_ROW1, AESTHETICS_ROW2, AESTHETICS_ROW3];

  // If very few matches, duplicate them across all rows so every row has content
  const expanded = matches.length <= 3 && matches.length > 0
    ? [...matches, ...matches, ...matches]
    : [...matches];

  // Sort by kickoff so matches flow chronologically
  expanded.sort((a, b) => (a.kickoff ?? "").localeCompare(b.kickoff ?? ""));

  // Round-robin matches into 3 buckets
  const buckets: [MatchCard[], MatchCard[], MatchCard[]] = [[], [], []];
  expanded.forEach((m, i) => buckets[i % 3].push(m));

  const rows: [Card[], Card[], Card[]] = [[], [], []];

  for (let r = 0; r < 3; r++) {
    const pool = aesPools[r];
    const matchBucket = buckets[r];
    const row: Card[] = [];
    let aesIdx = 0;

    // Interleave: aesthetic → match → aesthetic → match ...
    // This guarantees variety regardless of match count
    const maxLen = Math.max(matchBucket.length, pool.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < pool.length) {
        row.push(pool[i]);
      }
      if (i < matchBucket.length) {
        row.push(matchBucket[i]);
      }
    }

    // Ensure minimum 10 cards for seamless infinite scroll at 240px wide
    while (row.length < 10) {
      row.push(pool[aesIdx % pool.length]);
      aesIdx++;
    }

    rows[r] = row;
  }

  return rows;
}

/* ------------------------------------------------------------------ */
/* Exported hero section                                               */
/* ------------------------------------------------------------------ */

export const dynamic = "force-dynamic";

export default async function HeroStrip() {
  const matches = await getRealMatches();
  const [row1, row2, row3] = buildRows(matches);

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
          Live scores, AI commentary and instant analysis across football and basketball.
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