import Link from "next/link";
import type { DriverStanding } from "@/lib/api/f1";
import { findDriver, getTeamGradient, driverSlug, type DriverInfo } from "@/types/f1";

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return <>{n}<sup>{s[(v - 20) % 10] || s[v] || s[0]}</sup></>;
}

// Prefer the static roster's first/last split; fall back to splitting the API name.
function splitName(fullName: string, info?: DriverInfo) {
  if (info?.firstName && info?.lastName) return { first: info.firstName, last: info.lastName };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: "", last: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export default function DriverPodium({ drivers }: { drivers: DriverStanding[] }) {
  const top3 = drivers.slice(0, 3);
  // Display order: 2nd, 1st, 3rd
  const ordered = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;

  return (
    <div className="f1-podium">
      {ordered.map((d) => {
        const info = findDriver(d.driver);
        const bg = getTeamGradient(d.team);
        const { first, last } = splitName(d.driver, info);
        return (
          <Link
            key={d.driverId}
            href={`/f1/drivers/${driverSlug(d.driver)}`}
            className="f1-podium-card"
            style={{ background: bg }}
          >
            <div className="podium-body">
              <div className="podium-rank">{ordinal(d.rank)}</div>
              <div className="podium-name">
                {first && <span className="podium-first">{first} </span>}
                <span className="podium-last">{last}</span>
              </div>
              <div className="podium-team">{d.team}</div>
              {d.flag ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.flag} alt="" className="podium-flag-img" />
              ) : info ? (
                <div className="podium-flag">{info.flagEmoji}</div>
              ) : null}
            </div>

            <div className="podium-points">
              {Math.round(d.points)}<span>PTS</span>
            </div>

            {info && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={info.image} alt={d.driver} className="podium-img" />
            )}
          </Link>
        );
      })}
    </div>
  );
}