import Link from "next/link";
import { getFixtures, getNews, ESPNFixture } from "@/lib/api/espn";
import { LEAGUES, Match } from "@/types/football";
import LiveFootball from "@/components/football/LiveFootball";

export const dynamic = "force-dynamic";

interface SlugFixture extends ESPNFixture { _slug: string }

// Convert ESPN fixture → Match (for seed prop)
function fixtureToMatch(f: SlugFixture): Match {
  const leagueName = LEAGUES.find(l => l.slug === f._slug)?.name ?? f.competition;
  
  return {
    id: Number(f.id),
    sport: "football",
    status: f.status,
    elapsed: null,
    kickoff: f.kickoff,
    competition: f.competition || leagueName,
    homeTeam: { id: Number(f.homeTeam.id), name: f.homeTeam.name, shortName: f.homeTeam.shortName, logo: f.homeTeam.logo },
    awayTeam: { id: Number(f.awayTeam.id), name: f.awayTeam.name, shortName: f.awayTeam.shortName, logo: f.awayTeam.logo },
    homeScore: f.homeScore,
    awayScore: f.awayScore,
    events: [],
  };
}

async function getAllFixtures(): Promise<Match[]> {
  const slugs = LEAGUES.map(l => l.slug);
  const results = await Promise.allSettled(slugs.map(s => getFixtures(s)));
  const seen = new Set<string>();
  const all: SlugFixture[] = [];

  results.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const slug = slugs[i];
    [...r.value.results, ...r.value.upcoming].forEach(f => {
      if (!seen.has(f.id)) { seen.add(f.id); all.push({ ...f, _slug: slug }); }
    });
  });

  return all.map(fixtureToMatch);
}

async function getTopNews() {
  try {
    const [wcNews, plNews, clNews] = await Promise.allSettled([
      getNews("fifa.world", 1),
      getNews("eng.1", 2),
      getNews("spa.1", 3),
      getNews("uefa.champions", 3),
      getNews("bra.1", 2),
    ]);
    const articles: Array<{ id: string; headline: string; description: string; published: string; image: string | null }> = [];
    const seen = new Set<string>();
    for (const r of [wcNews, plNews, clNews]) {
      if (r.status !== "fulfilled") continue;
      for (const a of (r.value as any[]) ?? []) {
        if (!seen.has(String(a.id))) {
          seen.add(String(a.id));
          articles.push({
            id: String(a.id),
            headline: a.headline ?? "",
            description: a.description ?? "",
            published: a.published ?? "",
            image: a.image ?? null,
          });
        }
      }
    }
    return articles.filter(a => a.image).slice(0, 8);
  } catch { return []; }
}

export default async function FootballPage() {
  const [seedMatches, news] = await Promise.all([
    getAllFixtures(),
    getTopNews(),
  ]);

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 800, color: "var(--obsidian)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>Football</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Live scores, results &amp; upcoming fixtures</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/football/news" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>News</Link>
          <Link href="/football/standings" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>Standings</Link>
        </div>
      </div>

      {/* Two-column layout — stacks on mobile */}
      <div className="football-layout">
        <div className="football-layout__main">
          <LiveFootball seed={seedMatches} />
        </div>

        <aside className="football-layout__sidebar">
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", position: "sticky", top: 80 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--obsidian)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
              Latest News
            </div>
            <div>
              {news.length === 0 && (
                <p style={{ padding: 16, fontSize: 13, color: "var(--text-muted)", margin: 0 }}>No news available.</p>
              )}
              {news.map((a, i) => (
                <Link key={a.id} href={`/football/news/${a.id}`}
                  style={{ display: "flex", gap: 10, padding: "12px 16px", borderBottom: i < news.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none", transition: "background 100ms" }}
                  className="news-row">
                  {a.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.image} alt="" width={56} height={56}
                      style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", lineHeight: 1.3, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {a.headline}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {a.published ? new Date(a.published).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", textAlign: "center" }}>
              <Link href="/football/news" style={{ fontSize: 12, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>View all news →</Link>
            </div>
          </div>
        </aside>
      </div>

      {/* Responsive grid */}
      <style>{`
        .football-layout {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 28px;
          align-items: start;
        }
        .football-layout__main { min-width: 0; }
        .football-layout__sidebar { min-width: 0; }
        @media (max-width: 960px) {
          .football-layout { grid-template-columns: 1fr 260px; gap: 20px; }
        }
        @media (max-width: 720px) {
          .football-layout { grid-template-columns: 1fr; gap: 24px; }
          .football-layout__sidebar > div { position: static !important; }
        }
      `}</style>
    </div>
  );
}