import Link from "next/link";
import type { Metadata } from "next";
import { getScoreboard, getFixtures, getNews, BBGame } from "@/lib/api/basketball";
import { LEAGUES } from "@/types/basketball";
import LiveBasketball from "@/components/basketball/LiveBasketball";

export const metadata: Metadata = {
  title: "Basketball — SportScore",
  description: "Live NBA, WNBA & NCAA basketball scores, standings, and news.",
};

export const dynamic = "force-dynamic";

interface SlugGame extends BBGame { _slug: string }

async function getAllGames(): Promise<BBGame[]> {
  const slugs = LEAGUES.map(l => l.slug);
  const [scoreResults, fixtureResults] = await Promise.all([
    Promise.allSettled(slugs.map(s => getScoreboard(s))),
    Promise.allSettled(slugs.map(s => getFixtures(s))),
  ]);
  const byId = new Map<string, SlugGame>();
  scoreResults.forEach((r, i) => {
    if (r.status !== "fulfilled" || !r.value) return;
    for (const g of r.value) byId.set(g.id, { ...g, _slug: slugs[i] });
  });
  fixtureResults.forEach((r, i) => {
    if (r.status !== "fulfilled" || !r.value) return;
    for (const g of [...r.value.results, ...r.value.upcoming]) {
      if (!byId.has(g.id)) byId.set(g.id, { ...g, _slug: slugs[i] });
    }
  });
  return Array.from(byId.values()).map(g => {
    if (!g.competition || g.competition === "Basketball") {
      const league = LEAGUES.find(l => l.slug === g._slug);
      if (league) return { ...g, competition: league.name };
    }
    return g;
  });
}

async function getTopNews() {
  const results = await Promise.allSettled(LEAGUES.map(l => getNews(l.slug, 6)));
  const articles: { id: string; headline: string; published: string; image: string | null }[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value) continue;
    for (const a of r.value) {
      if (!seen.has(a.id)) { seen.add(a.id); articles.push({ id: a.id, headline: a.headline, published: a.published, image: a.image }); }
    }
  }
  return articles.filter(a => a.image).slice(0, 8);
}

export default async function BasketballPage() {
  const [seedGames, news] = await Promise.all([getAllGames(), getTopNews()]);
  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>Basketball</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Live scores, results &amp; upcoming games</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/basketball/news" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>News</Link>
          <Link href="/basketball/standings" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>Standings</Link>
        </div>
      </div>
      <div className="sport-layout">
        <div className="sport-layout__main"><LiveBasketball seed={seedGames} /></div>
        <aside className="sport-layout__sidebar">
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", position: "sticky", top: 80 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--obsidian)", textTransform: "uppercase", letterSpacing: "0.6px" }}>Latest News</div>
            <div>
              {news.length === 0 && <p style={{ padding: 16, fontSize: 13, color: "var(--text-muted)", margin: 0 }}>No news available.</p>}
              {news.map((a, i) => (
                <Link key={a.id} href={`/basketball/news/${a.id}`} style={{ display: "flex", gap: 10, padding: "12px 16px", borderBottom: i < news.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none" }} className="news-row">
                  {a.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.image} alt="" width={56} height={56} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", lineHeight: 1.3, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.headline}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }} suppressHydrationWarning>{a.published ? new Date(a.published).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</div>
                  </div>
                </Link>
              ))}
            </div>
            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", textAlign: "center" }}>
              <Link href="/basketball/news" style={{ fontSize: 12, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>View all news →</Link>
            </div>
          </div>
        </aside>
      </div>
      <style>{`
        .sport-layout { display: grid; grid-template-columns: 1fr 300px; gap: 28px; align-items: start; }
        .sport-layout__main { min-width: 0; }
        .sport-layout__sidebar { min-width: 0; }
        @media (max-width: 960px) { .sport-layout { grid-template-columns: 1fr 260px; gap: 20px; } }
        @media (max-width: 720px) { .sport-layout { grid-template-columns: 1fr; gap: 24px; } .sport-layout__sidebar > div { position: static !important; } }
      `}</style>
    </div>
  );
}