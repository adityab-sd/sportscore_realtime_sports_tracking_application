"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { BBTeam, BBPlayer, BBStandingRow, BBNews, BBGame } from "@/lib/api/basketball";
import { classifyStatus, LeagueInfo } from "@/types/basketball";
import MatchCard from "./MatchCard";
import { ExpandableCard } from "@/components/ui/ExpandableCard";
import NewsCard from "@/components/news/NewsCard";

type Tab = "schedule" | "standings" | "roster" | "news" | "stats";

const POS_GROUPS = [
  { keys: ["PG", "SG", "G"],       label: "Guards" },
  { keys: ["SF", "PF", "F", "G-F", "F-G", "F-C"], label: "Forwards" },
  { keys: ["C", "C-F"],            label: "Centers" },
];

function groupRoster(roster: BBPlayer[]) {
  const groups: { label: string; players: BBPlayer[] }[] = [];
  const assigned = new Set<string>();
  for (const g of POS_GROUPS) {
    const players = roster.filter(p => p.position && g.keys.includes(p.position))
      .sort((a, b) => (parseInt(a.jersey ?? "999") || 999) - (parseInt(b.jersey ?? "999") || 999));
    if (players.length > 0) { players.forEach(p => assigned.add(p.id)); groups.push({ label: g.label, players }); }
  }
  const rest = roster.filter(p => !assigned.has(p.id));
  if (rest.length > 0) groups.push({ label: "Other", players: rest });
  return groups;
}

