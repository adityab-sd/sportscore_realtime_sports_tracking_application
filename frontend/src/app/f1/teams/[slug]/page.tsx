import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStandings, getNews, getSchedule, getResults, type RaceWeekend } from "@/lib/api/f1";
import F1Tabs from "@/components/f1/F1Tabs";
import { TEAMS_2026, DRIVERS_2026, getTeamGradient, getTeamColor, driverSlug } from "@/types/f1";

export const dynamic = "force-dynamic";

// Mobile-only tweaks: nudge the hero content (car / title / bars / driver names)
// down a little, and stack the driver cards one per row. Both revert at >=640px.
const responsiveCss = `
.team-hero-body { margin-top: 24px; }
.team-drivers-grid { grid-template-columns: 1fr; }
.team-driver-card { min-height: 190px; }
.team-driver-pts { display: none; }
@media (min-width: 640px) {
  .team-hero-body { margin-top: 0; }
  .team-drivers-grid { grid-template-columns: repeat(2, 1fr); }
  .team-driver-card { min-height: 0; aspect-ratio: 2.4; }
  .team-driver-pts { display: block; }
}
`;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const team = TEAMS_2026.find((t) => t.slug === slug);
  return { title: team ? `${team.name} — F1 Team — SportScore` : "F1 Team — SportScore" };
}

