// ADDRESSED: Missing dynamic race page contract — added a proper default export
// with notFound() and id validation so /f1/race/[id] does not crash.
import { notFound } from "next/navigation";

export default async function RacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // ADDRESSED: validate race id before attempting lookup
  if (!/^\d+$/.test(id)) return notFound();
  // F1 race data source is not wired yet — return notFound until the endpoint exists.
  return notFound();
}
