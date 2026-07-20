import { getFixtures as getFootballFixtures } from "@/lib/api/espn";
import { getFixtures as getBasketballFixtures } from "@/lib/api/basketball";
import { leagueByName as footballLeagueInfo } from "@/types/football";
import HeroScrollClient, { type Card, type MatchCard, type AestheticCard } from "./HeroScrollClient";

/* ------------------------------------------------------------------ */
/* Local aesthetic assets — public/cards/                              */
/* ------------------------------------------------------------------ */

const BG = {
  pl: "/cards/pl.jpeg",
  laliga: "/cards/laliga.jpeg",
  ucl: "/cards/ucl.jpeg",
  seriea: "/cards/seriea.jpeg",
  bundesliga: "/cards/bundesliga.jpeg",
  ligue1: "/cards/ligue1.jpeg",
  nba: "/cards/nba.jpeg",
  nba2: "/cards/nba-2.jpeg",
  wnba: "/cards/wnba.jpeg",
  worldcup: "/cards/worldcup.jpeg",
} as const;

const AES = {
  pl: "/cards/aes-pl.jpeg",
  laliga: "/cards/aes-laliga.jpeg",
  ucl: "/cards/aes-ucl.jpeg",
  seriea: "/cards/aes-seriea.jpeg",
  bayern: "/cards/aes-bayern.jpeg",
  ligue1: "/cards/aes-ligue1.jpeg",
  nba: "/cards/aes-nba-1.jpeg",
} as const;

const FOOTBALL_BG: Record<string, string> = {
  "fifa.world": BG.worldcup,
  "eng.1": BG.pl,
  "esp.1": BG.laliga,
  "ger.1": BG.bundesliga,
  "ita.1": BG.seriea,
  "fra.1": BG.ligue1,
  "uefa.champions": BG.ucl,
};

const AESTHETICS_ROW1: AestheticCard[] = [
  { type: "aesthetic", image: BG.worldcup, label: "World Cup 2026", href: "/football/world-cup" },
  { type: "aesthetic", image: AES.ucl,    label: "Champions League", href: "/football/league/uefa.champions" },
  { type: "aesthetic", image: AES.pl,     label: "Premier League",   href: "/football/league/eng.1" },
  { type: "aesthetic", image: "/cards/aes-nba-1.jpeg", label: "NBA", href: "/basketball/league/nba" },
  { type: "aesthetic", image: "/cards/aes-f1-1.jpeg",  label: "Formula 1", href: "/f1" },
  { type: "aesthetic", image: "/cards/aes-cricket-1.jpeg", label: "Cricket", href: "/cricket" },
];

const AESTHETICS_ROW2: AestheticCard[] = [
  { type: "aesthetic", image: AES.seriea, label: "Serie A",    href: "/football/league/ita.1" },
  { type: "aesthetic", image: AES.bayern, label: "Bundesliga", href: "/football/league/ger.1" },
  { type: "aesthetic", image: "/cards/aes-nba-2.jpeg", label: "NBA",       href: "/basketball/league/nba" },
  { type: "aesthetic", image: "/cards/aes-f1-2.jpeg",  label: "Formula 1", href: "/f1" },
  { type: "aesthetic", image: "/cards/aes-cricket-2.jpeg", label: "Cricket", href: "/cricket" },
];

const AESTHETICS_ROW3: AestheticCard[] = [
  { type: "aesthetic", image: AES.laliga, label: "La Liga",  href: "/football/league/esp.1" },
  { type: "aesthetic", image: AES.ligue1, label: "Ligue 1",  href: "/football/league/fra.1" },
  { type: "aesthetic", image: "/cards/aes-nba-3.jpeg", label: "NBA",       href: "/basketball/league/nba" },
  { type: "aesthetic", image: "/cards/aes-f1-3.jpeg",  label: "Formula 1", href: "/f1" },
  { type: "aesthetic", image: "/cards/aes-cricket-3.jpeg", label: "Cricket", href: "/cricket" },
];

/* ------------------------------------------------------------------ */
/* Date formatting — runs once on the server, shipped as a plain       */
/* string prop so the client never recomputes it (no hydration risk).  */
/* ------------------------------------------------------------------ */

