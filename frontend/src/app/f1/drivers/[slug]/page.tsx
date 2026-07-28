import type { Metadata } from "next";
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
      <F1Tabs />

      {/* ── Hero Banner (F1-style, team-colored) ───────────────────── */}
<div
  className="f1-hero"
  style={{
    position: "relative",
    width: "100%",
    height: "480px",
    background: `linear-gradient(105deg, #15151e 0%, #15151e 15%, ${teamColor} 100%)`,
    overflow: "hidden",
    color: "#ffffff",
  }}
>
  {/* Halftone dot overlay */}
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundImage: "radial-gradient(rgba(0, 0, 0, 0.2) 18%, transparent 19%)",
      backgroundSize: "10px 10px",
      opacity: 0.5,
      pointerEvents: "none",
      zIndex: 1,
    }}
  />

  {/* ── F1-style vertical accent bars — top pair ── */}
  <div style={{ position: "absolute", left: "12%", top: 0, display: "flex", gap: "10px", zIndex: 3, pointerEvents: "none" }}>
    <div style={{ width: "8px", height: "140px", background: "#fff" }} />
    <div style={{ width: "8px", height: "100px", background: "#fff" }} />
  </div>
  {/* ── F1-style vertical accent bars — bottom pair ── */}
  <div style={{ position: "absolute", left: "12%", bottom: 0, display: "flex", gap: "10px", zIndex: 3, pointerEvents: "none" }}>
    <div style={{ width: "8px", height: "100px", background: "#fff" }} />
    <div style={{ width: "8px", height: "140px", background: "#fff" }} />
  </div>

  <div
    className="f1-container"
    style={{
      position: "relative",
      zIndex: 2,
      width: "100%",
      maxWidth: "1280px",
      margin: "0 auto",
      padding: "0 32px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "stretch",
      height: "100%",
    }}
  >
    {/* Left: driver info */}
    <div style={{ display: "flex", alignItems: "center", zIndex: 3, paddingLeft: "60px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "12px" }}>
        {/* Cursive first name */}
        <span
          style={{
            fontFamily: "'Caveat', 'Dancing Script', cursive, sans-serif",
            fontSize: "clamp(36px, 5vw, 54px)",
            fontWeight: 500,
            color: "#ffffff",
            lineHeight: 0.9,
            marginLeft: "4px",
          }}
        >
          {driver.firstName}
        </span>

        {/* Bold last name */}
        <h1
          style={{
            fontSize: "clamp(42px, 6vw, 72px)",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "-1px",
            lineHeight: 0.85,
            margin: 0,
            fontFamily: "'Montserrat', 'Arial Black', sans-serif",
          }}
        >
          {driver.lastName}
        </h1>

        {/* Metadata: flag in white-outline circle, nationality, team, number */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "14px",
            fontWeight: 600,
            color: "#ffffff",
            marginTop: "4px",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "25px",
              height: "25px",
              borderRadius: "50%",
              border: "2px solid #ffffff",
              background: "transparent",
              fontSize: "40px",
              lineHeight: 1,
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {driver.flagEmoji}
          </span>
          <span>{driver.nationality}</span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span>{driver.team}</span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span>{driver.number}</span>
        </div>
      </div>
    </div>

    {/* Giant number — inside container for alignment, outside photo div to avoid clip */}
    <div
      style={{
        position: "absolute",
        right: "130px",
        bottom: "70px",
        fontSize: "550px",
        fontWeight: 900,
        fontStyle: "italic",
        color: "rgba(0,0,0,0.52)",
        lineHeight: 0.6,
        whiteSpace: "nowrap",
        userSelect: "none",
        pointerEvents: "none",
        zIndex: 2,
        fontFamily: "'Impact', 'Arial Black', sans-serif",
      }}
    >
      {driver.number}
    </div>

    {/* Right: Driver photo */}
    <div
      style={{
        position: "relative",
        width: "380px",
        height: "480px",
        overflow: "hidden",
        zIndex: 3,
        alignSelf: "flex-end",
        flexShrink: 0,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={driver.image}
        alt={driver.name}
        style={{
          width: "100%",
          height: "190%",
          objectFit: "cover",
          objectPosition: "top center",
          position: "absolute",
          top: "0",
          left: "0",
          zIndex: 2,
          filter: "contrast(1.05) brightness(1.02)",
        }}
      />
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 32, alignItems: "start" }}>
          <div>
            {/* ── Season Stats ──────────────────────────────── */}
            {standing && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 32 }}>
                {[
                  { label: "Position", value: standing.rank },
                  { label: "Points", value: Math.round(standing.points) },
                  { label: "Wins", value: standing.wins },
                  { label: "Team", value: driver.team },
                ].map((stat) => (
                  <div key={stat.label} style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", border: "1px solid #e8e8e8" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#67676d", textTransform: "uppercase", letterSpacing: "0.5px" }}>{stat.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4, color: teamColor }}>{stat.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ── 2026 Season Statistics (computed from session grids) ──── */}
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
                <h2 className="f1-section-title" style={{ fontSize: 18 }}>2026 Results</h2>
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
                  <div style={{ fontSize: 18, fontWeight: 900, fontStyle: "italic", color: teamColor }}>{team.name}</div>
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