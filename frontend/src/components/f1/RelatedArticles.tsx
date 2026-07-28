import Link from "next/link";
import type { CSSProperties } from "react";

export interface ArticleCard {
  title: string;
  href: string;
  date?: string;
  image?: string;
  category?: string;
}

const clamp3: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

export default function RelatedArticles({ articles }: { articles: ArticleCard[] }) {
  if (!Array.isArray(articles) || articles.length === 0) return null;

  return (
    <section id="news" style={{ marginBottom: 8 }}>
      <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 16px", fontStyle: "italic", color: "#15151e" }}>Related articles</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
        {articles.map((a, i) => (
          <Link
            key={i}
            href={a.href}
            style={{
              display: "flex",
              flexDirection: "column",
              background: "#fff",
              border: "1px solid #e8e8e8",
              borderRadius: 14,
              overflow: "hidden",
              textDecoration: "none",
              color: "#15151e",
            }}
          >
            <div style={{ position: "relative", aspectRatio: "16 / 9", background: "#e6e6ea" }}>
              {a.image && <img src={a.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              {a.category && (
                <span
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    background: "#e10600",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    padding: "3px 8px",
                    borderRadius: 4,
                  }}
                >
                  {a.category}
                </span>
              )}
            </div>
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              {a.date && <time style={{ fontSize: 11, fontWeight: 700, color: "#9a9aa0", textTransform: "uppercase", letterSpacing: 0.4 }}>{a.date}</time>}
              <h3 style={{ ...clamp3, margin: 0, fontSize: 15, fontWeight: 800, lineHeight: 1.35 }}>{a.title}</h3>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}