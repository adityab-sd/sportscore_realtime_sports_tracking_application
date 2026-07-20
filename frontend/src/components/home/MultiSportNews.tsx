import Link from "next/link";
import NewsCard from "@/components/news/NewsCard";
import { getNews as getFootballNews, ESPNNews } from "@/lib/api/espn";
import { getNews as getBasketballNews, BBNews } from "@/lib/api/basketball";

interface NormalisedArticle {
  id: string;
  headline: string;
  description: string;
  published: string;
  image: string | null;
  category: string;
  link?: string | null;
  sport: "football" | "basketball";
}

// ─────────────────────────────────────────────────────────────────────────────
// SPORT_FEEDS — add a new sport here when its backend endpoint is ready.
// slots: guaranteed minimum cards from this sport in the grid.
// ─────────────────────────────────────────────────────────────────────────────
const SPORT_FEEDS: {
  sport: "football" | "basketball";
  slots: number;
  fetch: () => Promise<(ESPNNews | BBNews)[]>;
  label: string;
  color: string;
  bg: string;
  href: string;
}[] = [
  {
    sport: "football",
    slots: 3,
    fetch: () => getFootballNews("eng.1", 6),
    label: "Football",
    color: "var(--navy)",
    bg: "var(--navy-light)",
    href: "/football/news",
  },
  {
    sport: "basketball",
    slots: 3,
    fetch: () => getBasketballNews("nba", 6),
    label: "Basketball",
    color: "#EA580C",
    bg: "#FEF3C7",
    href: "/basketball/news",
  },
  // ── Add future sports below ──────────────────────────────────────────────
  // { sport: "baseball", slots: 2, fetch: () => getBaseballNews("mlb", 6), ... },
];

// ─────────────────────────────────────────────────────────────────────────────
// fetchBalancedNews — guarantees `slots` articles per sport.
// Within each sport, articles are sorted newest-first.
// Final grid interleaves sports: football[0], basketball[0], football[1], ...
// ─────────────────────────────────────────────────────────────────────────────
async function fetchBalancedNews(): Promise<NormalisedArticle[]> {
  const results = await Promise.allSettled(SPORT_FEEDS.map(f => f.fetch()));

  // Build per-sport arrays (newest first, deduped)
  const bySport: Map<string, NormalisedArticle[]> = new Map();

  results.forEach((result, i) => {
    if (result.status !== "fulfilled") return;
    const feed    = SPORT_FEEDS[i];
    const seen    = new Set<string>();
    const articles: NormalisedArticle[] = [];

    for (const a of result.value) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      articles.push({
        id:          a.id,
        headline:    a.headline,
        description: a.description,
        published:   a.published,
        image:       a.image,
        category:    a.category,
        link:        a.link ?? undefined,
        sport:       feed.sport,
      });
    }

    // Sort newest first within each sport
    articles.sort((a, b) =>
      new Date(b.published).getTime() - new Date(a.published).getTime()
    );

    bySport.set(feed.sport, articles);
  });

  // Take exactly `slots` articles per sport, then interleave
  // e.g. [F1, BB1, F2, BB2, F3, BB3] for slots=3 each
  const maxSlots = Math.max(...SPORT_FEEDS.map(f => f.slots));
  const interleaved: NormalisedArticle[] = [];

  for (let i = 0; i < maxSlots; i++) {
    for (const feed of SPORT_FEEDS) {
      if (i >= feed.slots) continue;
      const articles = bySport.get(feed.sport) ?? [];
      if (articles[i]) interleaved.push(articles[i]);
    }
  }

  return interleaved;
}

export default async function MultiSportNews() {
  const articles = await fetchBalancedNews();

  if (articles.length === 0) return null;


  return (
    <section style={{ paddingTop: 40, paddingBottom: 48 }}>
      <div className="container">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: "clamp(20px,3vw,24px)", fontWeight: 800, color: "var(--obsidian)", margin: 0, letterSpacing: "-0.4px" }}>
            Latest News
          </h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SPORT_FEEDS.map(({ label, href, color, bg }) => (
              <Link key={label} href={href} style={{
                fontSize: 13, fontWeight: 600, color,
                background: bg, padding: "6px 14px",
                borderRadius: 8, textDecoration: "none",
              }}>
                {label} →
              </Link>
            ))}
          </div>
        </div>

        {/* Interleaved news grid */}
        <div className="news-grid">
          {articles.map(a => (
            <NewsCard
              key={`${a.sport}-${a.id}`}
              article={a}
              sport={a.sport}
            />
          ))}
        </div>

      </div>
    </section>
  );
}