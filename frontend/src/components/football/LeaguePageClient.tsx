"use client";
import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useSignalR } from "@/hooks/useSignalR";
import { Match, classifyStatus, leagueHasFullTable } from "@/types/football";
import { ESPNNews } from "@/lib/api/espn";
import type { LeaderCategory } from "@/app/football/league/[slug]/page";
import MatchCard from "./MatchCard";
import StandingsTable from "./StandingsTable";
import NewsCard from "@/components/news/NewsCard";
import { useRouter, useSearchParams } from "next/navigation";
import DatePicker from "@/components/ui/DatePicker";

type Tab = "fixtures" | "standings" | "news" | "statistics";

interface LeagueInfo { slug: string; name: string; short: string; logo: string; accent: string; }
interface Team { id: string; name: string; logo: string | null; }

// ─── Date helpers (all UTC) ───────────────────────────────────────────────────
function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addDays(d: Date, n: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
}
function toKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pillLabel(d: Date, today: Date) {
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === -1) return "Yesterday";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-US", { day: "2-digit", weekday: "short" }).replace(",", "");
}

function isSameDay(kickoff: string | null, date: Date) {
  if (!kickoff) return false;
  const t = Date.parse(kickoff);
  if (!Number.isFinite(t)) return false;
  const k = new Date(t);
  return (
    k.getUTCFullYear() === date.getUTCFullYear() &&
    k.getUTCMonth() === date.getUTCMonth() &&
    k.getUTCDate() === date.getUTCDate()
  );
}

// Pick the initial date to show: today if it has matches, otherwise the nearest
// date (past or future) that does. Keeps off-season users from landing on an
// empty day and scrolling through a whole month to find fixtures.
function pickInitialDate(matches: Match[], today: Date): Date {
  const keys = new Set<number>();
  for (const m of matches) {
    const t = m.kickoff ? Date.parse(m.kickoff) : NaN;
    if (Number.isFinite(t)) {
      const d = new Date(t);
      d.setUTCHours(0, 0, 0, 0);
      keys.add(d.getTime());
    }
  }
  const todayMs = today.getTime();
  if (keys.has(todayMs) || keys.size === 0) return today;
  let best = todayMs, bestDist = Infinity;
  for (const k of keys) {
    const dist = Math.abs(k - todayMs);
    if (dist < bestDist || (dist === bestDist && k < todayMs)) { best = k; bestDist = dist; }
  }
  return new Date(best);
}


// ─── Teams Dropdown ───────────────────────────────────────────────────────────
function TeamsDropdown({ teams, slug }: { teams: Team[]; slug: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.55)", padding: "10px 0", display: "flex", alignItems: "center", gap: 4 }}>
        Teams <span style={{ fontSize: 10 }}>▾</span>
      </button>
      {open && teams.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 100, width: 520, padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
          {teams.map(t => (
            <Link key={t.id} href={`/football/team/${t.id}?league=${slug}`}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, textDecoration: "none" }}
              className="team-dropdown-row">
              {t.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.logo} alt="" width={24} height={24} style={{ width: 24, height: 24, objectFit: "contain", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 24, height: 24, borderRadius: 4, background: "var(--cloud)", flexShrink: 0 }} />
              )}
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--obsidian)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Statistics Tab ───────────────────────────────────────────────────────────
// Which categories to show and in what order
const STAT_CATEGORIES: Record<string, string> = {
  "Goals":            "Goals",
  "Assists":          "Assists",
  "Shots On Target":  "Shots On Target",
  "Total Shots":      "Total Shots",
  "Saves":            "Saves",
  "Accurate Passes":  "Accurate Passes",
  "Fouls Committed":  "Fouls Committed",
  "Fouls Suffered":   "Fouls Suffered",
  "Yellow Cards":     "Yellow Cards",
  "Red Cards":        "Red Cards",
};

