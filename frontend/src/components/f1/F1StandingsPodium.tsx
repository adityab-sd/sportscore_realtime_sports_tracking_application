"use client";

import { useState } from "react";
import Link from "next/link";
import { DRIVERS_2026, TEAMS_2026, getTeamGradient, driverSlug } from "@/types/f1";

// Loose shapes — we only read the fields the standings API is known to provide
// (same ones the driver/team detail pages read). Extra fields are ignored.
type DriverStanding = { driver: string; rank?: number; points?: number; wins?: number };
type ConstructorStanding = { team: string; rank?: number; points?: number; logo?: string | null };

const posSuffix = (pos: number) => (pos === 1 ? "ST" : pos === 2 ? "ND" : pos === 3 ? "RD" : "TH");

// Podium geometry: 1st tallest, then 2nd, then 3rd.
// Mobile = stacked 1→2→3, lower ranks narrower + right-aligned (left edge steps in).
// Desktop = bottom-aligned row in 2nd–1st–3rd order (full-width cards).
const podiumCss = `
.f1-podium-tabs { display: flex; align-items: center; gap: 28px; border-bottom: 1px solid #e8e8e8; margin-bottom: 24px; }
.f1-podium-tab { background: none; border: none; padding: 0 0 12px; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em; color: #9a9a9f; cursor: pointer; position: relative; font-family: inherit; }
.f1-podium-tab.active { color: #15151e; }
.f1-podium-tab.active::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 3px; background: #e10600; border-radius: 2px; }
.f1-podium-full { margin-left: auto; font-size: 13px; font-weight: 600; color: #e10600; text-decoration: none; }

.f1-podium { display: flex; flex-direction: column; gap: 16px; }
.f1-podium-card { position: relative; border-radius: 16px; overflow: hidden; color: #fff; text-decoration: none; display: block; }
.f1-podium-dots { position: absolute; inset: 0; background-image: radial-gradient(rgba(0,0,0,0.15) 18%, transparent 19%); background-size: 8px 8px; opacity: 0.5; pointer-events: none; z-index: 1; }

/* mobile: stacked, 1st tallest, lower ranks narrower + right-aligned so their
   left edge steps in (right edges stay flush) to show the podium */
.f1-podium-card.rank-1 { min-height: 300px; order: 1; }
.f1-podium-card.rank-2 { min-height: 260px; order: 2; width: 92%; align-self: flex-end; }
.f1-podium-card.rank-3 { min-height: 240px; order: 3; width: 82%; align-self: flex-end; }

@media (min-width: 900px) {
  .f1-podium { flex-direction: row; align-items: flex-end; gap: 20px; }
  .f1-podium-card { flex: 1; }
  /* desktop: 2nd (left) — 1st (center, tallest) — 3rd (right), full-width cards */
  .f1-podium-card.rank-1 { min-height: 360px; order: 2; }
  .f1-podium-card.rank-2 { min-height: 320px; order: 1; width: auto; }
  .f1-podium-card.rank-3 { min-height: 300px; order: 3; width: auto; }
}
`;

function RankBadge({ pos }: { pos: number }) {
  return (
    <div style={{ fontSize: 32, fontWeight: 900, fontStyle: "italic", lineHeight: 1 }}>
      {pos}
      <sup style={{ fontSize: 14, fontWeight: 800, marginLeft: 1 }}>{posSuffix(pos)}</sup>
    </div>
  );
}

function DriverCard({ standing, pos }: { standing: DriverStanding; pos: number }) {
  const d = DRIVERS_2026.find((x) => standing.driver.toLowerCase().includes(x.lastName.toLowerCase()));
  const teamName = d?.team ?? "";
  const bg = teamName ? getTeamGradient(teamName) : "linear-gradient(120deg, #2a2a34, #15151e)";
  const points = Math.round(standing.points ?? 0);

  return (
    <Link
      href={d ? `/f1/drivers/${driverSlug(d.name)}` : "/f1/standings"}
      className={`f1-podium-card rank-${pos}`}
      style={{ background: bg }}
    >
      <div className="f1-podium-dots" />

      {/* Badge + name + flag (top-left column) */}
      <div style={{ position: "absolute", top: 20, left: 24, right: "42%", zIndex: 3, display: "flex", flexDirection: "column", gap: 10 }}>
        <RankBadge pos={pos} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.15 }}>{d?.firstName ?? ""}</div>
          <div style={{ fontSize: 26, fontWeight: 900, textTransform: "uppercase", fontStyle: "italic", lineHeight: 1, letterSpacing: "-0.5px" }}>
            {d?.lastName ?? standing.driver}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.8, marginTop: 4 }}>{teamName}</div>
        </div>
        {d?.flagEmoji && (
          <div style={{ width: 24, height: 24, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, lineHeight: 1, overflow: "hidden" }}>
            {d.flagEmoji}
          </div>
        )}
      </div>

      {/* Points (bottom-left) */}
      <div style={{ position: "absolute", bottom: 20, left: 24, zIndex: 3, fontSize: 22, fontWeight: 900 }}>
        {points} <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>PTS</span>
      </div>

      {/* Driver photo (right) */}
      {d?.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={d.image}
          alt={d.name}
          style={{ position: "absolute", right: 0, top: 0, height: "175%", width: "auto", zIndex: 2 }}
        />
      )}
    </Link>
  );
}

