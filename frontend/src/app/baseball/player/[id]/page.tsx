import Link from "next/link";
import { notFound } from "next/navigation";
import { LEAGUES } from "@/types/baseball";
import { getTeam, getRoster } from "@/lib/api/baseball";
import PlayerSidebars from "@/components/baseball/PlayerSidebars";
import PlayerNewsFeed from "@/components/football/PlayerNewsFeed";
import TeamLogo from "@/components/baseball/TeamLogo";

export const dynamic = "force-dynamic";

const SPORT = "baseball";
const HEADSHOT_LEAGUE = "mlb";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ league?: string; team?: string }>;
}

const ESPN_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
};

interface SeasonStat { label: string; value: string }

/* eslint-disable @typescript-eslint/no-explicit-any */
async function espnJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: ESPN_HEADERS, next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function nameOf(a: any): string {
  if (!a) return "";
  return a.displayName ?? a.fullName ?? [a.firstName, a.lastName].filter(Boolean).join(" ") ?? "";
}

// Season stats can arrive in a few different ESPN shapes; try each defensively.
function parseSeasonStats(ov: any): SeasonStat[] {
  const s = ov?.statistics;
  if (!s) return [];
  const out: SeasonStat[] = [];
  const cats = s.splits?.categories;
  if (Array.isArray(cats)) {
    for (const c of cats) {
      for (const st of c.stats ?? []) {
        const label = st.abbreviation ?? st.shortDisplayName ?? st.displayName ?? st.name;
        const value = st.displayValue ?? (st.value != null ? String(st.value) : null);
        if (label && value) out.push({ label, value });
      }
    }
    if (out.length) return out.slice(0, 12);
  }
  const labels: any[] = s.displayNames ?? s.labels ?? s.names ?? [];
  const split = Array.isArray(s.splits) ? s.splits[0] : undefined;
  const values: any[] = split?.stats ?? [];
  if (Array.isArray(labels) && Array.isArray(values) && labels.length && values.length) {
    for (let i = 0; i < Math.min(labels.length, values.length); i++) out.push({ label: String(labels[i]), value: String(values[i]) });
    if (out.length) return out.slice(0, 12);
  }
  return [];
}

function GameLogTable({ gameLog, league }: { gameLog: any; league: string }) {
  if (!gameLog) return null;
  let labels: string[] = [];
  const events: any[] = [];
  const eventMap: Record<string, any> = gameLog.events ?? {};
  if (Array.isArray(gameLog.labels) && gameLog.seasonTypes) {
    labels = gameLog.labels;
    for (const st of gameLog.seasonTypes ?? []) for (const cat of st.categories ?? []) if (Array.isArray(cat.events)) events.push(...cat.events);
  } else if (Array.isArray(gameLog.statistics) && gameLog.statistics[0]) {
    labels = gameLog.statistics[0].labels ?? [];
    events.push(...(gameLog.statistics[0].events ?? []));
  }
  if (labels.length === 0 || events.length === 0) return null;

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>Recent Games</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480, fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", minWidth: 120 }}>Game</th>
              {labels.map((l, i) => <th key={`${l}-${i}`} style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", minWidth: 36 }}>{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {events.slice(0, 10).map((ev, i) => {
              const eventId = String(ev?.eventId ?? "");
              const info = eventMap[eventId] ?? {};
              const opp = info?.opponent?.abbreviation ?? info?.opponent?.displayName ?? "";
              const atVs = String(info?.atVs ?? "vs");
              const t = Date.parse(String(info?.gameDate ?? ""));
              const dateStr = Number.isFinite(t) ? new Date(t).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }) : "";
              const leagueAbbr = String(info?.leagueAbbreviation ?? "");
              const teamLogo = String(info?.team?.logo ?? "");
              const oppLogo = String(info?.opponent?.logo ?? "");
              const stats: string[] = ev?.stats ?? [];
              const cell = (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    {teamLogo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={teamLogo} alt="" width={18} height={18} style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>{atVs === "@" ? "@" : "vs"}</span>
                    {oppLogo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={oppLogo} alt="" width={18} height={18} style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--navy)" }}>{opp}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{[dateStr, leagueAbbr].filter(Boolean).join(" · ")}</div>
                </>
              );
              return (
                <tr key={eventId || i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "7px 12px" }}>
                    {eventId
                      ? <Link href={`/baseball/${eventId}?league=${league}`} style={{ textDecoration: "none", display: "block" }}>{cell}</Link>
                      : cell}
                  </td>
                  {stats.map((v, si) => <td key={si} style={{ padding: "7px 6px", textAlign: "center", fontSize: 12, color: v !== "0" && si > 0 ? "var(--obsidian)" : "var(--text-muted)" }}>{v}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NextMatchCard({ match, league }: { match: any; league: string }) {
  const competitors: any[] = match?.competitors ?? [];
  const home = competitors.find((c) => c?.homeAway === "home") ?? competitors[0] ?? {};
  const away = competitors.find((c) => c?.homeAway === "away") ?? competitors[1] ?? {};
  const t = Date.parse(String(match?.date ?? ""));
  const dateStr = Number.isFinite(t) ? new Date(t).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }) : "";
  const timeStr = Number.isFinite(t) ? new Date(t).toLocaleTimeString("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" }) : "";
  const seasonName = String(match?.seasonName ?? "");
  const broadcast = String(match?.broadcast ?? "");
  const eventId = String(match?.id ?? match?.competitionId ?? "");
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>Next Game</span>
        {seasonName && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--navy)" }}>{seasonName}</span>}
      </div>
      <div style={{ padding: "16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <TeamLogo logo={String(away?.logo ?? "")} shortName={String(away?.abbreviation ?? "")} size={40} />
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--obsidian)", marginTop: 6 }}>{String(away?.displayName ?? away?.location ?? "")}</div>
        </div>
        <div style={{ textAlign: "center", flex: "0 0 auto", minWidth: 90 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>@</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginTop: 2 }}>{dateStr}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{timeStr}</div>
          {broadcast && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{broadcast}</div>}
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <TeamLogo logo={String(home?.logo ?? "")} shortName={String(home?.abbreviation ?? "")} size={40} />
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--obsidian)", marginTop: 6 }}>{String(home?.displayName ?? home?.location ?? "")}</div>
        </div>
      </div>
      {eventId && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "10px 16px", textAlign: "center" }}>
          <Link href={`/baseball/${eventId}?league=${league}`} style={{ fontSize: 12, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>Game Details →</Link>
        </div>
      )}
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function JerseyHero({ jersey, name }: { jersey: string | null; name: string }) {
  const parts = name.trim().split(" ");
  const lastName = parts[parts.length - 1] || name;
  return (
    <svg viewBox="0 0 500.152 500.152" xmlns="http://www.w3.org/2000/svg" style={{ width: 180, height: 180, display: "block", filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.3))" }}>
      <path d="M463.776,116.236c-9.688-30.68-32.52-54.76-62.656-66.056l-79.048-29.648V2.076h-144v18.456l-79.048,29.64 c-30.136,11.304-52.968,35.376-62.656,66.056L0,231.412l95.44,28.632l18.632-62.128v300.16h272v-300.16l18.64,62.12l95.44-28.632 L463.776,116.236z" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.8)" strokeWidth="12" />
      <text x="250" y="220" textAnchor="middle" dominantBaseline="middle" fontSize="160" fontWeight="900" fontFamily="'Inter', system-ui, sans-serif" fill="rgba(255,255,255,0.95)" letterSpacing="-4">{jersey ?? "–"}</text>
      <text x="250" y="340" textAnchor="middle" dominantBaseline="middle" fontSize="38" fontWeight="700" fontFamily="'Inter', system-ui, sans-serif" fill="rgba(255,255,255,0.85)" letterSpacing="5">{lastName.toUpperCase().slice(0, 9)}</text>
    </svg>
  );
}

function HeroBioItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginTop: 1 }}>{value}</div>
    </div>
  );
}

function SeasonStats({ stats }: { stats: SeasonStat[] }) {
  if (!stats || stats.length === 0) return null;
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>Season Stats</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))" }}>
        {stats.map((s, i) => (
          <div key={`${s.label}-${i}`} style={{ padding: "14px 12px", textAlign: "center", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--obsidian)" }} className="stat-num">{s.value}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.3px", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function PlayerPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { league = "mlb" } = await searchParams;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [profileWeb, core, overview, gamelog, newsEndpoint] = await Promise.all([
    espnJson(`https://site.web.api.espn.com/apis/common/v3/sports/${SPORT}/${league}/athletes/${id}`),
    espnJson(`https://sports.core.api.espn.com/v2/sports/${SPORT}/leagues/${league}/athletes/${id}?lang=en&region=us`),
    espnJson(`https://site.web.api.espn.com/apis/common/v3/sports/${SPORT}/${league}/athletes/${id}/overview`),
    espnJson(`https://site.web.api.espn.com/apis/common/v3/sports/${SPORT}/${league}/athletes/${id}/gamelog`),
    espnJson(`https://site.web.api.espn.com/apis/common/v3/sports/${SPORT}/${league}/athletes/${id}/news?limit=10`),
  ]);

  const bio: any = profileWeb?.athlete ?? core ?? profileWeb ?? overview?.athlete ?? null;
  const name = nameOf(bio);
  if (!bio || !name) return notFound();

  // Resolve the player's team so we can show the SWITCH PLAYER roster + branding.
  const teamRef = String(core?.team?.$ref ?? bio?.team?.$ref ?? "");
  const teamId = teamRef.match(/teams\/(\d+)/)?.[1] ?? (bio?.team?.id != null ? String(bio.team.id) : null);
  const [team, roster] = teamId
    ? await Promise.all([getTeam(league, teamId), getRoster(league, teamId)])
    : [null, [] as Awaited<ReturnType<typeof getRoster>>];
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const leagueInfo = LEAGUES.find(l => l.slug === league);
  const headshot: string | null = bio.headshot?.href ?? overview?.athlete?.headshot?.href ?? `https://a.espncdn.com/i/headshots/${HEADSHOT_LEAGUE}/players/full/${id}.png`;
  const position: string | null = bio.position?.displayName ?? bio.position?.abbreviation ?? null;
  const jersey: string | null = bio.jersey ?? null;
  const age: number | null = typeof bio.age === "number" ? bio.age : null;
  const batsThrows = (bio.bats?.displayValue || bio.bats) && (bio.throws?.displayValue || bio.throws)
    ? `${bio.bats?.displayValue ?? bio.bats}/${bio.throws?.displayValue ?? bio.throws}` : null;

  const teamName = team?.name ?? bio.team?.displayName ?? null;
  const teamShort = team?.shortName ?? "";
  const teamLogo = team?.logo ?? null;
  const bannerColor = team?.color
    ? `linear-gradient(135deg, #${team.color.replace("#", "")} 0%, #0a1628 100%)`
    : `linear-gradient(135deg, ${leagueInfo?.accent ?? "#1e3a5f"} 0%, #0a1628 100%)`;

  const seasonStats = parseSeasonStats(overview);
  const nextMatch = overview?.nextGame?.league?.events?.[0] ?? null;
  const nextMatchLeague = overview?.nextGame?.league?.slug ?? league;
  const newsData = (overview?.news?.length || overview?.articles?.length) ? overview : newsEndpoint;

  const nameParts = name.trim().split(" ");
  const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : "";
  const lastName = nameParts[nameParts.length - 1];

  return (
    <div style={{ background: "var(--cloud)", minHeight: "100vh" }}>
      {/* Hero */}
      <div style={{ background: bannerColor, borderBottom: "1px solid rgba(255,255,255,0.08)", overflow: "hidden", position: "relative" }}>
        {teamLogo && (
          <div style={{ position: "absolute", right: 30, top: "50%", transform: "translateY(-50%)", opacity: 0.12, pointerEvents: "none", height: 220, width: 220 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={teamLogo} alt="" width={220} height={220} style={{ width: 220, height: 220, objectFit: "contain" }} />
          </div>
        )}
        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 28, flexWrap: "wrap" }}>
            <div style={{ flexShrink: 0, paddingTop: 24, marginBottom: -4 }}>
              {headshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={headshot} alt={name} style={{ width: 180, height: 180, objectFit: "cover", objectPosition: "top", display: "block" }} />
              ) : <JerseyHero jersey={jersey} name={name} />}
            </div>
            <div style={{ flex: 1, minWidth: 240, paddingBottom: 28, paddingTop: 32 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                {teamLogo && <TeamLogo logo={teamLogo} shortName={teamShort} size={22} />}
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                  {teamName}{leagueInfo && <span style={{ color: "rgba(255,255,255,0.4)" }}>{teamName ? " · " : ""}{leagueInfo.short}</span>}
                </span>
              </div>
              <div style={{ marginBottom: 14 }}>
                {firstName && <div style={{ fontSize: "clamp(16px, 2.5vw, 22px)", fontWeight: 300, color: "rgba(255,255,255,0.8)", lineHeight: 1.1 }}>{firstName.toUpperCase()}</div>}
                <div style={{ fontSize: "clamp(28px, 5vw, 52px)", fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: "-1.5px" }}>{lastName.toUpperCase()}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 6, fontWeight: 500 }}>{[jersey ? `#${jersey}` : null, position].filter(Boolean).join(" · ")}</div>
              </div>
              <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                {age != null && <HeroBioItem label="Age" value={String(age)} />}
                {batsThrows && <HeroBioItem label="Bats/Throws" value={batsThrows} />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body — three columns like football */}
      <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 260px", gap: 20, alignItems: "start" }}>
          <PlayerSidebars
            roster={roster.map(p => ({ id: p.id, name: p.name, jersey: p.jersey, position: p.position }))}
            currentId={id} teamId={teamId ?? ""} league={league}
            quickLinks={[]} leagueQuickLinks={[]} side="left"
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
            {nextMatch && <NextMatchCard match={nextMatch} league={nextMatchLeague} />}
            <SeasonStats stats={seasonStats} />
            <GameLogTable gameLog={gamelog} league={league} />
            {newsData && (
              <div>
                <h2 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>Latest News</h2>
                <PlayerNewsFeed data={newsData} />
              </div>
            )}
          </div>

          <PlayerSidebars
            roster={[]} currentId={id} teamId={teamId ?? ""} league={league}
            quickLinks={teamId ? [
              { label: "Roster", href: `/baseball/team/${teamId}?league=${league}` },
              { label: "Schedule", href: `/baseball/team/${teamId}?league=${league}` },
              { label: "News", href: `/baseball/news?league=${league}` },
            ] : []}
            leagueQuickLinks={leagueInfo ? [
              { label: "Live Scores", href: `/baseball?league=${league}` },
              { label: "Standings", href: `/baseball/standings?league=${league}` },
              { label: "Schedule", href: `/baseball/fixtures?league=${league}` },
              { label: "Injuries", href: `/baseball/injuries?league=${league}` },
              { label: "News", href: `/baseball/news?league=${league}` },
            ] : []}
            leagueShort={leagueInfo?.short} teamShortName={teamShort} side="right"
          />
        </div>
      </div>
    </div>
  );
}