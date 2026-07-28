import type { Metadata } from "next";
import { getSchedule, getScoreboard } from "@/lib/api/f1";
import F1Tabs from "@/components/f1/F1Tabs";
import F1YearSelect from "@/components/f1/F1YearSelect";
import ScheduleCard from "@/components/f1/ScheduleCard";

export const metadata: Metadata = {
  title: "F1 Schedule — SportScore",
  description: "Formula 1 race calendar and schedule by season.",
};

export const dynamic = "force-dynamic";

function seasonYears(): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: current - 2019 }, (_, i) => current - i);
}

export default async function F1SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const years = seasonYears();
  const parsed = yearParam ? Number(yearParam) : years[0];
  const year = years.includes(parsed) ? parsed : years[0];
  const yq = year === years[0] ? undefined : year;

  const [schedule, weekends] = await Promise.all([getSchedule(yq), getScoreboard(yq)]);
  const weekendMap = new Map(weekends.map((w) => [w.id, w]));

  return (
    <>
      <F1Tabs />
      <div className="f1-container" style={{ paddingTop: 32, paddingBottom: 60 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          <div>
            <h1 className="f1-section-title" style={{ fontSize: "clamp(24px, 4vw, 36px)", marginBottom: 8 }}>
              Race Calendar {year}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: 0 }}>
              {year} FIA Formula One World Championship™️
            </p>
          </div>
          <F1YearSelect years={years} current={year} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {schedule.map((entry, i) => (
            <ScheduleCard
              key={entry.id}
              entry={entry}
              round={i + 1}
              weekend={weekendMap.get(entry.id)}
            />
          ))}
          {schedule.length === 0 && (
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>No schedule available for {year}.</p>
          )}
        </div>
      </div>
    </>
  );
}