import type { Metadata } from "next";
import { getSchedule, getResults } from "@/lib/api/f1";
import type { RaceWeekend } from "@/lib/api/f1";
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
  const isCurrentSeason = year === years[0];
  const yq = isCurrentSeason ? undefined : year;

  const schedule = await getSchedule(yq);

  // Scoreboard only carries the latest weekend, so podiums for earlier rounds
  // come from each round's own results endpoint (cached per-URL). Long-term,
  // add a `top3` array to the Spring getSchedule DTO to drop these calls.
  const completed = schedule.filter((e) => e.statusState === "post");
  const results = await Promise.all(completed.map((e) => getResults(e.id, yq)));
  const weekendMap = new Map<string, RaceWeekend>();
  for (const w of results) if (w) weekendMap.set(w.id, w);

  const nextId = isCurrentSeason ? schedule.find((e) => e.statusState !== "post")?.id : undefined;

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

        {/* auto-fill keeps it responsive: 3 up on desktop, 2 on tablet, 1 on mobile */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {schedule.map((entry, i) => (
            <ScheduleCard
              key={entry.id}
              entry={entry}
              round={i + 1}
              weekend={weekendMap.get(entry.id)}
              isNext={entry.id === nextId}
              year={yq}
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