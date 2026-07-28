import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStandings, getNews, getSchedule, getResults, type RaceWeekend } from "@/lib/api/f1";
import F1Tabs from "@/components/f1/F1Tabs";
import F1YearSelect from "@/components/f1/F1YearSelect";
import {
  DRIVERS_2026, findDriver, findTeamByDriver, getTeamGradient, getTeamColor,
  driverSlug, formatRaceDate, getCountryFlag,
} from "@/types/f1";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const driver = DRIVERS_2026.find((d) => driverSlug(d.name) === slug);
  return { title: driver ? `${driver.name} — F1 Driver — SportScore` : "F1 Driver — SportScore" };
}

function seasonYears(): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: current - 2019 }, (_, i) => current - i);
}

// Hero + layout responsiveness. Mobile-first: centered stacked hero (photo over
// the big ghosted number, name below), body stacks, stat cards go 2-up. At
// >=900px it becomes the side-by-side desktop layout.
//
// Mobile composition is driven by a `.driver-hero-stage` wrapper: the ghosted
// number is an absolutely-positioned overlay (inset:0 + flex-center) sitting
// BEHIND the photo, so it stays centred on the driver at every width. The stage
// collapses to `display:contents` at >=900px, which makes the number + photo
// behave as independent siblings of `.driver-hero-inner` again — i.e. the
// desktop side-by-side layout below is completely unchanged.
const heroCss = `
.driver-hero { position: relative; overflow: hidden; color: #fff; background: linear-gradient(180deg, color-mix(in srgb, var(--team-color) 55%, #ffffff) 0%, var(--team-color) 40%, color-mix(in srgb, var(--team-color) 55%, #061512) 100%); }
.driver-hero-dots { position: absolute; inset: 0; background-image: radial-gradient(rgba(0,0,0,0.2) 18%, transparent 19%); background-size: 10px 10px; opacity: 0.5; pointer-events: none; z-index: 1; }
.driver-hero-bars { position: absolute; left: 50%; transform: translateX(-50%); display: none; gap: 10px; z-index: 1; pointer-events: none; }
.driver-hero-bars span { width: 8px; background: #fff; }
.driver-hero-bars-top { top: 0; }
.driver-hero-bars-top span:nth-child(1) { height: 70px; }
.driver-hero-bars-top span:nth-child(2) { height: 48px; }
.driver-hero-bars-bottom { bottom: 0; }
.driver-hero-bars-bottom span:nth-child(1) { height: 48px; }
.driver-hero-bars-bottom span:nth-child(2) { height: 70px; }

.driver-hero-inner { position: relative; z-index: 2; max-width: 1280px; margin: 0 auto; padding: 40px 16px 32px; display: flex; flex-direction: column; align-items: center; text-align: center; }

/* Mobile: number + photo share a "stage" so the ghost number is always centred
   on the driver, at any width. Collapses (display:contents) at >=900px so the
   desktop layout further down is untouched. */
.driver-hero-stage { order: 1; position: relative; display: flex; justify-content: center; width: 100%; }

.driver-hero-number { position: absolute; inset: 0; z-index: 1; display: flex; align-items: center; justify-content: center; font-family: 'Impact','Arial Black',sans-serif; font-style: italic; font-weight: 900; color: rgba(0,0,0,0.28); line-height: 1; white-space: nowrap; user-select: none; pointer-events: none; font-size: clamp(300px, 92vw, 460px); }

.driver-hero-photo { position: relative; z-index: 3; width: clamp(230px, 70vw, 340px); height: clamp(320px, 92vw, 430px); overflow: hidden; -webkit-mask-image: linear-gradient(to bottom, #000 68%, transparent 100%); mask-image: linear-gradient(to bottom, #000 68%, transparent 100%); }
.driver-hero-photo img { width: 100%; height: 112%; object-fit: cover; object-position: top center; position: absolute; top: 0; left: 0; filter: contrast(1.05) brightness(1.02); }

.driver-hero-info { order: 2; z-index: 3; display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 12px; }
.driver-hero-first { font-family: 'Caveat','Dancing Script',cursive,sans-serif; font-size: clamp(30px, 9vw, 48px); font-weight: 500; line-height: 0.9; }
.driver-hero-last { font-size: clamp(36px, 12vw, 64px); font-weight: 900; text-transform: uppercase; letter-spacing: -1px; line-height: 0.88; margin: 0; font-family: 'Montserrat','Arial Black',sans-serif; }
.driver-hero-meta { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; margin-top: 4px; }
.driver-hero-flag { display: inline-flex; align-items: center; justify-content: center; width: 25px; height: 25px; border-radius: 50%; border: 2px solid #fff; font-size: 34px; line-height: 1; overflow: hidden; flex-shrink: 0; }
.driver-hero-meta .sep { opacity: 0.4; }

.driver-body-grid { display: grid; grid-template-columns: 1fr; gap: 24px; align-items: start; }
.driver-stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 32px; }

@media (min-width: 640px) {
  .driver-stat-grid { grid-template-columns: repeat(4, 1fr); }
}

@media (min-width: 900px) {
  .driver-hero-inner { flex-direction: row; justify-content: space-between; align-items: stretch; height: 480px; padding: 0 32px; text-align: left; }
  .driver-hero-bars { left: 12%; transform: none; display: flex; }
  .driver-hero-bars-top span:nth-child(1) { height: 140px; }
  .driver-hero-bars-top span:nth-child(2) { height: 100px; }
  .driver-hero-bars-bottom span:nth-child(1) { height: 100px; }
  .driver-hero-bars-bottom span:nth-child(2) { height: 140px; }

  /* keep the original desktop diagonal (dark → team colour); only mobile gets the vertical fade */
  .driver-hero { background: linear-gradient(105deg, #15151e 0%, #15151e 15%, var(--team-color) 100%); }

  /* stage collapses so number + photo become independent siblings again */
  .driver-hero-stage { display: contents; }

  .driver-hero-info { order: 1; align-self: center; align-items: flex-start; padding-left: 60px; text-align: left; margin-top: 0; }
  .driver-hero-number { display: block; top: auto; right: 130px; bottom: 70px; left: auto; transform: none; line-height: 0.6; font-size: clamp(300px, 40vw, 550px); }
  .driver-hero-photo { order: 3; width: 380px; height: 480px; align-self: flex-end; margin: 0; -webkit-mask-image: none; mask-image: none; }
  .driver-hero-photo img { height: 190%; }
  .driver-body-grid { grid-template-columns: 1fr 320px; gap: 32px; }
}
`;

