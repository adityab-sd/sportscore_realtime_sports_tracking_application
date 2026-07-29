import Link from "next/link";
import { findDriver, getTeamColor, driverSlug } from "@/types/f1";
import type { ResultRow } from "@/types/f1-race";

function posColor(pos: number) {
  if (pos === 1) return "#FFD700";
  if (pos === 2) return "#C0C0C0";
  if (pos === 3) return "#CD7F32";
  return "#f0f0f0";
}

// Full classification. No./Team resolved locally via findDriver().
// Laps / Time-Retired / Pts read straight from the row and show "—" until the
// backend (F1Dto.java) populates them. The time field is read as `timeOrStatus`
// (the DriverResult/DTO name) with a `time` fallback for older payloads.
export default function F1ResultsTable({ rows }: { rows: ResultRow[] }) {
  const safe = Array.isArray(rows) ? [...rows].sort((a, b) => a.position - b.position) : [];

  if (safe.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#67676d" }}>No classification available yet</div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="f1-standings-table">
        <thead>
          <tr>
            <th>Pos.</th>
            <th>No.</th>
            <th>Driver</th>
            <th>Team</th>
            <th style={{ textAlign: "right" }}>Laps</th>
            <th>Time / Retired</th>
            <th style={{ textAlign: "right" }}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {safe.map((d) => {
            const info = findDriver(d.driver);
            const color = info ? getTeamColor(info.team) : "#333";
            const timeVal = d.timeOrStatus ?? d.time ?? null;
            const retired = d.isRetired ?? (timeVal ? /^(dnf|dns|dsq|ret)\b/i.test(timeVal) : false);
            return (
              <tr key={d.driverId}>
                <td className="pos">
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      fontWeight: 800,
                      fontSize: 12,
                      background: posColor(d.position),
                      color: d.position <= 3 ? "#000" : "#15151e",
                    }}
                  >
                    {d.position}
                  </span>
                </td>
                <td style={{ color: "#67676d", fontWeight: 700, fontSize: 13 }}>{info?.number ?? "—"}</td>
                <td>
                  <Link
                    href={`/f1/drivers/${driverSlug(d.driver)}`}
                    style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#15151e" }}
                  >
                    <span className="team-color-bar" style={{ background: color }} />
                    {info && (
                      <img src={info.image} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", objectPosition: "top" }} />
                    )}
                    <span style={{ fontWeight: 600 }}>{d.driver}</span>
                    {d.winner && <span style={{ fontSize: 11, color: "#FFD700", fontWeight: 700, marginLeft: 4 }}>WINNER</span>}
                  </Link>
                </td>
                <td style={{ color: "#67676d", fontSize: 13, whiteSpace: "nowrap" }}>{info?.team ?? d.team ?? "—"}</td>
                <td style={{ textAlign: "right", fontSize: 13, color: "#15151e" }}>{d.laps ?? "—"}</td>
                <td style={{ color: retired ? "#c0392b" : "#67676d", fontWeight: retired ? 700 : 400, fontSize: 13, whiteSpace: "nowrap" }}>
                  {timeVal ?? "—"}
                </td>
                <td style={{ fontWeight: 800, fontSize: 13, textAlign: "right" }}>{d.points ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}