function TeamCard({ standing, pos }: { standing: ConstructorStanding; pos: number }) {
  const team = TEAMS_2026.find(
    (t) =>
      standing.team.toLowerCase().includes(t.name.toLowerCase()) ||
      t.name.toLowerCase().includes(standing.team.toLowerCase())
  );
  const teamName = team?.name ?? standing.team;
  const bg = getTeamGradient(teamName);
  const points = Math.round(standing.points ?? 0);
  const drivers = Array.isArray(team?.drivers) ? team!.drivers : [];

  return (
    <Link
      href={team ? `/f1/teams/${team.slug}` : "/f1/standings"}
      className={`f1-podium-card rank-${pos}`}
      style={{ background: bg }}
    >
      <div className="f1-podium-dots" />

      <div style={{ position: "absolute", top: 20, left: 24, right: 88, zIndex: 3, display: "flex", flexDirection: "column", gap: 6 }}>
        <RankBadge pos={pos} />
        <div style={{ fontSize: 26, fontWeight: 900, textTransform: "uppercase", fontStyle: "italic", lineHeight: 1 }}>{teamName}</div>
        <div style={{ fontSize: 20, fontWeight: 900 }}>
          {points} <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>PTS</span>
        </div>
        {drivers.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600, opacity: 0.9, lineHeight: 1.5 }}>
            {drivers.map((n) => {
              const parts = n.split(" ");
              return (
                <div key={n}>
                  {parts[0]} <b>{parts.slice(1).join(" ")}</b>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Team logo (top-right) */}
      {standing.logo && (
        <div style={{ position: "absolute", top: 20, right: 20, zIndex: 3, width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", padding: 8, boxSizing: "border-box" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={standing.logo} alt={teamName} style={{ width: "100%", height: "100%", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
        </div>
      )}

      {/* Car (bottom-right) */}
      {team?.carImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.carImage}
          alt={teamName}
          style={{ position: "absolute", right: 13, bottom: 18, width: "84%", maxWidth: 440, height: "auto", objectFit: "contain", zIndex: 2 }}
        />
      )}
    </Link>
  );
}

export default function F1StandingsPodium({
  drivers,
  constructors,
  tab: controlledTab,
  onTabChange,
  showFullLink = true,
}: {
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
  tab?: "drivers" | "teams";          // controlled mode (standings page); omit for internal state (home)
  onTabChange?: (t: "drivers" | "teams") => void;
  showFullLink?: boolean;             // hide the "Full Standings" link when already on that page
}) {
  const [internalTab, setInternalTab] = useState<"drivers" | "teams">("drivers");
  const tab = controlledTab ?? internalTab;
  const setTab = (t: "drivers" | "teams") => (onTabChange ? onTabChange(t) : setInternalTab(t));

  const byPoints = <T extends { points?: number }>(arr: T[]) =>
    [...(Array.isArray(arr) ? arr : [])].sort((a, b) => (b.points ?? 0) - (a.points ?? 0)).slice(0, 3);

  const topDrivers = byPoints(drivers);
  const topTeams = byPoints(constructors);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: podiumCss }} />

      <div className="f1-podium-tabs">
        <button className={`f1-podium-tab ${tab === "drivers" ? "active" : ""}`} onClick={() => setTab("drivers")}>
          Drivers
        </button>
        <button className={`f1-podium-tab ${tab === "teams" ? "active" : ""}`} onClick={() => setTab("teams")}>
          Teams
        </button>
        {showFullLink && <Link href="/f1/standings" className="f1-podium-full">Full Standings →</Link>}
      </div>

      <div className="f1-podium">
        {tab === "drivers"
          ? topDrivers.map((s, i) => <DriverCard key={s.driver} standing={s} pos={i + 1} />)
          : topTeams.map((s, i) => <TeamCard key={s.team} standing={s} pos={i + 1} />)}
      </div>
    </>
  );
}