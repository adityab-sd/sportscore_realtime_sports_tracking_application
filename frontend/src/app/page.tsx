import Link from "next/link";
import LiveTicker from "@/components/ui/LiveTicker";
import HomeLiveStrip from "@/components/football/HomeLiveStrip";
import NewsCard from "@/components/news/NewsCard";
import NewsCarousel from "@/components/news/NewsCarousel";
import { getNews } from "@/lib/api/espn";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const news = await getNews("eng.1", 16);
  const rest = news.slice(6);

  return (
    <div>
      <LiveTicker />

      {/* Carousel hero */}
      {news.length > 0 ? (
        <section style={{ background: "var(--cloud)", borderBottom: "1px solid var(--border)", paddingTop: 28, paddingBottom: 32 }}>
          <div className="container">
            <div className="section-label">Top Stories</div>
            <NewsCarousel articles={news.slice(0, 6)} />
          </div>
        </section>
      ) : (
        <section style={{ background: "linear-gradient(160deg, var(--navy) 0%, #005fcc 100%)", padding: "64px 0", color: "#fff" }}>
          <div className="container" style={{ textAlign: "center", maxWidth: 640 }}>
            <h1 style={{ fontSize: "clamp(32px,6vw,52px)", fontWeight: 800, letterSpacing: "-1px", margin: "0 0 16px" }}>
              Your Real-Time <span style={{ color: "#7FB2FF" }}>Sports Intelligence</span>
            </h1>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.75)", margin: "0 0 28px" }}>
              Live scores, AI commentary and instant answers across football, cricket, rugby and F1.
            </p>
            <Link href="/football" style={{ display: "inline-block", background: "#fff", color: "var(--navy)", fontWeight: 700, fontSize: 15, padding: "13px 30px", borderRadius: 10, textDecoration: "none" }}>
              View Live Scores
            </Link>
          </div>
        </section>
      )}

      {/* Live strip */}
      <HomeLiveStrip />

      {/* Latest news */}
      <section style={{ paddingTop: 40, paddingBottom: 40 }}>
        <div className="container">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <h2 style={{ fontSize: "clamp(20px,3vw,24px)", fontWeight: 800, color: "var(--obsidian)", margin: 0, letterSpacing: "-0.4px" }}>Latest News</h2>
            <Link href="/football/news" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>All news →</Link>
          </div>
          <div className="news-grid">
            {rest.slice(0, 6).map(a => <NewsCard key={a.id} article={a} />)}
          </div>
        </div>
      </section>
    </div>
  );
}