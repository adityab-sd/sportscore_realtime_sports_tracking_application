"use client";
import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSignalR } from "@/hooks/useSignalR";
import { Match, classifyStatus } from "@/types/football";
import { ESPNTeam, ESPNPlayer, ESPNStandingRow, ESPNNews } from "@/lib/api/espn";
import MatchCard from "./MatchCard";
import { ExpandableCard } from "@/components/ui/ExpandableCard";
import NewsCard from "@/components/news/NewsCard";

type Tab = "fixtures" | "standings" | "squad" | "news" | "stats";

// ─── Country flags ─────────────────────────────────────────────────────────────
const COUNTRY_TO_ISO: Record<string, string> = {
  "Argentina":"ar","Australia":"au","Austria":"at","Belgium":"be","Bolivia":"bo",
  "Brazil":"br","Cameroon":"cm","Canada":"ca","Chile":"cl","Colombia":"co",
  "Costa Rica":"cr","Croatia":"hr","Czech Republic":"cz","Czechia":"cz","Denmark":"dk",
  "Ecuador":"ec","Egypt":"eg","England":"gb-eng","France":"fr","Germany":"de",
  "Ghana":"gh","Greece":"gr","Honduras":"hn","Hungary":"hu","Iceland":"is","Iran":"ir",
  "Ireland":"ie","Republic of Ireland":"ie","Italy":"it","Ivory Coast":"ci","Jamaica":"jm",
  "Japan":"jp","Kenya":"ke","Mexico":"mx","Morocco":"ma","Netherlands":"nl",
  "New Zealand":"nz","Nigeria":"ng","North Macedonia":"mk","Norway":"no","Panama":"pa",
  "Paraguay":"py","Peru":"pe","Poland":"pl","Portugal":"pt","Romania":"ro","Russia":"ru",
  "Saudi Arabia":"sa","Scotland":"gb-sct","Senegal":"sn","Serbia":"rs","Slovenia":"si",
  "South Korea":"kr","Korea Republic":"kr","Spain":"es","Sweden":"se","Switzerland":"ch",
  "Trinidad and Tobago":"tt","Tunisia":"tn","Turkey":"tr","Ukraine":"ua",
  "United States":"us","United States of America":"us","Uruguay":"uy","Venezuela":"ve",
  "Wales":"gb-wls","Zambia":"zm","Zimbabwe":"zw",
};

function Flag({ nationality }: { nationality: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!nationality) return null;
  const code = COUNTRY_TO_ISO[nationality];
  if (!code || failed) return <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{nationality.slice(0,2).toUpperCase()}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`https://flagcdn.com/w40/${code}.png`} alt={nationality} width={22} height={16}
      onError={() => setFailed(true)}
      style={{ width: 22, height: 16, objectFit: "cover", borderRadius: 2, border: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }} />
  );
}

// ─── Position grouping ─────────────────────────────────────────────────────────
const POS_GROUPS = [
  { keys: ["G","GK"],                              label: "Goalkeepers" },
  { keys: ["D","DF","CB","LB","RB","LWB","RWB"],   label: "Defenders" },
  { keys: ["M","MF","CM","CDM","CAM","LM","RM"],   label: "Midfielders" },
  { keys: ["F","FW","ST","CF","LW","RW","SS"],      label: "Attackers" },
];

function groupRoster(roster: ESPNPlayer[]) {
  const groups: { label: string; players: ESPNPlayer[] }[] = [];
  const assigned = new Set<string>();
  for (const g of POS_GROUPS) {
    const players = roster
      .filter(p => p.position && g.keys.includes(p.position))
      .sort((a,b) => (parseInt(a.jersey ?? "999") || 999) - (parseInt(b.jersey ?? "999") || 999));
    if (players.length > 0) {
      players.forEach(p => assigned.add(p.id));
      groups.push({ label: g.label, players });
    }
  }
  const rest = roster.filter(p => !assigned.has(p.id));
  if (rest.length > 0) groups.push({ label: "Other", players: rest });
  return groups;
}

