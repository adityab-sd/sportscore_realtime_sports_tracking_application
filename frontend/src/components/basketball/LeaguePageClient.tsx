"use client";
import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { BBFixture, BBStandingRow, BBNews, BBLeader } from "@/lib/api/basketball";
import { LeagueInfo, classifyStatus } from "@/types/basketball";
import MatchCard from "./MatchCard";
import StandingsTable from "./StandingsTable";
import NewsCard from "@/components/news/NewsCard";
import { useRouter, useSearchParams } from "next/navigation";

type Tab = "fixtures" | "standings" | "news" | "statistics";
interface Team { id: string; name: string; logo: string | null }
const SPORT_PATH = "/basketball";

// ─── Local-time date helpers (consistent with the live feed) ─────────────────
function startOfDayLocal(d: Date) { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; }
function addDays(d: Date, n: number) { const c = new Date(d); c.setDate(c.getDate() + n); c.setHours(0, 0, 0, 0); return c; }
function toKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function pillLabel(d: Date, today: Date) {
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === -1) return "Yesterday";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-US", { day: "2-digit", weekday: "short" }).replace(",", "");
}
function isSameDay(iso: string | null, date: Date) {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  const k = new Date(t);
  return k.getFullYear() === date.getFullYear() && k.getMonth() === date.getMonth() && k.getDate() === date.getDate();
}
function pickInitialDate(games: BBFixture[], today: Date): Date {
  const keys = new Set<number>();
  for (const g of games) {
    const t = g.tipoff ? Date.parse(g.tipoff) : NaN;
    if (Number.isFinite(t)) { const d = new Date(t); d.setHours(0, 0, 0, 0); keys.add(d.getTime()); }
  }
  const todayMs = today.getTime();
  if (keys.has(todayMs) || keys.size === 0) return today;
  let best = todayMs, bestDist = Infinity;
  for (const k of keys) { const dist = Math.abs(k - todayMs); if (dist < bestDist || (dist === bestDist && k < todayMs)) { best = k; bestDist = dist; } }
  return new Date(best);
}

function DatePicker({ selected, onSelect }: { selected: Date; onSelect: (d: Date) => void }) {
  const today = startOfDayLocal(new Date());
  const [windowStart, setWindowStart] = useState(() => addDays(startOfDayLocal(selected), -1));
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pills = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(windowStart, i)), [windowStart]);
  const monthLabel = [...new Set(pills.map(p => p.toLocaleDateString("en-US", { month: "long", year: "numeric" })))].join(" / ");
  const isToday = toKey(selected) === toKey(today);
  function shift(dir: "left" | "right") {
    setSlideDir(dir);
    if (animRef.current) clearTimeout(animRef.current);
    animRef.current = setTimeout(() => { setWindowStart(prev => addDays(prev, dir === "right" ? 7 : -7)); setSlideDir(null); }, 180);
  }
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, justifyContent: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>{monthLabel}</span>
        {!isToday && <button onClick={() => { onSelect(today); setWindowStart(addDays(today, -1)); }} style={{ fontSize: 12, fontWeight: 600, color: "var(--navy)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>· Return to today</button>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", overflow: "hidden" }}>
        <button onClick={() => shift("left")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--text-secondary)", padding: "0 4px", lineHeight: 1 }}>‹</button>
        <div style={{ display: "flex", gap: 6, transition: "transform 0.18s ease, opacity 0.18s ease", transform: slideDir === "right" ? "translateX(-20px)" : slideDir === "left" ? "translateX(20px)" : "none", opacity: slideDir ? 0 : 1 }}>
          {pills.map(d => {
            const key = toKey(d);
            const isSelected = key === toKey(selected);
            const parts = pillLabel(d, today).split(" ");
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <button key={key} onClick={() => onSelect(d)} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 72, height: 52, borderRadius: 8, cursor: "pointer", flexShrink: 0, border: isSelected ? "2px solid var(--navy)" : "1px solid var(--border)", background: isSelected ? "var(--navy)" : "var(--white)", color: isSelected ? "#fff" : isWeekend ? "var(--text-secondary)" : "var(--obsidian)", transition: "all 0.15s ease", transform: isSelected ? "translateY(-1px)" : "none", boxShadow: isSelected ? "0 4px 12px rgba(0,63,136,0.25)" : "none" }}>
                <span style={{ fontSize: parts[0].length > 5 ? 9 : 11, fontWeight: 700, lineHeight: 1.2 }}>{parts[0]}</span>
                {parts[1] && <span style={{ fontSize: 9, fontWeight: 500, opacity: 0.7, lineHeight: 1.2 }}>{parts[1]}</span>}
              </button>
            );
          })}
        </div>
        <button onClick={() => shift("right")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--text-secondary)", padding: "0 4px", lineHeight: 1 }}>›</button>
      </div>
    </div>
  );
}

