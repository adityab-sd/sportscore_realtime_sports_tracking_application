import type { Metadata } from "next";
import Link from "next/link";
import { getNews } from "@/lib/api/f1";
import F1Tabs from "@/components/f1/F1Tabs";

export const metadata: Metadata = { title: "F1 News — SportScore" };
export const dynamic = "force-dynamic";

export default async function F1NewsPage() {
  const news = await getNews(24);
  return (
    <>
      <F1Tabs />
      <div className="f1-container" style={{ paddingTop: 32, paddingBottom: 60 }}>
        <h1 className="f1-section-title" style={{ marginBottom: 28 }}>Latest F1 News</h1>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {news.map((article) => (
            <Link key={article.id} href={`/f1/news/${article.id}`} className="f1-news-card">
              {article.image && <img src={article.image} alt="" />}
              <div className="news-body">
                <div className="news-cat">{article.category}</div>
                <div className="news-headline">{article.headline}</div>
                <div style={{ fontSize: 12, color: "#67676d", marginTop: 8, lineHeight: 1.5 }}>
                  {article.description?.slice(0, 120)}{article.description && article.description.length > 120 ? "..." : ""}
                </div>
              </div>
            </Link>
          ))}
          {news.length === 0 && <p style={{ color: "#67676d", gridColumn: "1 / -1", textAlign: "center", padding: 40 }}>No news available.</p>}
        </div>
      </div>
    </>
  );
}
