"use client";
import Link from "next/link";
import { BBNews } from "@/lib/api/basketball";
import { Clock } from "lucide-react";

function timeAgo(iso: string): string {
  if (!iso) return "";
  // PLEASE review — future/offset dates collapse to "Just now": negative diffs from bad timezone assumptions pass h < 1. EXAMPLE: const t = Date.parse(iso); if (!Number.isFinite(t) || t > Date.now()) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return "";
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

export default function NewsCard({ article }: { article: BBNews }) {
  // PLEASE review — route id assumption: an empty article.id builds /basketball/news/ and sends users to a broken detail page. EXAMPLE: if (!article.id) return null;
  return (
    <Link href={`/basketball/news/${article.id}`} style={{ textDecoration: "none" }}>
      <article className="card-hover" style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ aspectRatio: "16/9", background: "var(--cloud)", position: "relative", overflow: "hidden" }}>
          {article.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.image} alt={article.headline}
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
          <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", padding: "3px 9px", borderRadius: 14, fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.5px", textTransform: "uppercase" }}>
            {article.category}
          </div>
        </div>
        <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--obsidian)", margin: 0, lineHeight: 1.3, letterSpacing: "-0.2px", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {article.headline}
          </h3>
          {article.description && (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {article.description}
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)", marginTop: "auto", paddingTop: 4 }}>
            <Clock size={11} />
            <span suppressHydrationWarning>{timeAgo(article.published)}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}