function monthKey(iso: string | null) { const t = iso ? Date.parse(iso) : NaN; if (!Number.isFinite(t)) return "unscheduled"; const d = new Date(t); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()).padStart(2, "0")}`; }
function monthLabel(iso: string | null) { const t = iso ? Date.parse(iso) : NaN; if (!Number.isFinite(t)) return "Date TBD"; return new Date(t).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }); }
function groupByMonth(games: BBGame[]) {
  const map = new Map<string, { label: string; games: BBGame[] }>();
  for (const g of games) { const key = monthKey(g.tipoff); if (!map.has(key)) map.set(key, { label: monthLabel(g.tipoff), games: [] }); map.get(key)!.games.push(g); }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
}

function EmptyState({ detail }: { detail?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-secondary)", margin: "0 0 6px" }}>Data is unavailable</p>
      {detail && <p style={{ fontSize: 13, margin: 0 }}>{detail}</p>}
    </div>
  );
}

function YearDropdown({ league, season, seasons }: { league: string; season: string; seasons: string[] }) {
  const router = useRouter(); const pathname = usePathname(); const [isPending, startTransition] = useTransition();
  return (
    <select aria-label="Select season" value={season} disabled={isPending}
      onChange={(e) => { const next = e.target.value; startTransition(() => { router.push(`${pathname}?league=${encodeURIComponent(league)}&season=${encodeURIComponent(next)}`); }); }}
      style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", opacity: isPending ? 0.6 : 1 }}>
      {seasons.map(y => <option key={y} value={y} style={{ color: "#0a1628" }}>{y}</option>)}
    </select>
  );
}

function playerInitials(name: string) { const parts = name.trim().split(/\s+/); if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase(); return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase(); }

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--obsidian)" }}>{children}</span>
    </div>
  );
}

function RosterTab({ roster, league, teamColor }: { roster: BBPlayer[]; league: string; teamColor: string | null }) {
  const grouped = groupRoster(roster);
  const accent = teamColor ? `#${teamColor.replace("#", "")}` : null;
  if (roster.length === 0) return <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Roster data unavailable.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {grouped.map(({ label, players }) => (
        <section key={label}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--obsidian)", margin: 0, textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</h3>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{players.length}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
            {players.map(p => (
              <ExpandableCard key={p.id} title={p.name} src={p.headshot} initials={playerInitials(p.name)} accentColor={accent}
                description={[p.position, p.jersey ? `#${p.jersey}` : null].filter(Boolean).join(" · ")}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {p.position && <DetailRow label="Position">{p.position}</DetailRow>}
                  {p.jersey && <DetailRow label="Jersey">#{p.jersey}</DetailRow>}
                  {p.age && <DetailRow label="Age">{p.age}</DetailRow>}
                  {p.nationality && <DetailRow label="Nationality">{p.nationality}</DetailRow>}
                  <Link href={`/basketball/player/${p.id}?league=${league}`} style={{ display: "block", marginTop: 14, fontSize: 13, fontWeight: 600, color: "#fff", textDecoration: "none", textAlign: "center", padding: "10px 0", background: accent ?? "var(--navy)", borderRadius: 8 }}>
                    View Player Profile
                  </Link>
                </div>
              </ExpandableCard>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function StatsTab({ teamStats, teamLeaders, league }: {
  teamStats: { category: string; stats: { label: string; value: string }[] }[];
  teamLeaders: { category: string; name: string; value: string; athleteId: string; headshot: string | null }[];
  league: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {teamLeaders.length > 0 && (
        <div>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--obsidian)", textTransform: "uppercase", letterSpacing: "0.6px", margin: "0 0 12px" }}>Team Leaders</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {teamLeaders.slice(0, 6).map((l, i) => (
              <Link key={`${l.category}-${i}`} href={l.athleteId ? `/basketball/player/${l.athleteId}?league=${league}` : "#"} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px", textDecoration: "none", display: "block", textAlign: "center" }}>
                {l.headshot && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.headshot} alt={l.name} width={40} height={40} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", background: "var(--cloud)", marginBottom: 8, border: "2px solid var(--border)" }} />
                )}
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>{l.category}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--obsidian)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name || "—"}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "var(--navy)" }}>{l.value}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
      {teamStats.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {teamStats.map((cat, ci) => (
            <div key={`${cat.category}-${ci}`} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--obsidian)", textTransform: "uppercase", letterSpacing: "0.6px" }}>{cat.category}</div>
              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>
                  <thead><tr>{cat.stats.map((s, si) => <th key={`${s.label}-${si}`} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{s.label}</th>)}</tr></thead>
                  <tbody><tr>{cat.stats.map((s, si) => <td key={`${s.label}-${si}`} style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: "var(--obsidian)", textAlign: "center", whiteSpace: "nowrap" }}>{s.value}</td>)}</tr></tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState detail="Stats will appear once the season is underway." />}
    </div>
  );
}

function FormBadge({ result }: { result: string }) {
  const color = result === "W" ? "#16a34a" : "#dc2626";
  return <span style={{ width: 24, height: 24, borderRadius: 6, background: color, color: "#fff", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{result}</span>;
}

export default function TeamPageClient({
  team, teamId, league, leagueInfo, roster, standingRow, news, seedGames, teamStats, teamLeaders, season, availableSeasons,
}: {
  team: BBTeam; teamId: string; league: string; leagueInfo: LeagueInfo | null;
  roster: BBPlayer[]; standingRow: BBStandingRow | null; news: BBNews[]; seedGames: BBGame[];
  teamStats: { category: string; stats: { label: string; value: string }[] }[];
  teamLeaders: { category: string; name: string; value: string; athleteId: string; headshot: string | null }[];
  season: string; availableSeasons: string[];
}) {
  const [tab, setTab] = useState<Tab>("schedule");
  const games = [...seedGames].sort((a, b) => Date.parse(a.tipoff ?? "0") - Date.parse(b.tipoff ?? "0"));
  const liveG = games.filter(g => classifyStatus(g.statusState) === "live");
  const monthGroups = groupByMonth(games);

  const bannerColor = team.color ? `linear-gradient(135deg, #${team.color.replace("#", "")} 0%, #0a1628 100%)`
    : leagueInfo ? `linear-gradient(135deg, ${leagueInfo.accent} 0%, #0a1628 100%)` : "linear-gradient(135deg, #1e3a5f 0%, #0a1628 100%)";

  const navItems: { key: Tab; label: string }[] = [
    { key: "schedule", label: "Schedule" }, { key: "standings", label: "Standings" },
    { key: "roster", label: "Roster" }, { key: "news", label: "News" }, { key: "stats", label: "Stats" },
  ];

  const finished = games.filter(g => classifyStatus(g.statusState) === "finished").sort((a, b) => Date.parse(b.tipoff ?? "0") - Date.parse(a.tipoff ?? "0")).slice(0, 5);
  const form = finished.map(g => {
    const isHome = String(g.homeTeam.id) === teamId;
    const ts = isHome ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
    const os = isHome ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
    return ts >= os ? "W" : "L";
  });
  const pct = standingRow ? standingRow.winPct.toFixed(3).replace(/^0/, "") : "";

  return (
    <div>
      <div style={{ background: bannerColor, position: "relative", overflow: "hidden" }}>
        {team.logo && (
          <div style={{ position: "absolute", right: -10, top: "50%", transform: "translateY(-50%)", opacity: 0.12, pointerEvents: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={team.logo} alt="" width={200} height={200} style={{ width: 200, height: 200, objectFit: "contain" }} />
          </div>
        )}
        <div className="container" style={{ paddingTop: 24, paddingBottom: 0, position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
            {team.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={team.logo} alt={team.name} width={72} height={72} style={{ width: 72, height: 72, objectFit: "contain", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>{leagueInfo?.name ?? league}</div>
              <h1 style={{ fontSize: "clamp(24px,4vw,40px)", fontWeight: 900, color: "#fff", margin: "0 0 6px", letterSpacing: "-1px" }}>{team.name}</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {team.venue && <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{team.venue}</span>}
                {standingRow && <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>· {standingRow.wins}-{standingRow.losses} · {pct}</span>}
              </div>
            </div>
            {form.length > 0 && <div style={{ display: "flex", gap: 4 }}>{form.map((r, i) => <FormBadge key={i} result={r} />)}</div>}
          </div>

          {standingRow && (
            <div style={{ display: "flex", gap: 20, marginBottom: 16, flexWrap: "wrap" }}>
              {[
                { label: "W", value: standingRow.wins },
                { label: "L", value: standingRow.losses },
                { label: "PCT", value: pct },
                { label: "GB", value: standingRow.gamesBehind === 0 ? "—" : standingRow.gamesBehind },
                { label: "STRK", value: standingRow.streak ?? "—" },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.4px" }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            <div style={{ display: "flex" }}>
              {navItems.map(item => (
                <button key={item.key} onClick={() => setTab(item.key)} style={{ padding: "12px 18px", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, color: tab === item.key ? "#fff" : "rgba(255,255,255,0.55)", borderBottom: tab === item.key ? "2px solid #fff" : "2px solid transparent", transition: "all 0.15s" }}>{item.label}</button>
              ))}
            </div>
            {(tab === "schedule" || tab === "standings" || tab === "stats") && <YearDropdown league={league} season={season} seasons={availableSeasons} />}
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 28, paddingBottom: 48 }}>
        {tab === "schedule" && (
          <div>
            {games.length === 0 ? <EmptyState detail={`No games found for ${team.shortName} in ${season}.`} /> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                {liveG.length > 0 && (
                  <section>
                    <div className="section-label"><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff4d4d" }} />Live Now</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{liveG.map(g => <MatchCard key={g.id} game={g} leagueSlug={league} />)}</div>
                  </section>
                )}
                {monthGroups.map(group => (
                  <section key={group.label}>
                    <div className="section-label">{group.label}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{group.games.map(g => <MatchCard key={g.id} game={g} leagueSlug={league} />)}</div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "standings" && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--obsidian)", margin: "0 0 16px" }}>Conference Standing</h2>
            {standingRow ? (
              <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr repeat(5,auto)", gap: 0 }}>
                  {["#", "Team", "W", "L", "PCT", "GB", "STRK"].map(h => (
                    <div key={h} style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", borderBottom: "1px solid var(--border)", textAlign: h === "#" || h === "Team" ? "left" : "center" }}>{h}</div>
                  ))}
                  {[standingRow.rank, standingRow.team, standingRow.wins, standingRow.losses, pct, standingRow.gamesBehind === 0 ? "—" : standingRow.gamesBehind, standingRow.streak ?? "—"].map((v, i) => (
                    <div key={i} style={{ padding: "12px", fontSize: 13, fontWeight: i === 4 ? 800 : 500, color: i === 4 ? "var(--navy)" : "var(--obsidian)", textAlign: i < 2 ? "left" : "center", background: "var(--cloud)" }}>{v}</div>
                  ))}
                </div>
                <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)", textAlign: "right" }}>
                  <Link href={`/basketball/league/${league}`} style={{ fontSize: 12, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>View full standings →</Link>
                </div>
              </div>
            ) : <EmptyState detail={`No standings found for ${league} in ${season}.`} />}
          </div>
        )}

        {tab === "roster" && <RosterTab roster={roster} league={league} teamColor={team.color} />}

        {tab === "news" && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--obsidian)", margin: "0 0 16px" }}>Latest News</h2>
            {news.length === 0 ? <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No news available.</p> : (
              <div className="news-grid">{news.map(a => <NewsCard key={a.id} article={a} sport="basketball" />)}</div>
            )}
          </div>
        )}

        {tab === "stats" && <StatsTab teamStats={teamStats} teamLeaders={teamLeaders} league={league} />}
      </div>
    </div>
  );
}
