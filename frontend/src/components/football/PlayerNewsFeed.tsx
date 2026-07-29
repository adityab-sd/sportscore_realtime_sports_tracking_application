"use client";

import { useState } from "react";
import type { RawJSON } from "@/lib/api/espn";
import { Clock } from "lucide-react";
import PlayerNewsModal from "./PlayerNewsModal";

interface ParsedArticle {
  id: string;
  headline: string;
  description: string;
  published: string;
  image: string | null;
  link: string | null;
}

function parseArticles(data: RawJSON): ParsedArticle[] {
  if (!data) return [];
  const articles = data.articles ?? data.news ?? [];
  if (!Array.isArray(articles)) return [];

  return articles
    .filter((a: RawJSON) => a != null)
    .map((a: RawJSON, i: number) => ({
      id: a?.id ?? String(i),
      headline: a?.headline ?? "Untitled",
      description: a?.description ?? "",
      published: a?.published ?? "",
      image: a?.images?.[0]?.url ?? null,
      link: a?.links?.web?.href ?? null,
    }));
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

// `sport`/`athleteId` are accepted so existing call sites keep compiling, but the
// feed now opens an in-app modal instead of routing, so they're unused here.
export default function PlayerNewsFeed({ data }: { data: RawJSON; sport?: string; athleteId?: string }) {
  const articles = parseArticles(data);
  const [selected, setSelected] = useState<ParsedArticle | null>(null);
  if (articles.length === 0) return null;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {articles.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelected(a)}
            style={{ textAlign: "left", cursor: "pointer", background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", padding: 0, width: "100%", font: "inherit" }}
          >
            <div style={{ display: "flex", gap: 12, padding: "12px 14px" }}>
              {a.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.image} alt={a.headline} style={{ width: 72, height: 48, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", lineHeight: 1.3, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {a.headline}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {a.published && (
                    <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-muted)" }}>
                      <Clock size={10} />
                      <span suppressHydrationWarning>{timeAgo(a.published)}</span>
                    </span>
                  )}
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--navy)" }}>Read →</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selected && <PlayerNewsModal article={selected} onClose={() => setSelected(null)} />}
    </>
  );
}