function LeaderRow({ entry, slug }: { entry: LeaderCategory["leaders"][0]; slug: string }) {
  const href = entry.athleteId ? `/football/player/${entry.athleteId}?league=${slug}` : null;

  const content = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", transition: "background 100ms" }}
      className="leader-row">
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", width: 20, textAlign: "center", flexShrink: 0 }}>{entry.rank}</span>
      {entry.headshot ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.headshot} alt="" width={32} height={32}
          style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", background: "var(--cloud)", flexShrink: 0 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      ) : (
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--navy-light)", flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: href ? "var(--navy)" : "var(--obsidian)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry.athleteName || `Player ${entry.athleteId}`}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{entry.teamName}</div>
      </div>
      <span style={{ fontSize: 17, fontWeight: 800, color: "var(--navy)", flexShrink: 0 }}>{entry.displayValue}</span>
    </div>
  );

  return href
    ? <Link href={href} style={{ textDecoration: "none", display: "block" }}>{content}</Link>
    : <div>{content}</div>;
}

function LeaderCard({ cat, slug }: { cat: LeaderCategory; slug: string }) {
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--obsidian)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
        {cat.displayName}
      </div>
      {cat.leaders.map((entry, i) => (
        <div key={`${entry.athleteId}-${i}`} style={{ borderBottom: i < cat.leaders.length - 1 ? "1px solid var(--border)" : "none" }}>
          <LeaderRow entry={entry} slug={slug} />
        </div>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LeaguePageClient({
  league, standings, news, leaderCategories, teams, seedMatches, slug, season, availableSeasons,
}: {
  league: LeagueInfo;
  standings: any[];
  news: ESPNNews[];
  leaderCategories: LeaderCategory[];
  teams: Team[];
  seedMatches: Match[];
  slug: string;
  season: string;
  availableSeasons: string[];
}) {
  const [tab, setTab] = useState<Tab>("fixtures");
  const router = useRouter();
  const searchParams = useSearchParams();

  function onSeasonChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("season", e.target.value);
    router.push(`/football/league/${slug}?${params.toString()}`);
  }
  const today = startOfDayUTC(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => pickInitialDate(seedMatches, today));
  const { matches: live, state, lastUpdate } = useSignalR();

  // Merge seed + live
  const byId = new Map<number, Match>();
  for (const m of seedMatches) byId.set(m.id, m);
  for (const m of live.filter(m => !m.sport || m.sport === "football")) byId.set(m.id, m);
  const allMatches = Array.from(byId.values());
  const dated = allMatches.filter(m => isSameDay(m.kickoff, selectedDate));
  const liveM = dated.filter(m => classifyStatus(m.status) === "live");
  const sched = dated.filter(m => classifyStatus(m.status) === "scheduled");
  const fin   = dated.filter(m => classifyStatus(m.status) === "finished");
  const selectedKey = toKey(selectedDate);

  // Filter categories to known ones, in order
  const orderedCats = Object.keys(STAT_CATEGORIES)
    .map(name => leaderCategories.find(c => c.displayName === name))
    .filter(Boolean) as LeaderCategory[];
  // Append any unknown categories at end
  const knownNames = new Set(Object.keys(STAT_CATEGORIES));
  const extraCats = leaderCategories.filter(c => !knownNames.has(c.displayName));
  const allCats = [...orderedCats, ...extraCats];

  const navItems: { key: Tab; label: string }[] = [
    { key: "fixtures", label: "Fixtures" },
    { key: "standings", label: "Standings" },
    { key: "news", label: "News" },
    { key: "statistics", label: "Statistics" },
  ];

  return (
    <div>
      {/* ── Banner ── */}
      <div style={{ background: `linear-gradient(135deg, ${league.accent} 0%, #0a1628 100%)` }}>
        <div className="container" style={{ paddingTop: 24, paddingBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={league.logo} alt={league.name} width={64} height={64}
              style={{ width: 64, height: 64, objectFit: "contain", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.3))" }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>
                Football League
              </div>
              <h1 style={{ fontSize: "clamp(22px,4vw,36px)", fontWeight: 900, color: "#fff", margin: 0, letterSpacing: "-0.5px" }}>
                {league.name}
              </h1>
            </div>
          </div>

          {/* Nav */}
          <div style={{ display: "flex", gap: 0, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            {navItems.map(item =>
              item.key === "standings" && !leagueHasFullTable(slug) ? null : (
                <button key={item.key} onClick={() => setTab(item.key)} style={{
                  padding: "12px 18px", background: "none", border: "none", cursor: "pointer",
                  fontSize: 14, fontWeight: 600,
                  color: tab === item.key ? "#fff" : "rgba(255,255,255,0.55)",
                  borderBottom: tab === item.key ? "2px solid #fff" : "2px solid transparent",
                  transition: "all 0.15s",
                }}>
                  {item.label}
                </button>
              )
            )}
            <div style={{ padding: "0 18px", display: "flex", alignItems: "center" }}>
              <TeamsDropdown teams={teams} slug={slug} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="container" style={{ paddingTop: 28, paddingBottom: 48 }}>

        {/* FIXTURES */}
        {tab === "fixtures" && (
          <div>
            <DatePicker selected={selectedDate} onSelect={setSelectedDate} />
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16, fontSize: 12, color: state === "connected" ? "#16a34a" : "var(--text-muted)", fontWeight: 500 }}>
              {state === "connected" ? "● Live" : state === "connecting" ? "● Connecting" : "○ Offline"}
              {lastUpdate && <span style={{ marginLeft: 6, color: "var(--text-muted)" }}>· updated {new Date(lastUpdate).toLocaleTimeString()}</span>}
            </div>
            <div key={selectedKey} style={{ animation: "fadein 0.2s ease" }}>
              {dated.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-secondary)", margin: "0 0 6px" }}>No fixtures on this day</p>
                  <p style={{ fontSize: 13, margin: 0 }}>No matches scheduled or completed for this date.</p>
                </div>
              ) : (
                <>
                  {liveM.length > 0 && (
                    <section style={{ marginBottom: 28 }}>
                      <div className="section-label"><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff4d4d" }} />Live Now</div>
                      <div className="matches-grid">{liveM.map(m => <MatchCard key={m.id} match={m} />)}</div>
                    </section>
                  )}
                  {sched.length > 0 && (
                    <section style={{ marginBottom: 28 }}>
                      <div className="section-label">Scheduled</div>
                      <div className="matches-grid">{sched.map(m => <MatchCard key={m.id} match={m} />)}</div>
                    </section>
                  )}
                  {fin.length > 0 && (
                    <section style={{ marginBottom: 28 }}>
                      <div className="section-label">Finished</div>
                      <div className="matches-grid">{fin.map(m => <MatchCard key={m.id} match={m} />)}</div>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* STANDINGS */}
        {tab === "standings" && leagueHasFullTable(slug) && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, margin: "0 0 16px" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--obsidian)", margin: 0 }}>Standings</h2>
              <select
                value={season}
                onChange={onSeasonChange}
                style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, fontWeight: 600, color: "var(--obsidian)", background: "var(--white)", cursor: "pointer" }}
              >
                {availableSeasons.map(y => (
                  <option key={y} value={y}>{`${y}–${String(Number(y) + 1).slice(2)}`}</option>
                ))}
              </select>
            </div>
            {standings.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: 600 }}>
                  <StandingsTable rows={standings} league={slug} />
                </div>
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No standings available yet.</p>
            )}
          </div>
        )}

        {/* NEWS — uses NewsCard so users stay in-app */}
        {tab === "news" && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--obsidian)", margin: "0 0 16px" }}>Latest News</h2>
            {news.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No news available.</p>
            ) : (
              <div className="news-grid">
                {news.slice(0, 12).map(a => (
                  <NewsCard key={a.id} article={a} sport="football" />
                ))}
              </div>
            )}
          </div>
        )}

        {/* STATISTICS */}
        {tab === "statistics" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, margin: "0 0 20px" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--obsidian)", margin: 0 }}>
                Statistics
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)", marginLeft: 8 }}>{league.name}</span>
              </h2>
              <select
                value={season}
                onChange={onSeasonChange}
                style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, fontWeight: 600, color: "var(--obsidian)", background: "var(--white)", cursor: "pointer" }}
              >
                {availableSeasons.map(y => (
                  <option key={y} value={y}>{`${y}–${String(Number(y) + 1).slice(2)}`}</option>
                ))}
              </select>
            </div>
            {allCats.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-secondary)", margin: "0 0 6px" }}>No statistics available yet</p>
                <p style={{ fontSize: 13, margin: 0 }}>The season may not have started or no data has been recorded.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {allCats.map(cat => (
                  <LeaderCard key={cat.name} cat={cat} slug={slug} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .team-dropdown-row:hover { background: var(--cloud) !important; }
        .leader-row:hover { background: var(--cloud) !important; }
      `}</style>
    </div>
  );
}