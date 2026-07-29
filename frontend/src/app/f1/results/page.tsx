import type { Metadata } from "next";
import Link from "next/link";
import { getSchedule, getResults, type RaceWeekend } from "@/lib/api/f1";
import F1Tabs from "@/components/f1/F1Tabs";
import F1YearSelect from "@/components/f1/F1YearSelect";
import { getCountryFlag, formatRaceDate, findDriver } from "@/types/f1";

export const metadata: Metadata = { title: "F1 Results — SportScore" };
export const dynamic = "force-dynamic";

function seasonYears(): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: current - 2019 }, (_, i) => current - i);
}

export default async function F1ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const years = seasonYears();
  const parsed = yearParam ? Number(yearParam) : years[0];
  const year = years.includes(parsed) ? parsed : years[0];
  const yq = year === years[0] ? undefined : year;

  const schedule = await getSchedule(yq);
  const completedRaces = schedule.filter((e) => e.statusState === "post");

  // Winners come from each weekend's own /results/{eventId} (the scoreboard only
  // carries the current weekend, which is why past winners used to show "-").
  const weekends = await Promise.all(completedRaces.map((e) => getResults(e.id, yq)));
  const weekendMap = new Map(
    weekends.filter((w): w is RaceWeekend => w != null).map((w) => [w.id, w])
  );

  return (
    <>
      <F1Tabs />
      <div className="f1-container" style={{ paddingTop: 32, paddingBottom: 60 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, gap: 16, flexWrap: "wrap" }}>
          <h1 className="f1-section-title" style={{ margin: 0 }}>{year} Race Results</h1>
          <F1YearSelect years={years} current={year} />
        </div>
        <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #e8e8e8" }}>
          <table className="f1-standings-table">
            <thead>
              <tr><th>Grand Prix</th><th>Date</th><th>Winner</th><th>Car</th></tr>
            </thead>
            <tbody>
              {completedRaces.map((race) => {
                const weekend = weekendMap.get(race.id);
                const raceSession = weekend?.sessions?.find(
                  (s) => s.type?.toLowerCase().includes("race") && !s.type?.toLowerCase().includes("sprint")
                );
                const winner = raceSession?.grid?.find((g) => g.position === 1) ?? raceSession?.grid?.[0];
                const winnerInfo = winner ? findDriver(winner.driver) : null;
                const flag = getCountryFlag(race.country || "");
                const gpName = race.name.replace(/Formula 1|Grand Prix|FORMULA 1/gi, "").replace(/\d{4}/g, "").replace(/Aramco|Pirelli|AWS|Heineken|Louis Vuitton|MSC Cruises|Lenovo|Crypto\.com|TAG Heuer|Qatar Airways|Moët & Chandon|Singapore Airlines/gi, "").trim().replace(/^[\s-]+|[\s-]+$/g, "") || race.country || "Grand Prix";
                return (
                  <tr key={race.id}>
                    <td><Link href={`/f1/race/${race.id}`} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#15151e", fontWeight: 600 }}><span>{flag}</span>{gpName}</Link></td>
                    <td style={{ color: "#67676d", fontSize: 13 }}>{formatRaceDate(race.startDate, race.endDate)}</td>
                    <td>{winner ? (<div style={{ display: "flex", alignItems: "center", gap: 8 }}>{winnerInfo && <img src={winnerInfo.image} alt="" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", objectPosition: "top" }} />}<span style={{ fontWeight: 600 }}>{winner.driver}</span></div>) : "-"}</td>
                    <td style={{ color: "#67676d", fontSize: 13 }}>{yq === undefined ? (winnerInfo?.team || "-") : "-"}</td>
                  </tr>
                );
              })}
              {completedRaces.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", color: "#67676d", padding: 40 }}>No race results available for {year}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}