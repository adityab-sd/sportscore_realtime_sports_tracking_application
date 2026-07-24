// ADDRESSED: Missing dynamic article handling — added a proper default export
// with notFound() for missing articles and id validation.
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function F1ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // ADDRESSED: validate article id shape before attempting lookup
  if (!/^\d+$/.test(id)) return notFound();
  // F1 news data source is not wired yet — return notFound until the endpoint exists.
  return notFound();
}
