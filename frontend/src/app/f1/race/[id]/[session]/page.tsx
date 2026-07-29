import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getResults } from "@/lib/api/f1";
import { getCountryFlag } from "@/types/f1";
import { cleanGpName } from "@/types/f1-race";
import F1Tabs from "@/components/f1/F1Tabs";
import F1ResultsTable from "@/components/f1/F1ResultsTable";

export const dynamic = "force-dynamic";

function toYear(v?: string): number | undefined {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; session: string }>;
  searchParams: Promise<{ year?: string }>;
}): Promise<Metadata> {
  const { id, session } = await params;
  const { year } = await searchParams;
  const weekend = await getResults(id, toYear(year));
  const s = weekend?.sessions.find((x) => x.id === session);
  const gp = weekend ? cleanGpName(weekend.name, weekend.country || "") : "F1 Race";
  return { title: s ? `${gp} — ${s.label} — SportScore` : "F1 Results — SportScore" };
}

export default async function SessionResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; session: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { id, session } = await params;
  const { year: yearParam } = await searchParams;
  const year = toYear(yearParam);
  const yq = year ? `?year=${year}` : "";

  const weekend = await getResults(id, year);
  if (!weekend) return notFound();

  const s = weekend.sessions.find((x) => x.id === session);
  if (!s) return notFound();

  const flag = getCountryFlag(weekend.country || "");
  const gpName = cleanGpName(weekend.name, weekend.country || "");

  return (
    <>
      <F1Tabs />

      {/* header */}
      <div style={{ background: "#15151e", color: "#fff" }}>
        <div className="f1-container" style={{ paddingTop: 28, paddingBottom: 28 }}>
          <Link href={`/f1/race/${id}${yq}`} style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>
            ← {flag} {gpName}
          </Link>
          <h1 style={{ fontSize: "clamp(22px, 4vw, 34px)", fontWeight: 900, margin: "10px 0 0", fontStyle: "italic" }}>{s.label} result</h1>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
            {weekend.circuit}
            {weekend.city ? ` · ${weekend.city}` : ""}
            {weekend.country ? `, ${weekend.country}` : ""}
          </div>
        </div>
      </div>

      {/* full classification */}
      <div style={{ background: "#f7f4f1" }}>
        <div className="f1-container" style={{ paddingTop: 32, paddingBottom: 64 }}>
          <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, overflow: "hidden" }}>
            <F1ResultsTable rows={s.grid ?? []} />
          </div>
        </div>
      </div>
    </>
  );
}