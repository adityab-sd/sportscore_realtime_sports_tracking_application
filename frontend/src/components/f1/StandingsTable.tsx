import Link from "next/link";
import type { DriverStanding, ConstructorStanding } from "@/lib/api/f1";
import { findDriver, getTeamColor, driverSlug, findTeam, teamSlug } from "@/types/f1";

export function DriverStandingsTable({ drivers }: { drivers: DriverStanding[] }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #e8e8e8" }}>
      <table className="f1-standings-table">
        <thead>
          <tr>
            <th>Pos.</th>
            <th>Driver</th>
            <th>Nationality</th>
            <th>Team</th>
            <th>Pts.</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((d) => {
            const info = findDriver(d.driver);
            const color = getTeamColor(d.team);
            return (
              <tr key={d.driverId}>
                <td className="pos">{d.rank}</td>
                <td>
                  <Link
                    href={`/f1/drivers/${driverSlug(d.driver)}`}
                    style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#15151e" }}
                  >
                    <span className="team-color-bar" style={{ background: color }} />
                    {info && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={info.image}
                        alt={d.driver}
                        style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", objectPosition: "top" }}
                      />
                    )}
                    <span style={{ fontWeight: 600 }}>{d.driver}</span>
                  </Link>
                </td>
                <td style={{ color: "#67676d", fontSize: 13 }}>
                  {info?.nationalityCode || ""}
                </td>
                <td style={{ color: "#67676d", fontSize: 13 }}>
                  <span className="team-color-bar" style={{ background: color, height: 14 }} />
                  {d.team}
                </td>
                <td>{Math.round(d.points)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ConstructorStandingsTable({ constructors }: { constructors: ConstructorStanding[] }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #e8e8e8" }}>
      <table className="f1-standings-table">
        <thead>
          <tr>
            <th>Pos.</th>
            <th>Team</th>
            <th>Pts.</th>
          </tr>
        </thead>
        <tbody>
          {constructors.map((c) => {
            const info = findTeam(c.team);
            const color = getTeamColor(c.team);
            return (
              <tr key={c.teamId}>
                <td className="pos">{c.rank}</td>
                <td>
                  <Link
                    href={`/f1/teams/${info?.slug || teamSlug(c.team)}`}
                    style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#15151e" }}
                  >
                    <span className="team-color-bar" style={{ background: color }} />
                    <span style={{ fontWeight: 700 }}>{c.team}</span>
                  </Link>
                </td>
                <td>{Math.round(c.points)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
