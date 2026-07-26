import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getNews } from "@/lib/api/f1";
import F1Tabs from "@/components/f1/F1Tabs";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const news = await getNews(30);
  const article = news.find((a) => a.id === id);
  return { title: article ? `${article.headline} — F1 News` : "F1 News — SportScore" };
}

export default async function F1NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const news = await getNews(30);
  const article = news.find((a) => a.id === id);
  if (!article) return notFound();

  const published = article.published ? new Date(article.published).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";

  return (
    <>
      <F1Tabs />
      <div className="f1-container" style={{ paddingTop: 32, paddingBottom: 60, maxWidth: 800 }}>
        <Link href="/f1/news" style={{ fontSize: 13, color: "#e10600", fontWeight: 600, textDecoration: "none", marginBottom: 16, display: "inline-block" }}>← All News</Link>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#e10600", textTransform: "uppercase", marginBottom: 8 }}>{article.category}</div>
        <h1 style={{ fontSize: "clamp(22px, 4vw, 34px)", fontWeight: 900, margin: "0 0 12px", lineHeight: 1.2, color: "#15151e" }}>{article.headline}</h1>
        {published && <div style={{ fontSize: 13, color: "#67676d", marginBottom: 24 }}>{published}</div>}
        {article.image && <img src={article.image} alt="" style={{ width: "100%", borderRadius: 12, marginBottom: 24, maxHeight: 400, objectFit: "cover" }} />}
        <div style={{ fontSize: 15, lineHeight: 1.8, color: "#3a3a3a" }}>{article.description}</div>
        {article.link && <a href={article.link} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 24, fontSize: 13, fontWeight: 600, color: "#e10600", textDecoration: "none" }}>Read full article on ESPN →</a>}
      </div>
    </>
  );
}
