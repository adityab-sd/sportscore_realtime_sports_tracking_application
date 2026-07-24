"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { NewsArticle } from "@/components/news/NewsCard";

const CAT_GRADIENTS: Record<string, string> = {
  "Transfers": "linear-gradient(135deg, #1e3a5f 0%, #003f88 100%)",
  "Premier League": "linear-gradient(135deg, #38003c 0%, #7B1FA2 100%)",
  "Champions League": "linear-gradient(135deg, #003f88 0%, #1565C0 100%)",
  "La Liga": "linear-gradient(135deg, #B71C1C 0%, #E53935 100%)",
  "Serie A": "linear-gradient(135deg, #0D47A1 0%, #1976D2 100%)",
  "Bundesliga": "linear-gradient(135deg, #B71C1C 0%, #FF6F00 100%)",
  "World Cup": "linear-gradient(135deg, #004D40 0%, #00897B 100%)",
  "Ligue 1": "linear-gradient(135deg, #091c3e 0%, #1565C0 100%)",
  "MLS": "linear-gradient(135deg, #4f1681 0%, #7B1FA2 100%)",
  "default": "linear-gradient(135deg, #003f88 0%, #0066ff 100%)",
};

function timeAgo(iso: string): string {
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

/** Same visual frame as NewsCard, but links straight out to the original source. */
export default function ExternalNewsCard({ article, className }: { article: NewsArticle; className?: string }) {
  const href = article.link || undefined;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={{ textDecoration: "none", pointerEvents: href ? "auto" : "none" }}
    >
      <article className="news-card card-hover" style={{
        background: "var(--white)", border: "1px solid var(--border)",
        borderRadius: 12, height: "100%", display: "flex", flexDirection: "column",
      }}>
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
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--navy)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              Read on source <ExternalLink size={12} />
            </span>
          </div>
        </div>
      </article>
    </a>
  );
}