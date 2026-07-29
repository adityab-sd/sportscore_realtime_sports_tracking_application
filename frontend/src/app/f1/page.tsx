import type { Metadata } from "next";
import Link from "next/link";
import { getResults, getStandings, getNews, getSchedule, getScoreboard, type RaceWeekend } from "@/lib/api/f1";
import F1Tabs from "@/components/f1/F1Tabs";
import F1LiveBanner, { type F1BannerData } from "@/components/f1/F1LiveBanner";
import F1StandingsPodium from "@/components/f1/F1StandingsPodium";
import ScheduleCard from "@/components/f1/ScheduleCard";
import { getCountryFlag } from "@/types/f1";

export const metadata: Metadata = {
  title: "Formula 1 — SportScore",
  description: "Live F1 race results, standings, schedule, and news.",
};

export const dynamic = "force-dynamic";

// ESPN sometimes returns a time without seconds ("2026-08-23T13:00Z"), which some
// browsers can't parse (→ Invalid Date → broken countdown / failed `> now` check).
// Pad the seconds so it's always valid ISO; other formats pass through untouched.
function toIso(s: string | null): string | null {
  return s ? s.replace(/T(\d{2}):(\d{2})(Z|[+-]\d{2}:?\d{2})?$/, "T$1:$2:00$3") : s;
}
function ms(iso: string | null): number | null {
  const t = toIso(iso);
  if (!t) return null;
  const n = new Date(t).getTime();
  return Number.isNaN(n) ? null : n;
}
// The main Grand Prix race session, excluding the sprint race.
function isRaceSession(type: string | null, label: string | null): boolean {
  const t = `${type ?? ""} ${label ?? ""}`.toLowerCase();
  return t.includes("race") && !t.includes("sprint");
}

export default async function F1Page() {
  const [schedule, standings, news, scoreboard] = await Promise.all([
    getSchedule(),
    getStandings(),
    getNews(8),
    getScoreboard(),
  ]);

  // Finished-race grids come from /results/{eventId}, same source as the schedule
  // and results pages, so all three stay consistent.
  const completedRaces = schedule.filter((e) => e.statusState === "post");
  const weekends = await Promise.all(completedRaces.map((e) => getResults(e.id)));
  const weekendMap = new Map(
    weekends.filter((w): w is RaceWeekend => w != null).map((w) => [w.id, w])
  );

  const now = new Date().toISOString();
  const nowMs = Date.now();
  const currentIdx = schedule.findIndex(
    (e) => e.statusState === "in" || (e.startDate && e.startDate > now)
  );
  const start = Math.max(0, currentIdx - 1);
  const featuredSchedule = schedule.slice(start, start + 3);

  const slotFor = (idx: number): "previous" | "next" | "upcoming" =>
    currentIdx === -1 || idx < currentIdx ? "previous" : idx === currentIdx ? "next" : "upcoming";
  const slotLabel = { previous: "Previous", next: "Next", upcoming: "Upcoming" } as const;

  // ── Banner: LIVE session, else countdown to the next RACE (never FP/quali) ──
  const cleanGp = (n: string) =>
    n.replace(/\b(Aramco|Pirelli|AWS|Heineken|Louis Vuitton|MSC Cruises|Lenovo|Crypto\.com|TAG Heuer|Qatar Airways|Moët & Chandon|Singapore Airlines|Gulf Air|STC|Etihad Airways|Rolex|Qatar Airways|Formula 1)\b/gi, "")
      .replace(/\s+/g, " ").trim();

  let banner: F1BannerData | null = null;

  // 1) A session is live right now.
  const liveW = scoreboard.find((w) => w.sessions.some((s) => s.statusState === "in"));
  if (liveW) {
    const ls = liveW.sessions.find((s) => s.statusState === "in")!;
    banner = {
      live: true,
      gpName: cleanGp(liveW.name),
      sessionLabel: ls.label || ls.type,
      date: toIso(ls.date),
      href: "/f1/results",
      flag: getCountryFlag(liveW.country),
    };
  }

  // 2) Count down to the next RACE session. Look for the race in BOTH the
  //    scoreboard and the next event's own summary (getResults carries the
  //    real session times), then take the soonest future race.
  if (!banner) {
    const nextEntry =
      schedule.find((e) => e.statusState === "in" || (e.startDate && (ms(e.startDate) ?? 0) > nowMs)) ?? null;

    type Cand = { name: string; country: string | null; at: number; date: string };
    const candidates: Cand[] = [];
    const consider = (name: string, country: string | null, w: RaceWeekend | null) => {
      const rs = w?.sessions.find((s) => isRaceSession(s.type, s.label));
      const at = ms(rs?.date ?? null);
      if (at != null && at > nowMs) candidates.push({ name, country, at, date: toIso(rs!.date)! });
    };

    for (const w of scoreboard) consider(w.name, w.country, w);
    if (nextEntry) consider(nextEntry.name, nextEntry.country, await getResults(nextEntry.id));

    candidates.sort((a, b) => a.at - b.at);
    const best = candidates[0];

    if (best) {
      banner = { live: false, gpName: cleanGp(best.name), sessionLabel: "Race", date: best.date, href: "/f1/schedule", flag: getCountryFlag(best.country) };
    } else if (nextEntry) {
      // Last resort only: weekend start (no race session time available anywhere).
      banner = { live: false, gpName: cleanGp(nextEntry.name), sessionLabel: "Race Weekend", date: toIso(nextEntry.startDate), href: "/f1/schedule", flag: getCountryFlag(nextEntry.country) };
    }
  }

  return (
    <>
      <F1Tabs />
      <div className="f1-container" style={{ paddingTop: 32, paddingBottom: 60 }}>
        {banner && <F1LiveBanner data={banner} />}
        {/* ── Race Calendar Strip (Previous / Next / Upcoming) ──────── */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 className="f1-section-title" style={{ margin: 0 }}>2026 Season</h2>
            <Link href="/f1/schedule" style={{ fontSize: 13, fontWeight: 600, color: "#e10600", textDecoration: "none" }}>
              Full Schedule →
            </Link>
          </div>
          <div className="f1-schedule-strip">
            {featuredSchedule.map((entry) => {
              const idx = schedule.indexOf(entry);
              const slot = slotFor(idx);
              return (
                <div key={entry.id} className={`f1-schedule-slot slot-${slot}`}>
                  <div className="f1-slot-label">{slotLabel[slot]}</div>
                  <ScheduleCard
                    entry={entry}
                    round={idx + 1}
                    weekend={weekendMap.get(entry.id)}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Standings (Drivers / Teams tabbed podium) ───────── */}
        {(standings.drivers.length > 0 || standings.constructors.length > 0) && (
          <section style={{ marginBottom: 48 }}>
            <h2 className="f1-section-title" style={{ marginBottom: 20 }}>Standings</h2>
            <F1StandingsPodium drivers={standings.drivers} constructors={standings.constructors} />
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