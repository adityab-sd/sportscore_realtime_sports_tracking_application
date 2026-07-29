import Link from "next/link";
import { ArrowLeft, Clock, ExternalLink } from "lucide-react";
import NewsCard, { NewsArticle } from "@/components/news/NewsCard";

// ─────────────────────────────────────────────────────────────────────────────
// Shared article-detail view for every sport's /news/[id] page.
// One component = one place to style, so the four sports stay uniform.
// Per-sport accent keeps each section's identity (F1 red, others navy/blue)
// while the layout stays identical.
// ─────────────────────────────────────────────────────────────────────────────

type Sport = "football" | "basketball" | "baseball" | "f1";

const SPORT_THEME: Record<Sport, { accent: string; newsHref: string }> = {
  football:   { accent: "var(--blue)", newsHref: "/football/news" },
  basketball: { accent: "var(--blue)", newsHref: "/basketball/news" },
  baseball:   { accent: "var(--blue)", newsHref: "/baseball/news" },
  f1:         { accent: "#e10600",     newsHref: "/f1/news" },
};

function timeAgo(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return "";
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

export default function NewsArticleView({
  article,
  related,
  sport,
}: {
  article: NewsArticle;
  related: NewsArticle[];
  sport: Sport;
}) {
  const theme = SPORT_THEME[sport];
  const published = article.published
    ? new Date(article.published).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <div className="news-article" style={{ minHeight: "100vh", background: "var(--white)" }}>
      {/* ── Hero ── */}
      <div className="news-article__hero" style={{ position: "relative", width: "100%", overflow: "hidden", background: "var(--obsidian)" }}>
        {article.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.image}
            alt={article.headline}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
          />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.12) 38%, rgba(0,0,0,0) 60%, rgba(255,255,255,0.96) 100%)" }} />

        {/* Back link */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}>
          <div className="container" style={{ height: 56, display: "flex", alignItems: "center" }}>
            <Link
              href={theme.newsHref}
              className="news-article__back"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.92)", textDecoration: "none", background: "rgba(0,0,0,0.28)", padding: "6px 13px", borderRadius: 20, backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.16)" }}
            >
              <ArrowLeft size={14} />
              Back to News
            </Link>
          </div>
        </div>

        {/* Category + time chip */}
        <div style={{ position: "absolute", bottom: "6%", left: 0, right: 0, zIndex: 10 }}>
          <div className="container" style={{ maxWidth: 760 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.38)", backdropFilter: "blur(6px)", padding: "5px 12px 5px 5px", borderRadius: 20 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "#fff", background: theme.accent, padding: "4px 10px", borderRadius: 16 }}>
                {article.category}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>
                <Clock size={11} />
                <span suppressHydrationWarning>{timeAgo(article.published)}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <article className="container news-article__body" style={{ maxWidth: 760, paddingTop: 30, paddingBottom: 8 }}>
        <h1 style={{ fontSize: "clamp(26px, 4.5vw, 40px)", fontWeight: 800, color: "var(--obsidian)", lineHeight: 1.15, letterSpacing: "-0.7px", margin: "0 0 20px" }}>
          {article.headline}
        </h1>

        {article.description && (
          <p
            className="news-article__lead"
            style={{ fontSize: "clamp(16px, 2.2vw, 19px)", color: "var(--text-secondary)", lineHeight: 1.7, margin: "0 0 32px", borderLeft: `3px solid ${theme.accent}`, paddingLeft: 18 }}
          >
            {article.description}
          </p>
        )}

        {/* Source + CTA */}
        <div className="news-article__meta" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {published && <>{published} · </>}Source: ESPN
          </div>
          {article.link && (
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="news-article__cta"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 14, fontWeight: 700, color: "#fff", background: theme.accent, padding: "11px 18px", borderRadius: 10, textDecoration: "none" }}
            >
              Read the full story on ESPN
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </article>

      {/* ── More stories ── */}
      {related.length > 0 && (
        <section style={{ borderTop: "1px solid var(--border)", background: "var(--cloud)", marginTop: 48, paddingTop: 40, paddingBottom: 56 }}>
          <div className="container">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--obsidian)", margin: 0, letterSpacing: "-0.4px" }}>More Stories</h2>
              <Link href={theme.newsHref} style={{ fontSize: 13, fontWeight: 600, color: theme.accent, textDecoration: "none" }}>All news →</Link>
            </div>
            <div className="news-grid">
              {related.map((a) => (
                <NewsCard key={a.id} article={a} sport={sport} />
              ))}
            </div>
          </div>
        </section>
      )}

      <style>{`
        .news-article__hero { aspect-ratio: 16 / 9; max-height: 460px; min-height: 240px; }
        .news-article__cta:hover { opacity: 0.9; }
        .news-article__back:hover { background: rgba(0,0,0,0.4); }
        @media (max-width: 640px) {
          .news-article__hero { aspect-ratio: 4 / 3; max-height: 300px; }
          .news-article__meta { flex-direction: column; align-items: stretch; }
          .news-article__cta { width: 100%; }
        }
      `}</style>
    </div>
  );
}
