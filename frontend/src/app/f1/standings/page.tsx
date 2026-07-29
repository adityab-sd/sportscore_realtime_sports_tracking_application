import type { Metadata } from "next";
import { getStandings } from "@/lib/api/f1";
import F1Tabs from "@/components/f1/F1Tabs";
import F1YearSelect from "@/components/f1/F1YearSelect";
import StandingsPageClient from "@/components/f1/StandingsPageClient";

export const metadata: Metadata = {
  title: "F1 Standings — SportScore",
  description: "Formula 1 driver and constructor championship standings by season.",
};

export const dynamic = "force-dynamic";

// Current season down to 2020 — the seasons ESPN reliably exposes standings for.
function seasonYears(): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: current - 2019 }, (_, i) => current - i);
}

export default async function F1StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const years = seasonYears();
  const parsed = yearParam ? Number(yearParam) : years[0];
  const year = years.includes(parsed) ? parsed : years[0];

  // Pass undefined for the current season so it uses the stable, cached default path.
  const standings = await getStandings(year === years[0] ? undefined : year);

  return (
    <>
      <F1Tabs />
      <div className="f1-container" style={{ paddingTop: 32, paddingBottom: 60 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, gap: 16, flexWrap: "wrap" }}>
          <h1 className="f1-section-title" style={{ margin: 0 }}>{year} Season</h1>
          <F1YearSelect years={years} current={year} />
        </div>
        <StandingsPageClient standings={standings} />
      </div>
    </>
  );
}