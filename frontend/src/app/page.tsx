import LiveTicker from "@/components/ui/LiveTicker";
import NewsCarousel from "@/components/news/NewsCarousel";
import AllSportsLiveStrip from "@/components/home/AllSportsLiveStrip";
import MultiSportNews from "@/components/home/MultiSportNews";
import { getNews as getFootballNews } from "@/lib/api/espn";
import { getNews as getBasketballNews, BBNews } from "@/lib/api/basketball";
import { ESPNNews } from "@/lib/api/espn";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Fetch news from all active sports and merge into a single carousel feed.
// Add a new sport here when its backend news endpoint is ready.
// ─────────────────────────────────────────────────────────────────────────────
async function getCarouselNews(): Promise<(ESPNNews | BBNews)[]> {
  const [footballNews, basketballNews] = await Promise.allSettled([
    getFootballNews("eng.1", 8),
    getBasketballNews("nba", 8),
    // getBaseballNews("mlb", 8),  ← add future sports here
  ]);

  const seen = new Set<string>();
  const all: (ESPNNews | BBNews)[] = [];

  const append = (items: (ESPNNews | BBNews)[]) => {
    for (const a of items) {
      if (!seen.has(a.id)) { seen.add(a.id); all.push(a); }
    }
  };

  if (footballNews.status   === "fulfilled") append(footballNews.value);
  if (basketballNews.status === "fulfilled") append(basketballNews.value);

  // Interleave by date so carousel feels multi-sport rather than football-first
  return all
    .sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime())
    .slice(0, 8);
}

export default async function HomePage() {
  const carouselNews = await getCarouselNews();

  return (
    <div>
      {/* ── Live scores ticker bar ─────────────────────────────────────── */}
      <LiveTicker />

      {/* ── Hero carousel — mixed football + basketball news ──────────── */}
      {carouselNews.length > 0 ? (
        <section style={{
          background: "var(--cloud)",
          borderBottom: "1px solid var(--border)",
          paddingTop: 28,
          paddingBottom: 32,
        }}>
          <div className="container">
            <div className="section-label" style={{ marginBottom: 14 }}>Top Stories</div>
            {/* sport prop not needed here — carousel links externally via article.link
                when no internal route exists, or we can pass "football" as default.
                NewsCarousel uses href per article so sport doesn't matter for carousel. */}
            <NewsCarousel articles={carouselNews} sport="football" />
          </div>
        </section>
      ) : (
        <section style={{
          background: "linear-gradient(160deg, var(--navy) 0%, #005fcc 100%)",
          padding: "64px 0",
          color: "#fff",
        }}>
          <div className="container" style={{ textAlign: "center", maxWidth: 640 }}>
            <h1 style={{ fontSize: "clamp(32px,6vw,52px)", fontWeight: 800, letterSpacing: "-1px", margin: "0 0 16px" }}>
              Your Real-Time <span style={{ color: "#7FB2FF" }}>Sports Intelligence</span>
            </h1>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.75)", margin: "0 0 28px" }}>
              Live scores, AI commentary and instant answers across Football, Basketball, Cricket and F1.
            </p>
          </div>
        </section>
      )}

      {/* ── Live scores strip — all sports via SignalR ─────────────────── */}
      <div style={{ borderBottom: "1px solid var(--border)" }}>
        <AllSportsLiveStrip />
      </div>

      {/* ── Multi-sport news grid ──────────────────────────────────────── */}
      <MultiSportNews />
    </div>
  );
}