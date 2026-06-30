import Link from "next/link";
import { getNews, ESPNNews } from "@/lib/api/espn";
import { LEAGUES, leagueName } from "@/types/football";
import FeaturedStory from "@/components/news/FeaturedStory";
import NewsList from "@/components/news/NewsList";
import LeagueSelect from "@/components/news/LeagueSelect";

export const dynamic = "force-dynamic";

async function getAllFootballNews(): Promise<ESPNNews[]> {
  const slugs = LEAGUES.map(l => l.slug);
  const results = await Promise.allSettled(slugs.map(s => getNews(s, 6)));
  const seen = new Set<string>();
  return results
    .filter(r => r.status === "fulfilled")
    .flatMap(r => (r as PromiseFulfilledResult<ESPNNews[]>).value)
    .filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    })
    .sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());
}

interface PageProps {
  searchParams: Promise<{ league?: string }>;
}

export default async function NewsPage({ searchParams }: PageProps) {
  const { league } = await searchParams;

  // Determine mode: specific league | transfer filter | all
  const isTransfer = league === "transfer";
  const isLeague   = !isTransfer && league && LEAGUES.some(l => l.slug === league);
  const selected   = isLeague ? league : null;

  // Fetch - transfer needs all leagues merged, then filter client-side
  const allNews: ESPNNews[] = selected
    ? await getNews(selected, 24)
    : await getAllFootballNews();

  // Apply transfer filter if needed
  const news: ESPNNews[] = isTransfer
    ? allNews.filter(a => a.category === "Transfer")
    : allNews;

  const featured = news[0];
  const rest = news.slice(1);

  const heading = isTransfer
    ? "Transfer News"
    : selected
    ? `${leagueName(selected)} News`
    : "Football News";

  const subheading = isTransfer
    ? "Latest signings, deals and transfer rumours"
    : selected
    ? `Latest stories from ${leagueName(selected)}`
    : "Latest stories across all competitions";

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 40 }}>
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        marginBottom: 24, gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
            {heading}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            {subheading}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <LeagueSelect />
          <Link href="/football" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>
            ← Scores
          </Link>
        </div>
      </div>

      {news.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: "48px 0" }}>
          {isTransfer
            ? "No transfer stories found right now - check back soon."
            : "No news available for this competition right now."}
        </p>
      ) : (
        <>
          {featured && (
            <div style={{ marginBottom: 36 }}>
              <FeaturedStory article={featured} />
            </div>
          )}
          <div className="section-label">
            {isTransfer ? "Transfer Stories" : "All Stories"}
          </div>
          <NewsList articles={rest} initial={9} step={6} />
        </>
      )}
    </div>
  );
}