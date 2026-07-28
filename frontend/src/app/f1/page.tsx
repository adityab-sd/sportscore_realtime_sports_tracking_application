import type { Metadata } from "next";
import Link from "next/link";
import { getResults, getStandings, getNews, getSchedule, getScoreboard, type RaceWeekend } from "@/lib/api/f1";
import F1Tabs from "@/components/f1/F1Tabs";
import F1LiveBanner, { type F1BannerData } from "@/components/f1/F1LiveBanner";
import DriverPodium from "@/components/f1/DriverPodium";
import TeamPodium from "@/components/f1/TeamPodium";
import ScheduleCard from "@/components/f1/ScheduleCard";
import { getCountryFlag } from "@/types/f1";

export const metadata: Metadata = {
  title: "Formula 1 — SportScore",
  description: "Live F1 race results, standings, schedule, and news.",
};

export const dynamic = "force-dynamic";

export default async function F1Page() {
  const [schedule, standings, news, scoreboard] = await Promise.all([
    getSchedule(),
    getStandings(),
    getNews(8),
    getScoreboard(),
  ]);

  // Finished-race grids come from /results/{eventId}, same source as the schedule
  // and results pages, so all three stay consistent. The scoreboard (current
  // weekend only) previously made Hungary the sole card able to show a podium.
  const completedRaces = schedule.filter((e) => e.statusState === "post");
  const weekends = await Promise.all(completedRaces.map((e) => getResults(e.id)));
  const weekendMap = new Map(
    weekends.filter((w): w is RaceWeekend => w != null).map((w) => [w.id, w])
  );

  const now = new Date().toISOString();
  const currentIdx = schedule.findIndex(
    (e) => e.statusState === "in" || (e.startDate && e.startDate > now)
  );
  const start = Math.max(0, currentIdx - 1);
  const featuredSchedule = schedule.slice(start, start + 3);

  // ── Live / next-session banner data (from the scoreboard's session states) ──
  const cleanGp = (n: string) =>
    n.replace(/\b(Aramco|Pirelli|AWS|Heineken|Louis Vuitton|MSC Cruises|Lenovo|Crypto\.com|TAG Heuer|Qatar Airways|Moët & Chandon|Singapore Airlines|Gulf Air|STC|Etihad Airways|Rolex|Qatar Airways|Formula 1)\b/gi, "")
      .replace(/\s+/g, " ").trim();
  const nowMs = Date.now();
  let banner: F1BannerData | null = null;

  for (const w of scoreboard) {
    const liveSession = w.sessions.find((s) => s.statusState === "in");
    if (liveSession) {
      banner = {
        live: true,
        gpName: cleanGp(w.name),
        sessionLabel: liveSession.label || liveSession.type,
        date: liveSession.date,
        href: "/f1/results",
        flag: getCountryFlag(w.country),
      };
      break;
    }
  }
  if (!banner) {
    let best: { w: RaceWeekend; date: string; label: string } | null = null;
    for (const w of scoreboard) {
      for (const s of w.sessions) {
        if (s.statusState === "pre" && s.date && new Date(s.date).getTime() > nowMs) {
          if (!best || new Date(s.date).getTime() < new Date(best.date).getTime()) {
            best = { w, date: s.date, label: s.label || s.type };
          }
        }
      }
    }
    if (best) {
      banner = { live: false, gpName: cleanGp(best.w.name), sessionLabel: best.label, date: best.date, href: "/f1/schedule", flag: getCountryFlag(best.w.country) };
    }
  }
  if (!banner) {
    const nextRace = schedule.find((e) => e.startDate && new Date(e.startDate).getTime() > nowMs);
    if (nextRace) {
      banner = { live: false, gpName: cleanGp(nextRace.name), sessionLabel: "Race Weekend", date: nextRace.startDate, href: "/f1/schedule", flag: getCountryFlag(nextRace.country) };
    }
  }

  return (
    <>
      <F1Tabs />
      <div className="f1-container" style={{ paddingTop: 32, paddingBottom: 60 }}>
        {banner && <F1LiveBanner data={banner} />}
        {/* ── Race Calendar Strip ────────────────────────────── */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 className="f1-section-title" style={{ margin: 0 }}>2026 Season</h2>
            <Link href="/f1/schedule" style={{ fontSize: 13, fontWeight: 600, color: "#e10600", textDecoration: "none" }}>
              Full Schedule →
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {featuredSchedule.map((entry) => (
              <ScheduleCard
                key={entry.id}
                entry={entry}
                round={schedule.indexOf(entry) + 1}
                weekend={weekendMap.get(entry.id)}
              />
            ))}
          </div>
        </section>

        {/* ── Drivers Standings Top 3 ────────────────────────── */}
        {standings.drivers.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 className="f1-section-title" style={{ margin: 0 }}>Driver Standings</h2>
              <Link href="/f1/standings" style={{ fontSize: 13, fontWeight: 600, color: "#e10600", textDecoration: "none" }}>
                Full Standings →
              </Link>
            </div>
            <DriverPodium drivers={standings.drivers} />
          </section>
        )}

        {/* ── Constructor Standings Top 3 ─────────────────────── */}
        {standings.constructors.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 className="f1-section-title" style={{ margin: 0 }}>Constructor Standings</h2>
              <Link href="/f1/standings" style={{ fontSize: 13, fontWeight: 600, color: "#e10600", textDecoration: "none" }}>
                Full Standings →
              </Link>
            </div>
            <TeamPodium constructors={standings.constructors} />
          </section>
        )}

        {/* ── Latest News ────────────────────────────────────── */}
        {news.length > 0 && (
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 className="f1-section-title" style={{ margin: 0 }}>Latest News</h2>
              <Link href="/f1/news" style={{ fontSize: 13, fontWeight: 600, color: "#e10600", textDecoration: "none" }}>
                All News →
              </Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {news.map((article) => (
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