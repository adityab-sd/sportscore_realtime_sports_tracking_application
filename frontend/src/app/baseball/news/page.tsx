import Link from "next/link";
import { getNews, BBNews } from "@/lib/api/baseball";
import { LEAGUES, leagueName } from "@/types/baseball";
import FeaturedStory from "@/components/news/FeaturedStory";
import NewsList from "@/components/news/NewsList";

export const dynamic = "force-dynamic";

interface PageProps { searchParams: Promise<{ league?: string }> }

async function getAllBaseballNews(): Promise<BBNews[]> {
  const slugs = LEAGUES.map(l => l.slug);
  const results = await Promise.allSettled(slugs.map(s => getNews(s, 8)));
  const seen = new Set<string>();
  return results
    .filter(r => r.status === "fulfilled")
    .flatMap(r => (r as PromiseFulfilledResult<BBNews[]>).value)
    .filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; })
    .sort((a, b) => {
      const ta = Date.parse(a.published); const tb = Date.parse(b.published);
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });
}

export default async function NewsPage({ searchParams }: PageProps) {
  const { league } = await searchParams;
  const selected = league && LEAGUES.some(l => l.slug === league) ? league : null;

  const news: BBNews[] = selected ? await getNews(selected, 24) : await getAllBaseballNews();
  const featured = news[0];
  const rest = news.slice(1);

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
            {selected ? `${leagueName(selected)} News` : "Baseball News"}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            {selected ? `Latest stories from ${leagueName(selected)}` : "Latest stories across all competitions"}
          </p>
        </div>
        <Link href="/baseball" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>← Scores</Link>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
        <Link href="/baseball/news" className={`pill${!selected ? " active" : ""}`} style={{ textDecoration: "none" }}>All</Link>
        {LEAGUES.map(l => (
          <Link key={l.slug} href={`/baseball/news?league=${l.slug}`} className={`pill${selected === l.slug ? " active" : ""}`} style={{ textDecoration: "none" }}>
            {l.short}
          </Link>
        ))}
      </div>

      {news.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: "48px 0" }}>
          No news available for this competition right now.
        </p>
      ) : (
        <>
          {featured && (
            <div style={{ marginBottom: 36 }}>
              <FeaturedStory article={featured} sport="baseball" />
            </div>
          )}
          <div className="section-label">All Stories</div>
          <NewsList articles={rest} initial={9} step={6} sport="baseball" />
        </>
      )}
    </div>
  );
}
