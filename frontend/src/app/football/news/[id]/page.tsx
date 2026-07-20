import { notFound } from "next/navigation";
import Link from "next/link";
import { getNews, ESPNNews } from "@/lib/api/espn";
import { LEAGUES } from "@/types/football";
import { ArrowLeft, Clock, ExternalLink } from "lucide-react";
import NewsCard from "@/components/news/NewsCard";

export const dynamic = "force-dynamic";

async function findArticleAndRelated(id: string): Promise<{ article: ESPNNews | null; related: ESPNNews[] }> {
  // ============================================================================
  // PLEASE review — Separate article misses from upstream failures
  // ----------------------------------------------------------------------------
  // Rejected league news fetches are ignored, so an ESPN/backend outage can become
  // a 404 for a valid article. Track all-failed or partial-failed fetches separately.
  //
  // EXAMPLE:
  //   if (results.every(r => r.status === "rejected")) throw new Error("Unable to load article");
  // ============================================================================
  const results = await Promise.allSettled(
    LEAGUES.map(l => getNews(l.slug, 20))
  );
  const seen = new Set<string>();
  const all: ESPNNews[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const a of r.value) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      all.push(a);
    }
  }
  const article = all.find(a => a.id === id) ?? null;
  const related = [
    ...all.filter(a => a.id !== id && a.category === article?.category),
    ...all.filter(a => a.id !== id && a.category !== article?.category),
  ].slice(0, 3);
  return { article, related };
}

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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ArticlePage({ params }: PageProps) {
  const { id } = await params;

  // ============================================================================
  // PLEASE review — Validate article id shape
  // ----------------------------------------------------------------------------
  // The dynamic id is used as a lookup key without any shape check. Reject obviously
  // invalid ids before fan-out fetching every league.
  //
  // EXAMPLE:
  //   if (!/^\d+$/.test(id)) return notFound();
  // ============================================================================
  const { article, related } = await findArticleAndRelated(id);
  if (!article) notFound();

  return (
    <div style={{ minHeight: "100vh", background: "var(--white)" }}>

      {/* Hero - full width with all overlays inside */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", overflow: "hidden", background: "var(--obsidian)" }}>

        {/* Image */}
        {article.image && (
          <img
            src={article.image}
            alt={article.headline}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
          />
        )}

        {/* Dark overlay so text is readable */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.0) 60%, rgba(255,255,255,0.95) 100%)" }} />

        {/* Back bar - top of image */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}>
          <div className="container" style={{ height: 48, display: "flex", alignItems: "center", gap: 16 }}>
            <Link href="/football/news" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)", textDecoration: "none", background: "rgba(0,0,0,0.25)", padding: "5px 12px", borderRadius: 20, backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <ArrowLeft size={14} />
              Back to News
            </Link>
          </div>
        </div>

        {/* Category + time - bottom of image, above white fade */}
        <div style={{ position: "absolute", bottom: "4%", left: 0, right: 0, zIndex: 10 }}>
          <div className="container" style={{ maxWidth: 760 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)", padding: "5px 12px 5px 5px", borderRadius: 20 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "#fff", background: "var(--blue)", padding: "4px 10px", borderRadius: 16 }}>
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

      {/* Article content */}
      <div className="container" style={{ maxWidth: 760, paddingTop: 28, paddingBottom: 16 }}>

        {/* Headline */}
        <h1 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, color: "var(--obsidian)", lineHeight: 1.15, letterSpacing: "-0.7px", margin: "0 0 24px" }}>
          {article.headline}
        </h1>

        {/* Pull quote description */}
        {article.description && (
          <div style={{ borderLeft: "3px solid var(--blue)", paddingLeft: 20, marginBottom: 36 }}>
            <p style={{ fontSize: 18, color: "var(--text-secondary)", lineHeight: 1.75, margin: 0, fontWeight: 400, fontStyle: "italic" }}>
              {article.description}
            </p>
          </div>
        )}

        {/* Source + ESPN link */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, paddingTop: 20, borderTop: "1px solid var(--border)", marginBottom: 56 }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Source: ESPN</p>
          {article.link && (
            <a href={article.link} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "var(--navy-light)", padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>
              <ExternalLink size={13} />
              Full article on ESPN
            </a>
          )}
        </div>
      </div>

      {/* Related stories */}
      {related.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)", background: "var(--cloud)", paddingTop: 40, paddingBottom: 56 }}>
          <div className="container">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--obsidian)", margin: 0, letterSpacing: "-0.4px" }}>More Stories</h2>
              <Link href="/football/news" style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>All news →</Link>
            </div>
            <div className="news-grid">
              {related.map(a => <NewsCard key={a.id} article={a} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}