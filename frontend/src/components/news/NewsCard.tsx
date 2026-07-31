"use client";
import { useState } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// Shared article interface — both ESPNNews and BBNews satisfy this shape.
// ─────────────────────────────────────────────────────────────────────────────
export interface NewsArticle {
  id: string;
  headline: string;
  description: string;
  published: string;
  image: string | null;
  category: string;
  link?: string | null;
  sport?: "football" | "basketball" | "baseball" | "f1";
}

interface NewsCardProps {
  article: NewsArticle;
  sport?: "football" | "basketball" | "baseball" | "f1";
  className?: string;
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

// Track whether the image failed to load, so we can switch to the text-forward
// layout (same as when there's no image URL at all).
// A backend/ESPN "image" can be null, "", whitespace, or a non-http value —
// all of which should fall back to the text-forward layout, not a blank box.
function hasUsableImage(image: string | null | undefined): boolean {
  if (!image) return false;
  const s = image.trim();
  return s.length > 0 && /^https?:\/\//i.test(s);
}

function useImageOk(src: string | null) {
  const [failed, setFailed] = useState(false);
  const ok = hasUsableImage(src) && !failed;
  return { ok, onError: () => setFailed(true) };
}

export default function NewsCard({ article, sport = "football", className }: NewsCardProps) {
  const href = `/${article.sport ?? sport}/news/${article.id}`;
  const img = useImageOk(article.image);

  return (
    <Link href={href} className={className} style={{ textDecoration: "none" }}>
      <article className="news-card card-hover" style={{
        background: "var(--white)", border: "1px solid var(--border)",
        borderRadius: 12, height: "100%", display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Thumbnail — only rendered when we actually have a working image.
            When there's no image, this whole block is skipped and the body
            below grows to fill the card (same overall card size either way). */}
        {img.ok && (
          <div style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden", background: "var(--cloud)", flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.image!} alt="" onError={img.onError}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
            <span style={{
              position: "absolute", top: 10, left: 10,
              background: "rgba(255,255,255,0.95)", color: "var(--navy)",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.5px",
              textTransform: "uppercase", padding: "3px 8px", borderRadius: 4,
              backdropFilter: "blur(4px)",
            }}>{article.category}</span>
          </div>
        )}

        {/* Body — flex:1 makes it fill the card. When there's no image the
            category chip moves inline here, the headline is larger, and the
            description shows more lines so the text fills the freed-up space. */}
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", flex: 1 }}>
          {!img.ok && (
            <span style={{
              display: "inline-block", alignSelf: "flex-start",
              background: "var(--navy-light)", color: "var(--navy)",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.5px",
              textTransform: "uppercase", padding: "3px 8px", borderRadius: 4,
              marginBottom: 10,
            }}>{article.category}</span>
          )}

          <h3 style={{
            fontSize: img.ok ? 15 : 18, fontWeight: 700, color: "var(--obsidian)",
            lineHeight: 1.32, margin: "0 0 8px",
          }}>
            {article.headline}
          </h3>

          <p style={{
            fontSize: img.ok ? 13 : 14, color: "var(--text-secondary)", lineHeight: 1.55,
            margin: "0 0 14px", flex: 1, display: "-webkit-box",
            WebkitLineClamp: img.ok ? 3 : 7,   // more lines when text-only
            WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {article.description}
          </p>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
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