export default async function DriverDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { slug } = await params;
  const { year: yearParam } = await searchParams;
  const driver = DRIVERS_2026.find((d) => driverSlug(d.name) === slug);
  if (!driver) return notFound();

  const years = seasonYears();
  const parsed = yearParam ? Number(yearParam) : years[0];
  const year = years.includes(parsed) ? parsed : years[0];
  const yq = year === years[0] ? undefined : year;

  const [standings, news, schedule] = await Promise.all([
    getStandings(yq), getNews(20), getSchedule(yq),
  ]);

  // Per-race results come from /results/{eventId}. The scoreboard only returns the
  // current weekend, which is why this page previously listed a single race.
  const completedRaces = schedule.filter((e) => e.statusState === "post");
  const weekends = await Promise.all(completedRaces.map((e) => getResults(e.id, yq)));

  const standing = standings.drivers.find((d) =>
    d.driver.toLowerCase().includes(driver.lastName.toLowerCase())
  );
  const team = findTeamByDriver(driver.name);
  const bg = getTeamGradient(driver.team);
  const teamColor = getTeamColor(driver.team);

  // Team-colour → dark gradient for on-white text, so light team colours
  // (Mercedes teal, McLaren papaya, etc.) stay readable on every device.
  const teamTextStyle: CSSProperties = {
    backgroundImage: `linear-gradient(120deg, ${teamColor} 0%, #15151e 130%)`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    WebkitTextFillColor: "transparent",
  };

  const weekendMap = new Map(
    weekends.filter((w): w is RaceWeekend => w != null).map((w) => [w.id, w])
  );

  // ── Season statistics, computed from each weekend's session grids ──────────
  const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
  const matchesDriver = (g: { driver: string }) =>
    g.driver.toLowerCase().includes(driver.lastName.toLowerCase());
  const stats = {
    races: 0, wins: 0, podiums: 0, top10: 0, poles: 0, dnfs: 0, gpPoints: 0,
    sprintRaces: 0, sprintWins: 0, sprintPodiums: 0, sprintPoints: 0,
  };

  const raceResults: { name: string; position: number | null; country: string | null }[] = [];
  for (const entry of completedRaces) {
    const sessions = weekendMap.get(entry.id)?.sessions ?? [];
    const isDone = (s?: { statusState: string }) => s?.statusState === "post";
    const t = (s: { type: string | null }) => (s.type ?? "").toLowerCase();
    const raceSession = sessions.find((s) => t(s).includes("race") && !t(s).includes("sprint"));
    const qualSession = sessions.find((s) => t(s).includes("qual") && !t(s).includes("sprint"));
    const sprintSession = sessions.find((s) => t(s).includes("sprint") && !t(s).includes("qual"));

    // Grand Prix race
    if (isDone(raceSession) && raceSession) {
      const r = raceSession.grid?.find(matchesDriver);
      stats.races++;
      if (r) {
        if (r.position === 1) stats.wins++;
        if (r.position <= 3) stats.podiums++;
        if (r.position <= 10) { stats.top10++; stats.gpPoints += RACE_POINTS[r.position - 1] ?? 0; }
      } else {
        stats.dnfs++;
      }
      raceResults.push({
        name: entry.name.replace(/Formula 1|Grand Prix|\d{4}/gi, "").replace(/Aramco|Pirelli|AWS|Heineken|Louis Vuitton|MSC Cruises|Lenovo|Crypto\.com|TAG Heuer|Qatar Airways|Moët & Chandon|Singapore Airlines/gi, "").trim().replace(/^[\s-]+|[\s-]+$/g, "") || entry.country || "GP",
        position: r?.position ?? null,
        country: entry.country,
      });
    }
    // Qualifying → poles
    if (isDone(qualSession) && qualSession) {
      const q = qualSession.grid?.find(matchesDriver);
      if (q?.position === 1) stats.poles++;
    }
    // Sprint
    if (isDone(sprintSession) && sprintSession) {
      const sp = sprintSession.grid?.find(matchesDriver);
      stats.sprintRaces++;
      if (sp) {
        if (sp.position === 1) stats.sprintWins++;
        if (sp.position <= 3) stats.sprintPodiums++;
        if (sp.position <= 8) stats.sprintPoints += SPRINT_POINTS[sp.position - 1] ?? 0;
      }
    }
  }

  const driverNews = news.filter((n) =>
    n.headline.toLowerCase().includes(driver.lastName.toLowerCase()) ||
    n.description?.toLowerCase().includes(driver.lastName.toLowerCase())
  ).slice(0, 4);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: heroCss }} />
      <F1Tabs />

      {/* ── Hero Banner (F1-style, team-colored, responsive) ───────── */}
      <div className="driver-hero" style={{ "--team-color": teamColor } as CSSProperties}>
        <div className="driver-hero-dots" />
        <div className="driver-hero-bars driver-hero-bars-top"><span /><span /></div>
        <div className="driver-hero-bars driver-hero-bars-bottom"><span /><span /></div>

        <div className="driver-hero-inner">
          {/* stage: on mobile the ghost number is centred BEHIND the photo;
              at >=900px this wrapper collapses (display:contents) so number +
              photo become independent siblings for the desktop layout */}
          <div className="driver-hero-stage">
            {/* giant number (ghosted, behind) */}
            <div className="driver-hero-number">{driver.number}</div>

            {/* photo */}
            <div className="driver-hero-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={driver.image} alt={driver.name} />
            </div>
          </div>

          {/* name + meta */}
          <div className="driver-hero-info">
            <span className="driver-hero-first">{driver.firstName}</span>
            <h1 className="driver-hero-last">{driver.lastName}</h1>
            <div className="driver-hero-meta">
              <span className="driver-hero-flag">{driver.flagEmoji}</span>
              <span>{driver.nationality}</span>
              <span className="sep">|</span>
              <span>{driver.team}</span>
              <span className="sep">|</span>
              <span>{driver.number}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="f1-container" style={{ paddingTop: 32, paddingBottom: 60 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#67676d" }}>
            {year === years[0] ? "Current season" : `${year} season`}
          </span>
          <F1YearSelect years={years} current={year} />
        </div>
        <div className="driver-body-grid">
          <div>
            {/* ── Season Stats ──────────────────────────────── */}
            {standing && (
              <div className="driver-stat-grid">
                {[
                  { label: "Position", value: standing.rank },
                  { label: "Points", value: Math.round(standing.points) },
                  { label: "Wins", value: standing.wins },
                  { label: "Team", value: driver.team },
                ].map((stat) => (
                  <div key={stat.label} style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", border: "1px solid #e8e8e8" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#67676d", textTransform: "uppercase", letterSpacing: "0.5px" }}>{stat.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4, ...teamTextStyle }}>{stat.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Season Statistics (computed from session grids) ──── */}
            {stats.races > 0 && (
              <section style={{ marginBottom: 32 }}>
                <h2 className="f1-section-title" style={{ fontSize: 18 }}>{year} Season Statistics</h2>
                <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", overflow: "hidden" }}>
                  <div style={{ padding: "10px 20px", fontSize: 11, fontWeight: 700, color: "#67676d", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid #f0f0f0", background: "#fafafa" }}>Grand Prix</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    {[
                      { label: "Grand Prix Races", value: stats.races },
                      { label: "Grand Prix Points", value: stats.gpPoints },
                      { label: "Grand Prix Wins", value: stats.wins },
                      { label: "Grand Prix Podiums", value: stats.podiums },
                      { label: "Grand Prix Poles", value: stats.poles },
                      { label: "Grand Prix Top 10s", value: stats.top10 },
                      { label: "DNFs", value: stats.dnfs },
                    ].map((s, i) => (
                      <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #f4f4f4", borderRight: i % 2 === 0 ? "1px solid #f4f4f4" : "none" }}>
                        <span style={{ fontSize: 13, color: "#67676d", fontWeight: 500 }}>{s.label}</span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: "#15151e" }}>{s.value}</span>
                      </div>
                    ))}
                  </div>

                  {stats.sprintRaces > 0 && (
                    <>
                      <div style={{ padding: "10px 20px", fontSize: 11, fontWeight: 700, color: "#67676d", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid #f0f0f0", borderTop: "1px solid #f0f0f0", background: "#fafafa" }}>Sprint</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                        {[
                          { label: "Sprint Races", value: stats.sprintRaces },
                          { label: "Sprint Points", value: stats.sprintPoints },
                          { label: "Sprint Wins", value: stats.sprintWins },
                          { label: "Sprint Podiums", value: stats.sprintPodiums },
                        ].map((s, i) => (
                          <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #f4f4f4", borderRight: i % 2 === 0 ? "1px solid #f4f4f4" : "none" }}>
                            <span style={{ fontSize: 13, color: "#67676d", fontWeight: 500 }}>{s.label}</span>
                            <span style={{ fontSize: 18, fontWeight: 800, color: "#15151e" }}>{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </section>
            )}

            {/* ── Race-by-Race Results ──────────────────────── */}
            {raceResults.length > 0 && (
              <section style={{ marginBottom: 32 }}>
                <h2 className="f1-section-title" style={{ fontSize: 18 }}>{year} Results</h2>
                <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #e8e8e8" }}>
                  <table className="f1-standings-table">
                    <thead><tr><th>Grand Prix</th><th>Position</th></tr></thead>
                    <tbody>
                      {raceResults.map((r, i) => (
                        <tr key={i}>
                          <td>
                            <span style={{ marginRight: 8 }}>{getCountryFlag(r.country)}</span>
                            {r.name}
                          </td>
                          <td>
                            {r.position !== null ? (
                              <span style={{
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                width: 28, height: 28, borderRadius: 6, fontWeight: 800, fontSize: 13,
                                background: r.position <= 3 ? (r.position === 1 ? "#FFD700" : r.position === 2 ? "#C0C0C0" : "#CD7F32") : "#f0f0f0",
                                color: r.position <= 3 ? "#000" : "#15151e",
                              }}>
                                {r.position}
                              </span>
                            ) : (
                              <span style={{ color: "#67676d" }}>DNF</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── Biography ────────────────────────────────── */}
            <section style={{ marginBottom: 32 }}>
              <h2 className="f1-section-title" style={{ fontSize: 18 }}>Biography</h2>
              <div style={{ background: "#fff", borderRadius: 12, padding: 24, border: "1px solid #e8e8e8" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {[
                    { label: "Team", value: driver.team },
                    { label: "Country", value: driver.nationality },
                    { label: "Number", value: `#${driver.number}` },
                    { label: "Nationality Code", value: driver.nationalityCode },
                  ].map((item) => (
                    <div key={item.label}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#67676d", textTransform: "uppercase" }}>{item.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4, color: "#15151e" }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* ── Sidebar ────────────────────────────────────── */}
          <aside>
            {team && (
              <Link
                href={`/f1/teams/${team.slug}`}
                style={{
                  display: "block", background: "#fff", borderRadius: 12, overflow: "hidden",
                  border: "1px solid #e8e8e8", textDecoration: "none", color: "#15151e", marginBottom: 16,
                }}
              >
                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#67676d", textTransform: "uppercase", marginBottom: 4 }}>Team</div>
                  <div style={{ fontSize: 18, fontWeight: 900, fontStyle: "italic", ...teamTextStyle }}>{team.name}</div>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={team.carImage} alt={team.name} style={{ width: "100%", height: 120, objectFit: "contain", padding: "0 16px" }} />
              </Link>
            )}

            {driverNews.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #e8e8e8", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#67676d", letterSpacing: "0.5px" }}>
                  Latest News
                </div>
                {driverNews.map((article, i) => (
                  <Link
                    key={article.id}
                    href={`/f1/news/${article.id}`}
                    style={{
                      display: "block", padding: "12px 16px", textDecoration: "none", color: "#15151e",
                      borderBottom: i < driverNews.length - 1 ? "1px solid #f0f0f0" : "none",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{article.headline}</div>
                    <div style={{ fontSize: 11, color: "#67676d", marginTop: 4 }}>{article.category}</div>
                  </Link>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}