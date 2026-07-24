"use client";
import { useState } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// Shared article interface — both ESPNNews and BBNews satisfy this shape.
// Instead of importing a sport-specific type, we declare the minimum fields
// this component actually uses. This is the "structural typing" approach.
// ─────────────────────────────────────────────────────────────────────────────
export interface NewsArticle {
  id: string;
  headline: string;
  description: string;
  published: string;
  image: string | null;
  category: string;
  link?: string | null;
}

interface NewsCardProps {
  article: NewsArticle;
  /**
   * Which sport this article belongs to.
   * Determines the internal route: /football/news/[id] or /basketball/news/[id]
   * Defaults to "football" so existing usages don't need updating.
   */
  sport?: "football" | "basketball";
  /**
   * Optional extra classes merged onto the outer <Link>. Purely additive —
   * omit it and NewsCard behaves exactly as before. Used e.g. when stacking
   * a few cards next to a taller sibling (like the home page's carousel)
   * and you want them to divide that height evenly: pass "lg:flex-1 lg:min-h-0"
   * from a `flex flex-col` parent.
   */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Category → gradient map. Football and basketball categories coexist here.
// ─────────────────────────────────────────────────────────────────────────────
const CAT_GRADIENTS: Record<string, string> = {
  // Football
  "Transfers":        "linear-gradient(135deg, #1e3a5f 0%, #003f88 100%)",
  "Premier League":   "linear-gradient(135deg, #38003c 0%, #7B1FA2 100%)",
  "Champions League": "linear-gradient(135deg, #003f88 0%, #1565C0 100%)",
  "La Liga":          "linear-gradient(135deg, #B71C1C 0%, #E53935 100%)",
  "Serie A":          "linear-gradient(135deg, #0D47A1 0%, #1976D2 100%)",
  "Bundesliga":       "linear-gradient(135deg, #B71C1C 0%, #FF6F00 100%)",
  "World Cup":        "linear-gradient(135deg, #004D40 0%, #00897B 100%)",
  "Ligue 1":          "linear-gradient(135deg, #091c3e 0%, #1565C0 100%)",
  "MLS":              "linear-gradient(135deg, #4f1681 0%, #7B1FA2 100%)",
  // Basketball
  "NBA":              "linear-gradient(135deg, #C9082A 0%, #17408B 100%)",
  "WNBA":             "linear-gradient(135deg, #FF6900 0%, #C9082A 100%)",
  "NCAA":             "linear-gradient(135deg, #002868 0%, #BF0A30 100%)",
  "EuroLeague":       "linear-gradient(135deg, #00205B 0%, #003f88 100%)",
  // Fallback
  "default":          "linear-gradient(135deg, #003f88 0%, #0066ff 100%)",
};

function timeAgo(iso: string): string {
  // ============================================================================
  // ADDRESSED: avoid Date.now() in card render
  // ----------------------------------------------------------------------------
  // Relative time is computed during render and then suppressed for hydration,
  // which can hide timezone/clock mismatches and leaves labels stale until some
  // unrelated state change re-renders the card.
  //
  // EXAMPLE:
  //   const publishedLabel = formatDistanceToNowStrict(new Date(article.published), { addSuffix: true });
  //   <NewsCard article={{ ...article, publishedLabel }} />
  // ============================================================================
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return "";
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ImageSlot({ src, category }: { src: string | null; category: string }) {
  const [failed, setFailed] = useState(false);
  const gradient = CAT_GRADIENTS[category] ?? CAT_GRADIENTS["default"];

  if (!src || failed) {
    return (
      <div style={{ position: "absolute", inset: 0, background: gradient, display: "flex", alignItems: "flex-end", padding: "10px 12px" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
          {category}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" onError={() => setFailed(true)}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
  );
}

export default function NewsCard({ article, sport = "football", className }: NewsCardProps) {
  const href = `/${sport}/news/${article.id}`;

  return (
    <Link href={href} className={className} style={{ textDecoration: "none" }}>
      <article className="news-card card-hover" style={{
        background: "var(--white)", border: "1px solid var(--border)",
        borderRadius: 12, height: "100%", display: "flex", flexDirection: "column",
      }}>
        {/* Thumbnail */}
        <div style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden", borderRadius: "12px 12px 0 0", background: "var(--cloud)" }}>
          <ImageSlot src={article.image} category={article.category} />
          <span style={{
            position: "absolute", top: 10, left: 10,
            background: "rgba(255,255,255,0.95)", color: "var(--navy)",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.5px",
            textTransform: "uppercase", padding: "3px 8px", borderRadius: 4,
            backdropFilter: "blur(4px)",
          }}>{article.category}</span>
        </div>

        {/* Body */}
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", flex: 1 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--obsidian)", lineHeight: 1.35, margin: "0 0 8px" }}>
            {article.headline}
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55, margin: "0 0 14px", flex: 1, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {article.description}
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }} suppressHydrationWarning>
              {timeAgo(article.published)}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--navy)" }}>Read →</span>
          </div>
        </div>
      </article>
    </Link>
  );
}