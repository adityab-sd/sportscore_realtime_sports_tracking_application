"use client";

import Link from "next/link";
import type { RawJSON } from "@/lib/api/basketball";
import { Clock } from "lucide-react";

interface ParsedArticle {
  id: string;
  headline: string;
  description: string;
  published: string;
  image: string | null;
  link: string | null;
}

function parseArticles(data: RawJSON): ParsedArticle[] {
  const articles = data?.articles ?? data?.news ?? [];
  if (!Array.isArray(articles)) return [];

  return articles.map((a: RawJSON, i: number) => ({
    id: a.id ?? String(i),
    headline: a.headline ?? "Untitled",
    description: a.description ?? "",
    published: a.published ?? "",
    image: a.images?.[0]?.url ?? null,
    // PLEASE review — external URL trust: rendering API-provided href directly can allow unsupported protocols. EXAMPLE: link: /^https?:\/\//.test(String(a.links?.web?.href ?? "")) ? a.links.web.href : null,
    link: a.links?.web?.href ?? null,
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

export default function PlayerNewsFeed({ data }: { data: RawJSON }) {
  const articles = parseArticles(data);
  if (articles.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {articles.map((a) => (
        <div key={a.id} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 12, padding: "12px 14px" }}>
            {/* PLEASE review — meaningful news image has empty alt text: screen-reader users lose the article context. EXAMPLE: alt={a.headline}. */}
            {a.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.image}
                alt=""
                style={{ width: 72, height: 48, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
              />
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
                {a.link && (
                  <Link
                    href={a.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}
                  >
                    Read →
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
