"use client";

import { useState } from "react";
import type { Standings } from "@/lib/api/f1";
import { getTeamColor, findDriver, findTeam } from "@/types/f1";
import F1StandingsPodium from "./F1StandingsPodium";

// Round driver photo, 3-letter nationality, and a colour-filled team logo badge.
// Nationality + Team are hidden on phones so the row stays Pos | Driver | Pts.
const tableCss = `
.f1-std-driver { display: inline-flex; align-items: center; gap: 10px; }
.f1-std-photo { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; object-position: top center; background: #ececec; flex-shrink: 0; }
.f1-std-teambadge { display: inline-flex; align-items: center; gap: 9px; white-space: nowrap; }
.f1-std-teamlogo { width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.f1-std-teamlogo img { width: 60%; height: 60%; object-fit: contain; filter: invert(1); }
.f1-std-teaminitial { color: #fff; font-size: 12px; font-weight: 800; line-height: 1; }
.f1-std-nat { font-weight: 700; color: #67676d; letter-spacing: 0.5px; }
@media (max-width: 768px) {
  .f1-std-hide-mobile { display: none; }
}
`;

export default function StandingsPageClient({ standings }: { standings: Standings }) {
  const [tab, setTab] = useState<"drivers" | "teams">("drivers");

  // team name -> logo, sourced from the constructor rows (driver rows have no logo)
  const teamLogos = new Map(standings.constructors.map((c) => [c.team, c.logo] as const));

const TeamBadge = ({ name }: { name: string }) => {
    const slug = findTeam(name)?.slug;
    return (
      <span className="f1-std-teambadge">
        <span className="f1-std-teamlogo" style={{ background: getTeamColor(name) }}>
          {slug ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/f1/logos/${slug}.jpeg`}
              alt=""
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <span className="f1-std-teaminitial">{name.trim().charAt(0).toUpperCase()}</span>
          )}
        </span>
        {name}
      </span>
    );
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: tableCss }} />

      {/* Same tabbed podium as the home page; its tab bar drives the table below.
          Already responsive, so mobile gets the stacked/stepped podium too. */}
      <F1StandingsPodium
        drivers={standings.drivers}
        constructors={standings.constructors}
        tab={tab}
        onTabChange={setTab}
        showFullLink={false}
      />

      <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, overflow: "hidden", marginTop: 28 }}>
        {tab === "drivers" ? (
          <table className="f1-standings-table">
            <thead>
              <tr>
                <th>Pos.</th>
                <th>Driver</th>
                <th className="f1-std-hide-mobile">Nationality</th>
                <th className="f1-std-hide-mobile">Team</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.drivers.map((d) => {
                const info = findDriver(d.driver);
                const teamName = d.team ?? info?.team ?? "";
                return (
                  <tr key={d.driverId}>
                    <td className="pos">{d.rank}</td>
                    <td>
                      <span className="f1-std-driver">
                        {info?.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="f1-std-photo" src={info.image} alt="" />
                        ) : (
                          <span className="f1-std-photo" />
                        )}
                        {d.driver}
                      </span>
                    </td>
                    <td className="f1-std-hide-mobile">
                      <span className="f1-std-nat">{info?.nationalityCode ?? "—"}</span>
                    </td>
                    <td className="f1-std-hide-mobile">
                      <TeamBadge name={teamName} />
                    </td>
                    <td>{Math.round(d.points)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="f1-standings-table">
            <thead>
              <tr>
                <th>Pos.</th>
                <th>Team</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.constructors.map((c) => (
                <tr key={c.teamId}>
                  <td className="pos">{c.rank}</td>
                  <td>
                    <TeamBadge name={c.team} />
                  </td>
                  <td>{Math.round(c.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}