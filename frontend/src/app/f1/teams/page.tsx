import type { Metadata } from "next";
import Link from "next/link";
import F1Tabs from "@/components/f1/F1Tabs";
import { getStandings } from "@/lib/api/f1";
import { TEAMS_2026, DRIVERS_2026, getTeamGradient } from "@/types/f1";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "F1 Teams 2026 — SportScore",
  description: "All 2026 Formula 1 teams and constructors.",
};

// One card per row on mobile; back to the two-up grid at >=640px.
const gridCss = `
.f1-teams-grid { grid-template-columns: 1fr; }
@media (min-width: 640px) { .f1-teams-grid { grid-template-columns: repeat(2, 1fr); } }
`;

export default async function F1TeamsPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: gridCss }} />
      <F1Tabs />
      <div className="f1-container" style={{ paddingTop: 32, paddingBottom: 60 }}>
        <h1 className="f1-section-title" style={{ fontSize: "clamp(24px, 4vw, 36px)", marginBottom: 8 }}>
          F1 Teams 2026
        </h1>
        <p style={{ color: "black", fontSize: 14, margin: "0 0 32px" }}>
          All the teams competing in the 2026 FIA Formula One World Championship
        </p>

        <div className="f1-teams-grid" style={{ display: "grid", gap: 18 }}>
          {TEAMS_2026.map((team) => {
            const bg = getTeamGradient(team.name);
            const drivers = team.drivers
              .map((name) => DRIVERS_2026.find((d) => d.name === name))
              .filter((d): d is NonNullable<typeof d> => Boolean(d));
            return (
              <Link
                key={team.slug}
                href={`/f1/teams/${team.slug}`}
                className="f1-team-card"
                style={{ background: bg }}
              >
                {/* Dark gradient overlay */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.15) 40%, transparent 100%)",
                    pointerEvents: "none",
                    zIndex: 1,
                  }}
                />

                <div className="team-card-head">
                  <div className="team-name">{team.name}</div>
                  <div className="team-drivers-row">
                    {drivers.map((d) => (
                      <span key={d.name} className="team-driver">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={d.image} alt="" className="team-driver-avatar" />
                        <span>{d.firstName} <b>{d.lastName.toUpperCase()}</b></span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={team.carImage} alt={team.name} className="car-img" style={{ marginLeft: "auto", marginRight: "auto", transform: "translateX(-10%)"}} />
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}