function TeamsDropdown({ teams }: { teams: Team[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.55)", padding: "10px 0", display: "flex", alignItems: "center", gap: 4 }}>
        Teams <span style={{ fontSize: 10 }}>▾</span>
      </button>
      {open && teams.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 100, width: 520, maxHeight: 420, overflowY: "auto", padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
          {teams.map(t => (
            <Link key={t.id} href={`${SPORT_PATH}/team/${t.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, textDecoration: "none" }} className="team-dropdown-row">
              {t.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.logo} alt="" width={24} height={24} style={{ width: 24, height: 24, objectFit: "contain", flexShrink: 0 }} />
              ) : <div style={{ width: 24, height: 24, borderRadius: 4, background: "var(--cloud)", flexShrink: 0 }} />}
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--obsidian)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function groupLeaders(leaders: BBLeader[]): { category: string; rows: BBLeader[] }[] {
  const map = new Map<string, BBLeader[]>();
  for (const l of leaders) { if (!map.has(l.category)) map.set(l.category, []); map.get(l.category)!.push(l); }
  return Array.from(map.entries()).map(([category, rows]) => ({ category, rows: rows.slice(0, 10) }));
}

function LeaderCard({ category, rows }: { category: string; rows: BBLeader[] }) {
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--obsidian)", textTransform: "uppercase", letterSpacing: "0.6px" }}>{category}</div>
      {rows.map((e, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: e.rank <= 3 ? "#EA580C" : "var(--text-muted)", width: 20, textAlign: "center", flexShrink: 0 }}>{e.rank}</span>
          {e.headshot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.headshot} alt="" width={32} height={32} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", background: "var(--cloud)", flexShrink: 0 }} onError={(ev) => { (ev.target as HTMLImageElement).style.display = "none"; }} />
          ) : <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--navy-light)", flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.player || "—"}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.team}</div>
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, color: "var(--navy)", flexShrink: 0 }}>{e.displayValue}</span>
        </div>
      ))}
    </div>
  );
}

export default function LeaguePageClient({
  league, slug, standings, seedGames, news, leaders, teams, season, availableSeasons,
}: {
  league: LeagueInfo; slug: string; standings: BBStandingRow[]; seedGames: BBFixture[]; news: BBNews[]; leaders: BBLeader[]; teams: Team[];
  season: string; availableSeasons: string[];
}) {
  const [tab, setTab] = useState<Tab>("fixtures");
  const router = useRouter();
  const searchParams = useSearchParams();
  function onSeasonChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("season", e.target.value);
    router.push(`${SPORT_PATH}/league/${slug}?${params.toString()}`);
  }
  const today = startOfDayLocal(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => pickInitialDate(seedGames, today));

  const dated = seedGames.filter(g => isSameDay(g.tipoff, selectedDate));
  const liveM = dated.filter(g => classifyStatus(g.statusState) === "live");
  const sched = dated.filter(g => classifyStatus(g.statusState) === "scheduled");
  const fin = dated.filter(g => classifyStatus(g.statusState) === "finished");
  const selectedKey = toKey(selectedDate);
  const leaderGroups = groupLeaders(leaders);

  const navItems: { key: Tab; label: string }[] = [
    { key: "fixtures", label: "Fixtures" },
    { key: "standings", label: "Standings" },
    { key: "news", label: "News" },
    { key: "statistics", label: "Statistics" },
  ];

  return (
    <div>
      <div style={{ background: `linear-gradient(135deg, ${league.accent} 0%, #0a1628 100%)` }}>
        <div className="container" style={{ paddingTop: 24, paddingBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            {league.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={league.logo} alt={league.name} width={64} height={64} style={{ width: 64, height: 64, objectFit: "contain", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.3))" }} />
            )}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>Basketball League</div>
              <h1 style={{ fontSize: "clamp(22px,4vw,36px)", fontWeight: 900, color: "#fff", margin: 0, letterSpacing: "-0.5px" }}>{league.name}</h1>
            </div>
          </div>
          <div style={{ display: "flex", gap: 0, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            {navItems.map(item => (
              <button key={item.key} onClick={() => setTab(item.key)} style={{ padding: "12px 18px", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, color: tab === item.key ? "#fff" : "rgba(255,255,255,0.55)", borderBottom: tab === item.key ? "2px solid #fff" : "2px solid transparent", transition: "all 0.15s" }}>{item.label}</button>
            ))}
            <div style={{ padding: "0 18px", display: "flex", alignItems: "center" }}>
              <TeamsDropdown teams={teams} />
            </div>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 28, paddingBottom: 48 }}>
        {tab === "fixtures" && (
          <div>
            <DatePicker selected={selectedDate} onSelect={setSelectedDate} />
            <div key={selectedKey} style={{ animation: "fadein 0.2s ease" }}>
              {dated.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-secondary)", margin: "0 0 6px" }}>No fixtures on this day</p>
                  <p style={{ fontSize: 13, margin: 0 }}>No games scheduled or completed for this date.</p>
                </div>
              ) : (
                <>
                  {liveM.length > 0 && (
                    <section style={{ marginBottom: 28 }}>
                      <div className="section-label"><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff4d4d" }} />Live Now</div>
                      <div className="matches-grid">{liveM.map(m => <MatchCard key={m.id} game={m} leagueSlug={slug} />)}</div>
                    </section>
                  )}
                  {sched.length > 0 && (
                    <section style={{ marginBottom: 28 }}>
                      <div className="section-label">Scheduled</div>
                      <div className="matches-grid">{sched.map(m => <MatchCard key={m.id} game={m} leagueSlug={slug} />)}</div>
                    </section>
                  )}
                  {fin.length > 0 && (
                    <section style={{ marginBottom: 28 }}>
                      <div className="section-label">Finished</div>
                      <div className="matches-grid">{fin.map(m => <MatchCard key={m.id} game={m} leagueSlug={slug} />)}</div>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {tab === "standings" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, margin: "0 0 16px" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--obsidian)", margin: 0 }}>Standings</h2>
              <select value={season} onChange={onSeasonChange}
                style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, fontWeight: 600, color: "var(--obsidian)", background: "var(--white)", cursor: "pointer" }}>
                {availableSeasons.map(y => (
                  <option key={y} value={y}>{`${Number(y) - 1}–${y.slice(2)}`}</option>
                ))}
              </select>
            </div>
            {standings.length > 0 ? <StandingsTable rows={standings} league={slug} /> : <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No standings available yet.</p>}
          </div>
        )}

        {tab === "news" && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--obsidian)", margin: "0 0 16px" }}>Latest News</h2>
            {news.length === 0 ? <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No news available.</p> : <div className="news-grid">{news.slice(0, 12).map(a => <NewsCard key={a.id} article={a} sport="basketball" />)}</div>}
          </div>
        )}

        {tab === "statistics" && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--obsidian)", margin: "0 0 20px" }}>Statistics<span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)", marginLeft: 8 }}>{league.name}</span></h2>
            {leaderGroups.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-secondary)", margin: "0 0 6px" }}>No statistics available yet</p>
                <p style={{ fontSize: 13, margin: 0 }}>The season may not have started or no data has been recorded.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
                {leaderGroups.map(g => <LeaderCard key={g.category} category={g.category} rows={g.rows} />)}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .team-dropdown-row:hover { background: var(--cloud) !important; }
      `}</style>
    </div>
  );
}