// ─── Month grouping (for fixtures feed) ────────────────────────────────────────
function monthKey(kickoff: string | null) {
  const t = kickoff ? Date.parse(kickoff) : NaN;
  if (!Number.isFinite(t)) return "unscheduled";
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()).padStart(2,"0")}`;
}
function monthLabel(kickoff: string | null) {
  const t = kickoff ? Date.parse(kickoff) : NaN;
  if (!Number.isFinite(t)) return "Date TBD";
  return new Date(t).toLocaleDateString("en-US", { month:"long", year:"numeric", timeZone:"UTC" });
}
function groupByMonth(matches: Match[]) {
  const map = new Map<string, { label: string; matches: Match[] }>();
  for (const m of matches) {
    const key = monthKey(m.kickoff);
    if (!map.has(key)) map.set(key, { label: monthLabel(m.kickoff), matches: [] });
    map.get(key)!.matches.push(m);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

// ─── Shared empty state ────────────────────────────────────────────────────────
function EmptyState({ detail }: { detail?: string }) {
  return (
    <div style={{ textAlign:"center", padding:"48px 0", color:"var(--text-muted)" }}>
      <p style={{ fontSize:15, fontWeight:700, color:"var(--text-secondary)", margin:"0 0 6px" }}>Data is unavailable</p>
      {detail && <p style={{ fontSize:13, margin:0 }}>{detail}</p>}
    </div>
  );
}

// ─── Year / Season Dropdown ────────────────────────────────────────────────────
function YearDropdown({ league, season, seasons }: { league: string; season: string; seasons: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  return (
    <select
      aria-label="Select season"
      value={season}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(() => {
          router.push(`${pathname}?league=${encodeURIComponent(league)}&season=${encodeURIComponent(next)}`);
        });
      }}
      style={{
        fontSize:13, fontWeight:600, color:"#fff", background:"rgba(255,255,255,0.1)",
        border:"1px solid rgba(255,255,255,0.25)", borderRadius:8, padding:"6px 10px",
        cursor:"pointer", opacity: isPending ? 0.6 : 1,
      }}
    >
      {seasons.map(y => (
        <option key={y} value={y} style={{ color:"#0a1628" }}>{y}</option>
      ))}
    </select>
  );
}

// ─── Squad Tab ────────────────────────────────────────────────────────────────
function playerInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid var(--border)" }}>
      <span style={{ fontSize:12, color:"var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize:12, fontWeight:600, color:"var(--obsidian)" }}>{children}</span>
    </div>
  );
}

function SquadTab({ roster, league, teamId, teamColor }: { roster: ESPNPlayer[]; league: string; teamId: string; teamColor: string | null }) {
  const grouped = groupRoster(roster);
  const accent = teamColor ? `#${teamColor.replace("#","")}` : null;

  if (roster.length === 0) return <p style={{ fontSize:13, color:"var(--text-muted)" }}>Squad data unavailable.</p>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:28 }}>
      {grouped.map(({ label, players }) => (
        <section key={label}>
          <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:12, paddingBottom:8, borderBottom:"2px solid var(--border)" }}>
            <h3 style={{ fontSize:14, fontWeight:800, color:"var(--obsidian)", margin:0, textTransform:"uppercase", letterSpacing:"0.4px" }}>{label}</h3>
            <span style={{ fontSize:12, color:"var(--text-muted)", fontWeight:500 }}>{players.length}</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))", gap:12 }}>
            {players.map(p => {
              const headshot = `https://a.espncdn.com/i/headshots/soccer/players/full/${p.id}.png`;
              return (
                <ExpandableCard
                  key={p.id}
                  title={p.name}
                  src={headshot}
                  initials={playerInitials(p.name)}
                  accentColor={accent}
                  description={[p.position, p.jersey ? `#${p.jersey}` : null].filter(Boolean).join(" · ")}
                >
                  {/* Expanded content */}
                  <div style={{ display:"flex", flexDirection:"column" }}>
                    {p.position && (
                      <DetailRow label="Position">{p.position}</DetailRow>
                    )}
                    {p.jersey && (
                      <DetailRow label="Jersey">#{p.jersey}</DetailRow>
                    )}
                    {p.age && (
                      <DetailRow label="Age">{p.age}</DetailRow>
                    )}
                    {p.nationality && (
                      <DetailRow label="Nationality">
                        <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                          <Flag nationality={p.nationality} />
                          {p.nationality}
                        </span>
                      </DetailRow>
                    )}
                    <Link
                      href={`/football/player/${p.id}?league=${league}`}
                      style={{
                        display:"block", marginTop:14, fontSize:13, fontWeight:600,
                        color:"#fff", textDecoration:"none", textAlign:"center",
                        padding:"10px 0", background: accent ?? "var(--navy)",
                        borderRadius:8, transition:"opacity 0.15s",
                      }}
                    >
                      View Player Profile
                    </Link>
                  </div>
                </ExpandableCard>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────
// Standard short-form abbreviations for known metric names; unknown labels fall
// back to an auto-generated initialism (e.g. "Big Chances Created" → "BCC").
const STAT_ABBREV: Record<string, string> = {
  "Games Played": "GP", "Appearances": "APP", "Goals": "GF", "Goals Against": "GA",
  "Goal Difference": "GD", "Assists": "AST", "Yellow Cards": "YEL", "Red Cards": "RED",
  "Shots": "SH", "Shots on Target": "SOT", "Fouls": "FLS", "Fouls Suffered": "FLSF",
  "Offsides": "OFF", "Corners": "COR", "Saves": "SV", "Clean Sheets": "CS",
  "Wins": "W", "Losses": "L", "Draws": "D", "Points": "PTS",
  "Penalty Kick Goals": "PKG", "Penalty Kicks Attempted": "PKA",
};
function abbreviate(label: string): string {
  if (STAT_ABBREV[label]) return STAT_ABBREV[label];
  const initials = label.split(/\s+/).filter(Boolean).map(w => w[0]).join("").toUpperCase();
  return initials.length >= 2 ? initials.slice(0, 4) : label.slice(0, 3).toUpperCase();
}

function StatTh({ label }: { label: string }) {
  return (
    <th className="stat-th" style={{ padding:"10px 14px", fontSize:11, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.4px", borderBottom:"1px solid var(--border)", whiteSpace:"nowrap", position:"relative" }}>
      {abbreviate(label)}
      <span className="stat-tooltip" role="tooltip">{label}</span>
    </th>
  );
}

function StatsTab({ teamStats, teamLeaders, league }: {
  teamStats: { category: string; stats: { label: string; value: string }[] }[];
  teamLeaders: { category: string; name: string; value: string; athleteId: string; headshot: string | null }[];
  league: string;
}) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>

      {/* Team Leaders */}
      {teamLeaders.length > 0 && (
        <div>
          <h2 style={{ fontSize:13, fontWeight:700, color:"var(--obsidian)", textTransform:"uppercase", letterSpacing:"0.6px", margin:"0 0 12px" }}>Team Leaders</h2>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
            {teamLeaders.slice(0, 6).map((l, i) => (
              <Link key={`${l.category}-${i}`} href={l.athleteId ? `/football/player/${l.athleteId}?league=${league}` : "#"}
                style={{ background:"var(--white)", border:"1px solid var(--border)", borderRadius:10, padding:"14px", textDecoration:"none", display:"block", textAlign:"center", transition:"border-color 0.15s" }}
                className="leader-card">
                {l.headshot && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.headshot} alt={l.name} width={40} height={40}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    style={{ width:40, height:40, borderRadius:"50%", objectFit:"cover", background:"var(--cloud)", marginBottom:8, border:"2px solid var(--border)" }} />
                )}
                <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.4px", marginBottom:4 }}>{l.category}</div>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--obsidian)", marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.name || "—"}</div>
                <div style={{ fontSize:20, fontWeight:900, color:"var(--navy)" }}>{l.value}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Team Stats by category — horizontal, scrollable tables */}
      {teamStats.length > 0 ? (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {teamStats.map((cat, ci) => (
            <div key={`${cat.category}-${ci}`} style={{ background:"var(--white)", border:"1px solid var(--border)", borderRadius:10, overflow:"hidden" }}>
              <div style={{ padding:"10px 14px", borderBottom:"1px solid var(--border)", fontSize:12, fontWeight:700, color:"var(--obsidian)", textTransform:"uppercase", letterSpacing:"0.6px" }}>
                {cat.category}
              </div>
              <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
                <table style={{ borderCollapse:"collapse", width:"max-content", minWidth:"100%" }}>
                  <thead>
                    <tr>
                      {cat.stats.map((s, si) => <StatTh key={`${s.label}-${si}`} label={s.label} />)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {cat.stats.map((s, si) => (
                        <td key={`${s.label}-${si}`} style={{ padding:"12px 14px", fontSize:13, fontWeight:700, color:"var(--obsidian)", textAlign:"center", whiteSpace:"nowrap" }}>
                          {s.value}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState detail="Stats will appear once the season is underway." />
      )}
      <style>{`
        .leader-card:hover { border-color: var(--navy) !important; }
        .stat-tooltip {
          position:absolute; bottom:calc(100% + 6px); left:50%; transform:translateX(-50%) translateY(2px);
          background:var(--obsidian); color:#fff; font-size:11px; font-weight:600; text-transform:none;
          letter-spacing:normal; white-space:nowrap; padding:5px 8px; border-radius:6px;
          opacity:0; pointer-events:none; transition:opacity 0.12s ease, transform 0.12s ease; z-index:5;
        }
        .stat-tooltip::after {
          content:""; position:absolute; top:100%; left:50%; transform:translateX(-50%);
          border:5px solid transparent; border-top-color:var(--obsidian);
        }
        .stat-th:hover .stat-tooltip { opacity:1; transform:translateX(-50%) translateY(0); }
      `}</style>
    </div>
  );
}

// ─── Form Guide ───────────────────────────────────────────────────────────────
function FormBadge({ result }: { result: string }) {
  const color = result === "W" ? "#16a34a" : result === "D" ? "#d97706" : "#dc2626";
  return (
    <span style={{ width:24, height:24, borderRadius:6, background:color, color:"#fff", fontSize:11, fontWeight:800, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
      {result}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TeamPageClient({
  team, teamId, league, leagueInfo, roster, standingRow, news, seedMatches, teamStats, teamLeaders,
  season, availableSeasons,
}: {
  team: ESPNTeam;
  teamId: string;
  league: string;
  leagueInfo: { slug: string; name: string; short: string; logo: string; accent: string } | null;
  roster: ESPNPlayer[];
  standingRow: ESPNStandingRow | null;
  news: ESPNNews[];
  seedMatches: Match[];
  teamStats: { category: string; stats: { label: string; value: string }[] }[];
  teamLeaders: { category: string; name: string; value: string; athleteId: string; headshot: string | null }[];
  season: string;
  availableSeasons: string[];
}) {
  const [tab, setTab] = useState<Tab>("fixtures");
  const { matches: live } = useSignalR();

  // Merge seed + live. seedMatches are already team-specific from ESPN's
  // /teams/{id}/schedule endpoint, so we trust them all. Live SignalR updates
  // are league-wide, so those still need filtering.
  const seedIds = new Set(seedMatches.map(m => m.id));
  const byId = new Map<number, Match>();
  for (const m of seedMatches) byId.set(m.id, m);
  for (const m of live.filter(m => !m.sport || m.sport === "football")) {
    // Only merge live matches that are either updates to existing seeds or belong to this team
    if (seedIds.has(m.id) || String(m.homeTeam?.id) === String(teamId) || String(m.awayTeam?.id) === String(teamId)) {
      byId.set(m.id, m);
    }
  }
  const teamMatches = Array.from(byId.values());
  const liveM = teamMatches.filter(m => classifyStatus(m.status) === "live");
  const monthGroups = groupByMonth(
    [...teamMatches].sort((a, b) => Date.parse(a.kickoff ?? "0") - Date.parse(b.kickoff ?? "0"))
  );

  const bannerColor = team.color
    ? `linear-gradient(135deg, #${team.color.replace("#","")} 0%, #0a1628 100%)`
    : leagueInfo
    ? `linear-gradient(135deg, ${leagueInfo.accent} 0%, #0a1628 100%)`
    : "linear-gradient(135deg, #1e3a5f 0%, #0a1628 100%)";

  const navItems: { key: Tab; label: string }[] = [
    { key: "fixtures", label: "Fixtures" },
    { key: "standings", label: "Standings" },
    { key: "squad", label: "Squad" },
    { key: "news", label: "News" },
    { key: "stats", label: "Stats" },
  ];

  // Form guide from last 5 finished matches
  const finished = teamMatches
    .filter(m => classifyStatus(m.status) === "finished")
    .sort((a,b) => Date.parse(b.kickoff ?? "0") - Date.parse(a.kickoff ?? "0"))
    .slice(0, 5);
  const form = finished.map(m => {
    const isHome = String(m.homeTeam.id) === teamId;
    const gs = isHome ? (m.homeScore ?? 0) : (m.awayScore ?? 0);
    const gc = isHome ? (m.awayScore ?? 0) : (m.homeScore ?? 0);
    return gs > gc ? "W" : gs < gc ? "L" : "D";
  });

  return (
    <div>
      {/* ── Banner ── */}
      <div style={{ background: bannerColor, position:"relative", overflow:"hidden" }}>
        {/* Faint crest watermark */}
        {team.logo && (
          <div style={{ position:"absolute", right:-10, top:"50%", transform:"translateY(-50%)", opacity:0.12, pointerEvents:"none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={team.logo} alt="" width={200} height={200} style={{ width:200, height:200, objectFit:"contain" }} />
          </div>
        )}
        <div className="container" style={{ paddingTop:24, paddingBottom:0, position:"relative", zIndex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:20, marginBottom:20, flexWrap:"wrap" }}>
            {team.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={team.logo} alt={team.name} width={72} height={72}
                style={{ width:72, height:72, objectFit:"contain", filter:"drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }} />
            )}
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:4 }}>
                {leagueInfo?.name ?? league}
              </div>
              <h1 style={{ fontSize:"clamp(24px,4vw,40px)", fontWeight:900, color:"#fff", margin:"0 0 6px", letterSpacing:"-1px" }}>{team.name}</h1>
              <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                {team.venue && <span style={{ fontSize:13, color:"rgba(255,255,255,0.6)" }}>{team.venue}</span>}
                {standingRow && (
                  <span style={{ fontSize:13, color:"rgba(255,255,255,0.6)" }}>
                    · {standingRow.rank}{standingRow.rank===1?"st":standingRow.rank===2?"nd":standingRow.rank===3?"rd":"th"} place
                    · {standingRow.points} pts
                  </span>
                )}
              </div>
            </div>
            {/* Form guide */}
            {form.length > 0 && (
              <div style={{ display:"flex", gap:4 }}>
                {form.map((r,i) => <FormBadge key={i} result={r} />)}
              </div>
            )}
          </div>

          {/* Standing snapshot */}
          {standingRow && (
            <div style={{ display:"flex", gap:20, marginBottom:16, flexWrap:"wrap" }}>
              {[
                { label:"P", value:standingRow.played },
                { label:"W", value:standingRow.won },
                { label:"D", value:standingRow.drawn },
                { label:"L", value:standingRow.lost },
                { label:"GF", value:standingRow.goalsFor },
                { label:"GA", value:standingRow.goalsAgainst },
                { label:"GD", value:(standingRow.goalDiff > 0 ? "+" : "") + standingRow.goalDiff },
                { label:"PTS", value:standingRow.points },
              ].map(s => (
                <div key={s.label} style={{ textAlign:"center" }}>
                  <div style={{ fontSize:16, fontWeight:800, color:"#fff", lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontSize:10, fontWeight:600, color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:"0.4px" }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Nav */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", borderTop:"1px solid rgba(255,255,255,0.12)" }}>
            <div style={{ display:"flex" }}>
              {navItems.map(item => (
                <button key={item.key} onClick={() => setTab(item.key)} style={{ padding:"12px 18px", background:"none", border:"none", cursor:"pointer", fontSize:14, fontWeight:600, color: tab===item.key?"#fff":"rgba(255,255,255,0.55)", borderBottom: tab===item.key?"2px solid #fff":"2px solid transparent", transition:"all 0.15s" }}>
                  {item.label}
                </button>
              ))}
            </div>
            {(tab === "fixtures" || tab === "standings" || tab === "stats") && (
              <YearDropdown league={league} season={season} seasons={availableSeasons} />
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="container" style={{ paddingTop:28, paddingBottom:48 }}>

        {/* FIXTURES */}
        {tab === "fixtures" && (
          <div>
            {teamMatches.length === 0 ? (
              <EmptyState detail={`No matches found for ${team.shortName} in ${season}.`} />
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:28 }}>
                {liveM.length > 0 && (
                  <section>
                    <div className="section-label"><span style={{ width:7, height:7, borderRadius:"50%", background:"#ff4d4d" }} />Live Now</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                      {liveM.map(m => <MatchCard key={m.id} match={m} />)}
                    </div>
                  </section>
                )}
                {monthGroups.map(group => (
                  <section key={group.label}>
                    <div className="section-label">{group.label}</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                      {group.matches.map(m => <MatchCard key={m.id} match={m} />)}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STANDINGS */}
        {tab === "standings" && (
          <div>
            <h2 style={{ fontSize:16, fontWeight:800, color:"var(--obsidian)", margin:"0 0 16px" }}>League Standing</h2>
            {standingRow ? (
              <div style={{ background:"var(--white)", border:"1px solid var(--border)", borderRadius:12, overflow:"hidden" }}>
                <div style={{ display:"grid", gridTemplateColumns:"auto 1fr repeat(8,auto)", gap:0 }}>
                  {["#","Club","P","W","D","L","GF","GA","GD","PTS"].map(h => (
                    <div key={h} style={{ padding:"10px 12px", fontSize:11, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", borderBottom:"1px solid var(--border)", textAlign: h==="#"||h==="Club" ? "left" : "center" }}>{h}</div>
                  ))}
                  {[
                    standingRow.rank,
                    standingRow.team,
                    standingRow.played,
                    standingRow.won,
                    standingRow.drawn,
                    standingRow.lost,
                    standingRow.goalsFor,
                    standingRow.goalsAgainst,
                    (standingRow.goalDiff > 0 ? "+" : "") + standingRow.goalDiff,
                    standingRow.points,
                  ].map((v, i) => (
                    <div key={i} style={{ padding:"12px", fontSize:13, fontWeight: i===9 ? 800 : 500, color: i===9 ? "var(--navy)" : "var(--obsidian)", textAlign: i<2 ? "left" : "center", background:"var(--cloud)" }}>
                      {v}
                    </div>
                  ))}
                </div>
                <div style={{ padding:"12px 14px", borderTop:"1px solid var(--border)", textAlign:"right" }}>
                  <Link href={`/football/league/${league}`} style={{ fontSize:12, fontWeight:600, color:"var(--navy)", textDecoration:"none" }}>
                    View full standings →
                  </Link>
                </div>
              </div>
            ) : (
              <EmptyState detail={`No standings found for ${league} in ${season}.`} />
            )}
          </div>
        )}

        {/* SQUAD */}
        {tab === "squad" && <SquadTab roster={roster} league={league} teamId={teamId} teamColor={team.color} />}

        {/* NEWS */}
        {tab === "news" && (
          <div>
            <h2 style={{ fontSize:16, fontWeight:800, color:"var(--obsidian)", margin:"0 0 16px" }}>Latest News</h2>
            {news.length === 0 ? (
              <p style={{ color:"var(--text-muted)", fontSize:13 }}>No news available.</p>
            ) : (
              <div className="news-grid">
                {news.map(a => <NewsCard key={a.id} article={a} sport="football" />)}
              </div>
            )}
          </div>
        )}

        {/* STATS */}
        {tab === "stats" && (
          <StatsTab teamStats={teamStats} teamLeaders={teamLeaders} league={league} />
        )}
      </div>

      <style>{`
        @keyframes fadein { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}