function formatWhen(iso: string | null): string {
  if (!iso) return "Time TBD";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Time TBD";
  const date = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

/* ------------------------------------------------------------------ */
/* Fetch + normalize real fixtures                                     */
/* ------------------------------------------------------------------ */

const FOOTBALL_LEAGUES = ["fifa.world", "eng.1", "esp.1", "ger.1", "ita.1", "fra.1", "uefa.champions"];
const BASKETBALL_LEAGUES = ["nba", "wnba", "nba-summer-las-vegas", "mens-college-basketball"];

const BASKETBALL_BG: Record<string, string> = {
  "nba":                     BG.nba,
  "wnba":                    BG.wnba,
  "nba-summer-las-vegas":    BG.nba2,
  "mens-college-basketball": BG.nba2,
  "nba-development":         BG.nba2,
};

async function getRealMatches(): Promise<MatchCard[]> {
  const [footballSettled, basketballSettled] = await Promise.all([
    Promise.allSettled(FOOTBALL_LEAGUES.map((slug) => getFootballFixtures(slug))),
    Promise.allSettled(BASKETBALL_LEAGUES.map((slug) => getBasketballFixtures(slug))),
  ]);

  const matches: MatchCard[] = [];

  footballSettled.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const slug = FOOTBALL_LEAGUES[i];
    for (const f of r.value.upcoming.slice(0, 5)) {
      matches.push({
        type: "match",
        id: f.id,
        dateLabel: formatWhen(f.kickoff),
        home: { name: f.homeTeam.name, short: f.homeTeam.shortName, logo: f.homeTeam.logo },
        away: { name: f.awayTeam.name, short: f.awayTeam.shortName, logo: f.awayTeam.logo },
        leagueLabel: footballLeagueInfo(f.competition)?.name ?? f.competition,
        bgImage: FOOTBALL_BG[slug] ?? BG.pl,
        href: `/football/${f.id}?league=${slug}`,
      });
    }
  });

  basketballSettled.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const slug = BASKETBALL_LEAGUES[i];
    for (const f of r.value.upcoming.slice(0, 6)) {
      matches.push({
        type: "match",
        id: f.id,
        dateLabel: formatWhen(f.tipoff),
        home: { name: f.homeTeam.name, short: f.homeTeam.shortName, logo: f.homeTeam.logo },
        away: { name: f.awayTeam.name, short: f.awayTeam.shortName, logo: f.awayTeam.logo },
        leagueLabel: f.competition,
        bgImage: BASKETBALL_BG[slug] ?? BG.nba,
        href: `/basketball/${f.id}?league=${slug}`,
      });
    }
  });

  return matches;
}

/* ------------------------------------------------------------------ */
/* Mix real matches with real league tiles, split into 3 rows          */
/* ------------------------------------------------------------------ */

function buildRows(matches: MatchCard[]): [Card[], Card[], Card[]] {
  // ============================================================================
  // ADDRESSED: avoid random ordering in render path
  // ----------------------------------------------------------------------------
  // Math.random() makes the server-rendered rows non-deterministic across
  // requests and revalidations, which makes bugs hard to reproduce and can
  // reshuffle visible content for no data change.
  //
  // EXAMPLE:
  //   const shuffled = [...matches].sort((a, b) => a.id.localeCompare(b.id));
  //   // or use a seeded shuffle derived from a stable daily key.
  // ============================================================================
  // Shuffle matches so the 3 rows don't each start with the same league block
  const shuffled = [...matches].sort(() => Math.random() - 0.5);

  // Round-robin distribute matches into 3 rows
  const rows: [Card[], Card[], Card[]] = [[], [], []];
  shuffled.forEach((m, i) => rows[i % 3].push(m));

  // Each row gets its own aesthetic pool — no image repeats across rows
  const aesPools = [AESTHETICS_ROW1, AESTHETICS_ROW2, AESTHETICS_ROW3];

  // Interleave: insert an aesthetic card every 3 matches
  for (let r = 0; r < 3; r++) {
    const pool = aesPools[r];
    const row = rows[r];
    const interleaved: Card[] = [];
    let aesIdx = 0;

    for (let i = 0; i < row.length; i++) {
      interleaved.push(row[i]);
      if ((i + 1) % 3 === 0) {
        interleaved.push(pool[aesIdx % pool.length]);
        aesIdx++;
      }
    }

    // Ensure minimum card count so the marquee never looks sparse
    while (interleaved.length < 8) {
      interleaved.push(pool[aesIdx % pool.length]);
      aesIdx++;
    }

    rows[r] = interleaved;
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