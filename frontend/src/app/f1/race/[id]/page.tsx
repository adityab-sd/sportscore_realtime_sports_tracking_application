import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getResults, getSchedule } from "@/lib/api/f1";
import F1Tabs from "@/components/f1/F1Tabs";
import { findDriver, getTeamColor, getCircuitSvg, getCountryFlag, formatRaceDate, driverSlug } from "@/types/f1";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const weekend = await getResults(id);
  return { title: weekend ? `${weekend.name} — F1 — SportScore` : "F1 Race — SportScore" };
}

export default async function RacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [weekend] = await Promise.all([getResults(id)]);
  if (!weekend) return notFound();

  const circuitSvg = getCircuitSvg(weekend.name);
  const flag = getCountryFlag(weekend.country || "");
  const gpName = weekend.name.replace(/Formula 1|Grand Prix|FORMULA 1/gi, "").replace(/\d{4}/g, "").replace(/Aramco|Pirelli|AWS|Heineken|Louis Vuitton|MSC Cruises|Lenovo|Crypto\.com|TAG Heuer|Qatar Airways|Moët & Chandon|Singapore Airlines/gi, "").trim().replace(/^[\s-]+|[\s-]+$/g, "") || weekend.country || "Grand Prix";

  return (
    <>
      <F1Tabs />
      {/* ── Race Header ── */}
      <div style={{ background: "#15151e", color: "#fff", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="f1-container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 32, paddingBottom: 32 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 4 }}>
              {weekend.statusState === "post" ? "Completed" : weekend.statusState === "in" ? "Live" : "Upcoming"}
            </div>
            <h1 style={{ fontSize: "clamp(24px, 5vw, 40px)", fontWeight: 900, margin: 0, fontStyle: "italic" }}>
              <span style={{ marginRight: 12 }}>{flag}</span>{gpName}
            </h1>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
              {weekend.circuit}{weekend.city ? ` · ${weekend.city}` : ""}{weekend.country ? `, ${weekend.country}` : ""}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
              {formatRaceDate(weekend.startDate, weekend.endDate)}
            </div>
          </div>
          {circuitSvg && <img src={circuitSvg} alt="" style={{ width: 120, height: 90, objectFit: "contain", opacity: 0.4 }} />}
        </div>
      </div>

      <div className="f1-container" style={{ paddingTop: 32, paddingBottom: 60 }}>
        {weekend.sessions.map((session) => (
          <section key={session.id} style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, textTransform: "uppercase", color: "#15151e" }}>{session.label}</h2>
              <span style={{
                fontSize: 11, fontWeight: 700, textTransform: "uppercase", padding: "3px 10px", borderRadius: 4,
                background: session.statusState === "post" ? "#f0f0f0" : session.statusState === "in" ? "#e10600" : "#f8f8f8",
                color: session.statusState === "in" ? "#fff" : "#67676d",
              }}>
                {session.statusState === "post" ? "Completed" : session.statusState === "in" ? "Live" : "Upcoming"}
              </span>
            </div>
            {session.grid && session.grid.length > 0 ? (
              <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #e8e8e8" }}>
                <table className="f1-standings-table">
                  <thead><tr><th>Pos.</th><th>Driver</th><th>Country</th></tr></thead>
                  <tbody>
                    {session.grid.map((d) => {
                      const driverInfo = findDriver(d.driver);
                      const color = driverInfo ? getTeamColor(driverInfo.team) : "#333";
                      return (
                        <tr key={d.driverId}>
                          <td className="pos">
                            <span style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              width: 26, height: 26, borderRadius: 6, fontWeight: 800, fontSize: 12,
                              background: d.position <= 3 ? (d.position === 1 ? "#FFD700" : d.position === 2 ? "#C0C0C0" : "#CD7F32") : "#f0f0f0",
                              color: d.position <= 3 ? "#000" : "#15151e",
                            }}>
                              {d.position}
                            </span>
                          </td>
                          <td>
                            <Link href={`/f1/drivers/${driverSlug(d.driver)}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#15151e" }}>
                              <span className="team-color-bar" style={{ background: color }} />
                              {driverInfo && <img src={driverInfo.image} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", objectPosition: "top" }} />}
                              <span style={{ fontWeight: 600 }}>{d.driver}</span>
                              {d.winner && <span style={{ fontSize: 11, color: "#FFD700", fontWeight: 700, marginLeft: 4 }}>WINNER</span>}
                            </Link>
                          </td>
                          <td style={{ color: "#67676d", fontSize: 13 }}>{d.country || driverInfo?.nationalityCode || ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ background: "#fff", borderRadius: 12, padding: 32, textAlign: "center", color: "#67676d", border: "1px solid #e8e8e8" }}>
                No classification available yet
              </div>
            )}
          </section>
        ))}
        {weekend.sessions.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, color: "#67676d" }}>Session data not available yet.</div>
        )}
      </div>
    </>
  );
}
