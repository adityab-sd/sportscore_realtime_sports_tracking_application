import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getNews } from "@/lib/api/f1";
import NewsArticleView from "@/components/news/NewsArticleView";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const news = await getNews(30);
  const article = news.find(a => a.id === id);
  return { title: article ? `${article.headline} — F1 News` : "F1 News — SportScore" };
}

interface PageProps { params: Promise<{ id: string }> }

export default async function F1NewsDetailPage({ params }: PageProps) {
  const { id } = await params;
  const news = await getNews(30);
  const article = news.find(a => a.id === id);
  if (!article) return notFound();
  const related = [
    ...news.filter(a => a.id !== id && a.category === article.category),
    ...news.filter(a => a.id !== id && a.category !== article.category),
  ].slice(0, 3);
  return <NewsArticleView article={article} related={related} sport="f1" />;
}