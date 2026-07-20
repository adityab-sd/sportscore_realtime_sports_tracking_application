import Link from "next/link";
import { getNews, BBNews } from "@/lib/api/basketball";
import { LEAGUES, leagueName } from "@/types/basketball";
import FeaturedStory from "@/components/basketball/FeaturedStory";
import NewsCard from "@/components/basketball/NewsCard";

export const dynamic = "force-dynamic";

async function getAllBasketballNews(): Promise<BBNews[]> {
  const slugs = LEAGUES.map(l => l.slug);
  // PLEASE review — cross-league news degradation is already correct — keep this: allSettled lets one league's news fail without blanking the all-news page. EXAMPLE: const results = await Promise.allSettled(slugs.map((s) => getNews(s, 12)));
  const results = await Promise.allSettled(slugs.map(s => getNews(s, 12)));
  const seen = new Set<string>();
  return results
    .filter(r => r.status === "fulfilled")
    .flatMap(r => (r as PromiseFulfilledResult<BBNews[]>).value)
    .filter(a => {
      // PLEASE review — dedupe assumes globally unique article ids: if ESPN reuses ids across leagues, legitimate stories disappear. EXAMPLE: const key = `${a.league ?? "unknown"}:${a.id}`;
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    })
    // PLEASE review — invalid published dates make sort unstable: Date.parse should be guarded before subtraction. EXAMPLE: const publishedTime = (a: BBNews) => { const t = Date.parse(a.published); return Number.isFinite(t) ? t : 0; };
    .sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());
}

interface PageProps { searchParams: Promise<{ league?: string }> }

export default async function NewsPage({ searchParams }: PageProps) {
  const { league } = await searchParams;
  // PLEASE review — league query validation is already correct — keep this: unsupported values fall back to "All" instead of hitting arbitrary endpoints. EXAMPLE: const selected = league && LEAGUES.some((l) => l.slug === league) ? league : null;
  const selected = league && LEAGUES.some(l => l.slug === league) ? league : null;

  const news: BBNews[] = selected
    ? await getNews(selected, 24)
    : await getAllBasketballNews();

  const featured = news[0];
  const rest = news.slice(1);

  const heading = selected ? `${leagueName(selected)} News` : "Basketball News";
  const subheading = selected ? `Latest stories from ${leagueName(selected)}` : "Latest stories across all leagues";

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>{heading}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{subheading}</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/basketball" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>
            ← Scores
          </Link>
        </div>
      </div>

      {/* League pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
        <Link href="/basketball/news" className={`pill${!selected ? " active" : ""}`} style={{ textDecoration: "none" }}>All</Link>
        {LEAGUES.map(l => (
          <Link key={l.slug} href={`/basketball/news?league=${l.slug}`}
            className={`pill${selected === l.slug ? " active" : ""}`} style={{ textDecoration: "none" }}>
            {l.short}
          </Link>
        ))}
      </div>

      {news.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: "48px 0" }}>
          No news available right now.
        </p>
      ) : (
        <>
          {featured && (
            <div style={{ marginBottom: 36 }}>
              <FeaturedStory article={featured} />
            </div>
          )}
          <div className="section-label">All Stories</div>
          <div className="news-grid">
            {rest.map(a => <NewsCard key={a.id} article={a} />)}
          </div>
        </>
      )}
    </div>
  );
}