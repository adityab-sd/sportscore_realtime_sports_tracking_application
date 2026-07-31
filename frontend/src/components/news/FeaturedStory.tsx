"use client";
import { useState } from "react";
import Link from "next/link";
import { NewsArticle } from "./NewsCard";

// ─────────────────────────────────────────────────────────────────────────────
// FeaturedStory — hero article + optional side articles.
// The hero keeps a gradient background when there's no image, because the
// headline/description sit ON TOP of the image via an overlay — so it always
// looks intentional. The side cards instead DROP the image slot when there's
// no image and let the headline fill the row (same card height either way).
// ─────────────────────────────────────────────────────────────────────────────

interface FeaturedStoryProps {
  article: NewsArticle;
  side?: NewsArticle[];
  sport?: "football" | "basketball" | "baseball";
}

const fallbackGradient = "linear-gradient(135deg, var(--navy) 0%, #0066ff 100%)";

function HeroImage({ src, category }: { src: string | null; category: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div style={{ position: "absolute", inset: 0, background: fallbackGradient }} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={category} onError={() => setFailed(true)}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center center" }} />
  );
}

function timeAgo(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return "";
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Side story row — shows an 84×64 thumbnail when an image is available and loads.
// Otherwise the thumbnail is omitted and the text spans the full row width.
function SideStory({ article, newsBase }: { article: NewsArticle; newsBase: string }) {
  const [failed, setFailed] = useState(false);
  const hasImage = !!article.image && !failed;

  return (
    <Link href={`${newsBase}/${article.id}`} style={{ textDecoration: "none" }}>
      <article className="card-hover" style={{
        display: "flex", gap: 12, background: "var(--white)", border: "1px solid var(--border)",
        borderRadius: 10, padding: 10, flex: 1, alignItems: "center",
      }}>
        {hasImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.image!} alt="" onError={() => setFailed(true)}
            style={{ width: 84, height: 64, borderRadius: 7, flexShrink: 0, objectFit: "cover" }} />
        )}
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
            {article.category}
          </span>
          <h3 style={{
            fontSize: 13.5, fontWeight: 700, color: "var(--obsidian)", lineHeight: 1.35,
            margin: "3px 0 0", display: "-webkit-box",
            WebkitLineClamp: hasImage ? 3 : 4,   // one extra line when text spans full width
            WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {article.headline}
          </h3>
        </div>
      </article>
    </Link>
  );
}

export default function FeaturedStory({ article, side, sport = "football" }: FeaturedStoryProps) {
  const newsBase = `/${sport}/news`;

  return (
    <div className="hero-split">
      {/* Main hero */}
      <Link href={`${newsBase}/${article.id}`} style={{ textDecoration: "none" }}>
        <article className="news-card card-hover" style={{
          position: "relative", borderRadius: 14, overflow: "hidden",
          aspectRatio: "16/8", width: "100%", display: "flex",
          alignItems: "flex-end", border: "1px solid var(--border)",
        }}>
          <HeroImage src={article.image} category={article.category} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)" }} />
          <div style={{ position: "relative", padding: "28px 26px", color: "#fff" }}>
            <span style={{ display: "inline-block", background: "var(--blue)", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", padding: "4px 10px", borderRadius: 5, marginBottom: 14 }}>
              {article.category}
            </span>
            <h2 style={{ fontSize: "clamp(22px, 3.5vw, 30px)", fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.5px", margin: "0 0 10px" }}>
              {article.headline}
            </h2>
            {article.description && (
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.82)", lineHeight: 1.55, margin: "0 0 10px", maxWidth: 560, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {article.description}
              </p>
            )}
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }} suppressHydrationWarning>
              {timeAgo(article.published)}
            </span>
          </div>
        </article>
      </Link>

      {/* Side stories */}
      {side && side.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {side.slice(0, 3).map(a => (
            <SideStory key={a.id} article={a} newsBase={newsBase} />
          ))}
        </div>
      )}
    </div>
  );
}