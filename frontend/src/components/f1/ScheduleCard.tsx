import Link from "next/link";
import type { ScheduleEntry, RaceWeekend } from "@/lib/api/f1";
import { getCircuitSvg, getCountryFlag, formatRaceDate, findDriver } from "@/types/f1";

interface ScheduleCardProps {
  entry: ScheduleEntry;
  round: number;
  weekend?: RaceWeekend | null;
  isNext?: boolean;
  year?: number;
}

function shortName(driverName: string): string {
  const parts = driverName.split(" ");
  return parts[parts.length - 1]?.slice(0, 3).toUpperCase() || "---";
}

export default function ScheduleCard({ entry, round, weekend, isNext = false, year }: ScheduleCardProps) {
  const isCurrent = entry.statusState === "in";
  const circuitSvg = getCircuitSvg(entry.name);
  const flag = getCountryFlag(entry.country || "");
  const dateStr = formatRaceDate(entry.startDate, entry.endDate);

  // Carry the season so non-current-year races resolve on the detail page.
  const href = year ? `/f1/race/${entry.id}?year=${year}` : `/f1/race/${entry.id}`;

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

  // Colors flip to white on the red "next race" treatment.
  const headingColor = isNext ? "#fff" : "#15151e";
  const subColor = isNext ? "rgba(255,255,255,0.85)" : "#67676d";

  return (
    <Link
      href={href}
      className={`f1-schedule-card${isCurrent ? " is-current" : ""}${isNext ? " is-next" : ""}`}
      style={
        isNext
          ? { position: "relative", background: "linear-gradient(135deg, #e10600 0%, #b30500 100%)", color: "#fff" }
          : undefined
      }
    >
      <div style={{ padding: "22px 24px", minHeight: 150 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            {isNext ? (
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
                Round {round}
              </div>
            ) : isCurrent ? (
              <div style={{
                fontSize: 11, fontWeight: 700, color: "#fff",
                background: "#e10600", display: "inline-block",
                padding: "2px 8px", borderRadius: 4, marginBottom: 6,
                textTransform: "uppercase", letterSpacing: "0.5px",
              }}>
                Round {round}
              </div>
            ) : (
              <div style={{ fontSize: 11, fontWeight: 700, color: "#67676d", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
                Round {round}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>{flag}</span>
              <h3 style={{ fontSize: 22, fontWeight: 900, fontStyle: "italic", margin: 0, color: headingColor }}>
                {shortGPName}
              </h3>
            </div>
            <div style={{ fontSize: 12, color: subColor, marginTop: 4 }}>
              {entry.circuit || ""}
            </div>
          </div>

          {isNext ? (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              background: "#fff", color: "#15151e",
              fontSize: 10, fontWeight: 800, letterSpacing: "0.5px",
              textTransform: "uppercase", padding: "5px 9px", borderRadius: 4,
              flexShrink: 0, whiteSpace: "nowrap",
            }}>
              Next race →
            </span>
          ) : circuitSvg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={circuitSvg}
              alt=""
              style={{ width: 104, height: 78, objectFit: "contain", opacity: 0.18, flexShrink: 0, filter: "invert(0)" }}
            />
          ) : null}
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
          <div style={{ fontSize: 14, fontWeight: 800, color: headingColor, marginTop: 12, textTransform: "uppercase" }}>
            {dateStr}
          </div>
        )}
      </div>
    </Link>
  );
}