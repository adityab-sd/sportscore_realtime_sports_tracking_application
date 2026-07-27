import Link from "next/link";
import type { ScheduleEntry, RaceWeekend } from "@/lib/api/f1";
import { getCircuitSvg, getCountryFlag, formatRaceDate, findDriver } from "@/types/f1";

interface ScheduleCardProps {
  entry: ScheduleEntry;
  round: number;
  weekend?: RaceWeekend | null;
}

function shortName(driverName: string): string {
  const parts = driverName.split(" ");
  return parts[parts.length - 1]?.slice(0, 3).toUpperCase() || "---";
}

export default function ScheduleCard({ entry, round, weekend }: ScheduleCardProps) {
  const isCurrent = entry.statusState === "in";
  const circuitSvg = getCircuitSvg(entry.name);
  const flag = getCountryFlag(entry.country || "");
  const dateStr = formatRaceDate(entry.startDate, entry.endDate);

  const raceSession = weekend?.sessions?.find(
    s => s.type?.toLowerCase().includes("race") && !s.type?.toLowerCase().includes("sprint")
  );
  // Only show a podium once the race itself has finished. Otherwise grid[0..2] is
  // the qualifying/starting order (e.g. Hungary's NOR/HAM/LEC before the race ran).
  const top3 = raceSession?.statusState === "post" ? raceSession.grid?.slice(0, 3) : null;

  const shortGPName = entry.name
    .replace(/Formula 1|Grand Prix|FORMULA 1/gi, "")
    .replace(/\d{4}/g, "")
    .replace(/Aramco|Pirelli|AWS|Heineken|Louis Vuitton|MSC Cruises|Lenovo|Crypto\.com|TAG Heuer|Qatar Airways|Moët & Chandon|Singapore Airlines/gi, "")
    .trim()
    .replace(/^[\s-]+|[\s-]+$/g, "")
    || entry.country || "Grand Prix";

  return (
    <Link
      href={`/f1/race/${entry.id}`}
      className={`f1-schedule-card${isCurrent ? " is-current" : ""}`}
    >
      <div style={{ padding: "22px 24px", minHeight: 150 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            {!isCurrent && (
              <div style={{ fontSize: 11, fontWeight: 700, color: "#67676d", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
                Round {round}
              </div>
            )}
            {isCurrent && (
              <div style={{
                fontSize: 11, fontWeight: 700, color: "#fff",
                background: "#e10600", display: "inline-block",
                padding: "2px 8px", borderRadius: 4, marginBottom: 6,
                textTransform: "uppercase", letterSpacing: "0.5px",
              }}>
                Round {round}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>{flag}</span>
              <h3 style={{ fontSize: 22, fontWeight: 900, fontStyle: "italic", margin: 0, color: "#15151e" }}>
                {shortGPName}
              </h3>
            </div>
            <div style={{ fontSize: 12, color: "#67676d", marginTop: 4 }}>
              {entry.circuit || ""}
            </div>
          </div>
          {circuitSvg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={circuitSvg}
              alt=""
              style={{ width: 104, height: 78, objectFit: "contain", opacity: 0.18, flexShrink: 0, filter: "invert(0)" }}
            />
          )}
        </div>

        {top3 && top3.length > 0 ? (
          <div className="f1-results-grid">
            {top3.map((d, i) => {
              const dInfo = findDriver(d.driver);
              return (
                <div key={d.driverId} className="result-driver">
                  <span
                    className="result-pos"
                    style={{ background: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : "#CD7F32", color: "#000" }}
                  >
                    {i + 1}
                  </span>
                  {dInfo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={dInfo.image} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover", objectPosition: "top" }} />
                  )}
                  <span>{shortName(d.driver)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 14, fontWeight: 800, color: "#15151e", marginTop: 12, textTransform: "uppercase" }}>
            {dateStr}
          </div>
        )}
      </div>
    </Link>
  );
}