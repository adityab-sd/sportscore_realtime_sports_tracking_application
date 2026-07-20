"use client";
import Link from "next/link";
import { BBNews } from "@/lib/api/basketball";
import { Clock } from "lucide-react";

function timeAgo(iso: string): string {
  if (!iso) return "";
  // ADDRESSED: future/offset dates collapse to "Just now": negative diffs from bad timezone assumptions pass h < 1. EXAMPLE: const t = Date.parse(iso); if (!Number.isFinite(t) || t > Date.now()) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return "";
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

export default function FeaturedStory({ article }: { article: BBNews }) {
  // ADDRESSED: route id assumption: an empty article.id builds /basketball/news/ and sends users to a broken detail page. EXAMPLE: if (!article.id) return null;
  return (
    <Link href={`/basketball/news/${article.id}`} style={{ textDecoration: "none" }}>
      <article className="card-hover" style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", display: "grid", gridTemplateColumns: "1.4fr 1fr" }} >
        <div style={{ aspectRatio: "16/10", background: "var(--cloud)", position: "relative", overflow: "hidden" }}>
          {article.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.image} alt={article.headline}
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
        </div>
        <div style={{ padding: "clamp(20px,3vw,32px)", display: "flex", flexDirection: "column", gap: 12, justifyContent: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "#EA580C", background: "#FEF3C7", padding: "4px 10px", borderRadius: 16, alignSelf: "flex-start" }}>
            {article.category}
          </span>
          <h2 style={{ fontSize: "clamp(20px,2.5vw,26px)", fontWeight: 800, color: "var(--obsidian)", margin: 0, lineHeight: 1.2, letterSpacing: "-0.4px" }}>
            {article.headline}
          </h2>
          {article.description && (
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {article.description}
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            <Clock size={12} />
            <span suppressHydrationWarning>{timeAgo(article.published)}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}