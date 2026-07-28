import { notFound } from "next/navigation";
import { getNews, BBNews } from "@/lib/api/baseball";
import { LEAGUES } from "@/types/baseball";
import NewsArticleView from "@/components/news/NewsArticleView";

export const dynamic = "force-dynamic";

async function findArticleAndRelated(id: string): Promise<{ article: BBNews | null; related: BBNews[] }> {
  const results = await Promise.allSettled(LEAGUES.map(l => getNews(l.slug, 20)));
  const seen = new Set<string>();
  const all: BBNews[] = [];
  for (const r of results) { if (r.status !== "fulfilled") continue; for (const a of r.value) { if (seen.has(a.id)) continue; seen.add(a.id); all.push(a); } }
  const article = all.find(a => a.id === id) ?? null;
  const related = [...all.filter(a => a.id !== id && a.category === article?.category), ...all.filter(a => a.id !== id && a.category !== article?.category)].slice(0, 3);
  return { article, related };
}

interface PageProps { params: Promise<{ id: string }> }

export default async function ArticlePage({ params }: PageProps) {
  const { id } = await params;
  const { article, related } = await findArticleAndRelated(id);
  if (!article) notFound();
  return <NewsArticleView article={article} related={related} sport="baseball" />;
}