export default async function TeamDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = TEAMS_2026.find((t) => t.slug === slug);
  if (!team) return notFound();

  const [standings, news, schedule] = await Promise.all([
    getStandings(), getNews(20), getSchedule(),
  ]);

  const constructorStanding = standings.constructors.find((c) =>
    c.team.toLowerCase().includes(team.slug.replace(/-/g, " ")) ||
    team.name.toLowerCase().includes(c.team.toLowerCase()) ||
    c.team.toLowerCase().includes(team.name.toLowerCase())
  );
  const logo = constructorStanding?.logo ?? null;
  

  const teamDriverStandings = standings.drivers.filter((d) =>
    team.drivers.some((td) => d.driver.toLowerCase().includes(td.split(" ").pop()!.toLowerCase()))
  );
  const teamDrivers = team.drivers
    .map((name) => DRIVERS_2026.find((d) => d.name === name))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
  const bg = getTeamGradient(team.name);

  // ── Season statistics ─────────────────────────────────────────────────────
  const completedRaces = schedule.filter((e) => e.statusState === "post");
  const weekends = await Promise.all(completedRaces.map((e) => getResults(e.id)));
  const weekendMap = new Map(
    weekends.filter((w): w is RaceWeekend => w != null).map((w) => [w.id, w])
  );

  const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
  const lastNames = teamDrivers.map((d) => d.lastName.toLowerCase());
  const isTeamDriver = (g: { driver: string }) => lastNames.some((ln) => g.driver.toLowerCase().includes(ln));

  const stats = {
    races: 0, gpPoints: 0, wins: 0, podiums: 0, poles: 0, top10: 0, dnfs: 0,
    sprintRaces: 0, sprintPoints: 0, sprintWins: 0, sprintPodiums: 0, sprintTop10: 0,
  };
  for (const entry of completedRaces) {
    const sessions = weekendMap.get(entry.id)?.sessions ?? [];
    const isDone = (s?: { statusState: string }) => s?.statusState === "post";
    const t = (s: { type: string | null }) => (s.type ?? "").toLowerCase();
    const race = sessions.find((s) => t(s).includes("race") && !t(s).includes("sprint"));
    const qual = sessions.find((s) => t(s).includes("qual") && !t(s).includes("sprint"));
    const sprint = sessions.find((s) => t(s).includes("sprint") && !t(s).includes("qual"));

    if (isDone(race) && race) {
      stats.races++;
      const finishers = race.grid?.filter(isTeamDriver) ?? [];
      for (const r of finishers) {
        if (r.position === 1) stats.wins++;
        if (r.position <= 3) stats.podiums++;
        if (r.position <= 10) { stats.top10++; stats.gpPoints += RACE_POINTS[r.position - 1] ?? 0; }
      }
      stats.dnfs += Math.max(0, lastNames.length - finishers.length);
    }
    if (isDone(qual) && qual) {
      for (const q of qual.grid?.filter(isTeamDriver) ?? []) if (q.position === 1) stats.poles++;
    }
    if (isDone(sprint) && sprint) {
      stats.sprintRaces++;
      for (const sp of sprint.grid?.filter(isTeamDriver) ?? []) {
        if (sp.position === 1) stats.sprintWins++;
        if (sp.position <= 3) stats.sprintPodiums++;
        if (sp.position <= 10) stats.sprintTop10++;
        if (sp.position <= 8) stats.sprintPoints += SPRINT_POINTS[sp.position - 1] ?? 0;
      }
    }
  }

  const teamNews = news.filter((n) =>
    n.headline.toLowerCase().includes(team.name.toLowerCase()) ||
    n.headline.toLowerCase().includes(team.slug.replace(/-/g, " ")) ||
    team.drivers.some((d) => n.headline.toLowerCase().includes(d.split(" ").pop()!.toLowerCase()))
  ).slice(0, 6);

  const Stat = ({ label, value }: { label: string; value: number | string }) => (
    <div style={{ padding: "16px 0", borderBottom: "1px solid #ececec" }}>
      <div style={{ fontSize: 12, color: "#67676d", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6, color: "#36454F" }}>{value}</div>
    </div>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: responsiveCss }} />
      <F1Tabs />

      {/* ── Official F1-Style Hero Banner ───────────────────── */}
      <div
        className="f1-hero f1-team-hero"
        style={{
          background: bg,
          position: "relative",
          paddingTop: 16,
          paddingBottom: 36,
          overflow: "hidden",
        }}
      >
        {/* F1 Halftone Dot Pattern & Gradient Vignette Overlays */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(rgba(0, 0, 0, 0.18) 18%, transparent 19%)",
            backgroundSize: "10px 10px",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 40%, transparent 100%)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        <div className="f1-container" style={{ position: "relative", zIndex: 2 }}>
          {/* Top Bar Navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Link
              href="/f1/teams"
              style={{
                color: "black",
                fontSize: 13,
                fontWeight: 800,
                textDecoration: "none",
                opacity: 0.8,
              }}
            >
              ← All teams
            </Link>
            <div style={{ display: "flex", gap: 20, fontSize: 13, fontWeight: 600, color: "#ffffff", opacity: 0.85 }}>
              <a href="#drivers" style={{ color: "black", textDecoration: "none", fontWeight: 800 }}>Drivers</a>
              <a href="#statistics" style={{ color: "black", textDecoration: "none", fontWeight: 800 }}>Statistics</a>
              <a href="#news" style={{ color: "black", textDecoration: "none", fontWeight: 800 }}>News</a>
            </div>
          </div>

          {/* Centered Car Graphic (nudged down on mobile via .team-hero-body) */}
          <div className="team-hero-body" style={{ marginLeft: "auto", marginRight: "auto", maxWidth: "820px", textAlign: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={team.carImage}
              alt={team.name}
              style={{
                width: "92%",
                maxWidth: "760px",
                height: "auto",
                objectFit: "contain",
                filter: "drop-shadow(0 16px 32px rgba(0,0,0,0.35))",
              }}
            />
          </div>

          {/* Full-width Parallel Lines & Team Name */}
          <div
            style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "102vw",
            position: "relative",
            left: "50%",
            transform: "translateX(-50%)",
            margin: "12px 0 8px",
            gap: 20,
            overflow: "hidden",
          }}
          >
            {/* Left Parallel Slanted White Lines */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                transform: "skewX(-28deg)",
                transformOrigin: "right center",
              }}
            >
              <div style={{ height: "13px", backgroundColor: "#ffffff", width: "100%" }} />
              <div style={{ height: "13px", backgroundColor: "#ffffff", width: "100%" }} />
            </div>

            {/* Team Name */}
            <h1
              style={{
                fontSize: "clamp(36px, 7.5vw, 88px)",
                fontWeight: 800,
                color: "#ffffff",
                fontStyle: "italic",
                textTransform: "uppercase",
                margin: 0,
                lineHeight: 0.8,
                whiteSpace: "nowrap",
                letterSpacing: "0.02em",
                textShadow: "0 2px 10px rgba(0,0,0,0.7)",
              }}
            >
              {team.name}
            </h1>

            {/* Right Parallel Slanted White Lines */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                transform: "skewX(-28deg)",
                transformOrigin: "left center",
              }}
            >
              <div style={{ height: "13px", backgroundColor: "#ffffff", width: "100%" }} />
              <div style={{ height: "13px", backgroundColor: "#ffffff", width: "100%" }} />
            </div>
          </div>

          {/* Driver Names List */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 24,
              fontSize: 15,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "0.01em",
              marginTop: 6,
            }}
          >
            {team.drivers.map((driverName, idx) => (
              <span key={idx}>{driverName}</span>
            ))}
          </div>

          {/* Team Logo Emblem in Thin Circle */}
          {logo && (
            <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  border: "1.5px solid rgba(255, 255, 255, 0.75)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 6,
                  boxSizing: "border-box",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logo}
                  alt={team.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    filter: "brightness(0) invert(1)",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="f1-container" style={{ paddingTop: 40, paddingBottom: 60 }}>
        {/* ── Drivers Section ─────────────────────────────── */}
        <section id="drivers" style={{ marginBottom: 48 }}>
          <h2
            style={{
              fontSize: 32,
              fontWeight: 900,
              fontStyle: "italic",
              textTransform: "uppercase",
              letterSpacing: "0.02em",
              color: "#36454F",
              marginBottom: 20,
            }}
          >
            Drivers
          </h2>
          <div className="team-drivers-grid" style={{ display: "grid", gap: 16 }}>
            {teamDrivers.map((d) => {
  const standing = teamDriverStandings.find((s) => s.driver.toLowerCase().includes(d.lastName.toLowerCase()));
  const teamColor = getTeamColor(team.name);
  return (
    <Link
      key={d.name}
      href={`/f1/drivers/${driverSlug(d.name)}`}
      className="team-driver-card"
      style={{
        position: "relative",
        display: "block",
        borderRadius: 16,
        overflow: "hidden",
        background: `linear-gradient(to right, #36454F 0%, ${teamColor} 100%)`,
        textDecoration: "none",
        color: "#fff",
      }}
    >
      {/* Halftone overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(0,0,0,0.15) 18%, transparent 19%)",
          backgroundSize: "8px 8px",
          opacity: 0.4,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Driver info — left */}
      <div style={{ position: "absolute", top: 20, left: 24, zIndex: 3 }}>
        <div style={{ fontSize: 16, fontWeight: 500, opacity: 0.9, lineHeight: 1.2 }}>
          {d.firstName}
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, textTransform: "uppercase", fontStyle: "italic", lineHeight: 1, letterSpacing: "-0.5px" }}>
          {d.lastName}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.7, marginTop: 4 }}>
          {d.team}
        </div>
        <div style={{ fontSize: 48, fontWeight: 900, fontStyle: "italic", lineHeight: 1, marginTop: 8, opacity: 0.4 }}>
          {d.number}
        </div>
        {standing && (
          <div className="team-driver-pts" style={{ fontSize: 14, fontWeight: 800, marginTop: 6 }}>
            {Math.round(standing.points)} PTS
          </div>
        )}
      </div>

      {/* Flag — bottom left */}
      <div style={{
        position: "absolute",
        bottom: 16,
        left: 24,
        zIndex: 3,
        width: 24,
        height: 24,
        borderRadius: "50%",
        border: "1.5px solid rgba(255,255,255,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 34,
        lineHeight: 1,
        overflow: "hidden",
      }}>
        {d.flagEmoji}
      </div>

      {/* Driver image — centered, stomach crop */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={d.image}
        alt={d.name}
        style={{
          position: "absolute",
          right: -6,
          bottom: 0,
          width: "52%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "top center",
          zIndex: 2,
        }}
      />
    </Link>
  );
})}
          </div>
        </section>

        {/* ── 2026 Season Statistics ─────────────────────── */}
        {stats.races > 0 && (
          <section id="statistics" style={{ marginBottom: 48 }}>
            <h2 className="f1-section-title" style={{ fontSize: 28, marginBottom: 20 }}>Statistics</h2>
            <h3 style={{ fontSize: 22, fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", margin: "0 0 12px" }}>
              2026 Season
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", columnGap: 48 }}>
              <Stat label="Season Position" value={constructorStanding ? constructorStanding.rank : "-"} />
              <Stat label="Season Points" value={constructorStanding ? Math.round(constructorStanding.points) : stats.gpPoints} />
              <Stat label="Grand Prix Races" value={stats.races} />
              <Stat label="Grand Prix Points" value={stats.gpPoints} />
              <Stat label="Grand Prix Wins" value={stats.wins} />
              <Stat label="Grand Prix Podiums" value={stats.podiums} />
              <Stat label="Grand Prix Poles" value={stats.poles} />
              <Stat label="Grand Prix Top 10s" value={stats.top10} />
              <Stat label="DNFs" value={stats.dnfs} />
              {stats.sprintRaces > 0 && <Stat label="Sprint Races" value={stats.sprintRaces} />}
              {stats.sprintRaces > 0 && <Stat label="Sprint Points" value={stats.sprintPoints} />}
              {stats.sprintRaces > 0 && <Stat label="Sprint Wins" value={stats.sprintWins} />}
              {stats.sprintRaces > 0 && <Stat label="Sprint Podiums" value={stats.sprintPodiums} />}
              {stats.sprintRaces > 0 && <Stat label="Sprint Top 10s" value={stats.sprintTop10} />}
            </div>
          </section>
        )}

        {/* ── Latest News ──────────────────────────────────── */}
        {teamNews.length > 0 && (
          <section id="news">
            <h2 className="f1-section-title" style={{ fontSize: 24 }}>Latest News</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {teamNews.map((article) => (
                <Link key={article.id} href={`/f1/news/${article.id}`} className="f1-news-card">
                  {article.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={article.image} alt="" />
                  )}
                  <div className="news-body">
                    <div className="news-cat">{article.category}</div>
                    <div className="news-headline">{article.headline}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}