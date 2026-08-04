import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getRoster, getTeam, getAthleteOverviewRaw,
  type RawJSON, type ESPNTeam, type ESPNPlayer,
} from "@/lib/api/espn";
import { LEAGUES } from "@/types/football";
import PlayerNewsFeed from "@/components/football/PlayerNewsFeed";
import TeamLogo from "@/components/football/TeamLogo";
import PlayerSidebars from "@/components/football/PlayerSidebars";
export const dynamic = "force-dynamic";
interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ league?: string; team?: string }>;
}
const posFull: Record<string, string> = {
  G: "Goalkeeper", GK: "Goalkeeper", D: "Defender", DF: "Defender",
  M: "Midfielder", MF: "Midfielder", F: "Forward", FW: "Forward",
};
// ─── Resolve player's actual club + roster via ESPN Core API ─────────────────
async function resolvePlayerClub(athleteId: string): Promise<{
  team: ESPNTeam;
  leagueSlug: string;
  teamId: string;
  roster: ESPNPlayer[];
} | null> {
  try {
    const coreRes = await fetch(
      `https://sports.core.api.espn.com/v2/sports/soccer/athletes/${athleteId}?lang=en&region=us`,
      { next: { revalidate: 3600 } }
    );
    if (!coreRes.ok) return null;
    const coreData: RawJSON = await coreRes.json();
    const teamRef: string = coreData?.defaultTeam?.$ref ?? "";
    const leagueRef: string = coreData?.defaultLeague?.$ref ?? "";
    if (!teamRef || !leagueRef) return null;
    const leagueMatch = leagueRef.match(/leagues\/([^/?]+)/);
    const teamMatch = teamRef.match(/teams\/(\d+)/);
    if (!leagueMatch || !teamMatch) return null;
    const leagueSlug = leagueMatch[1];
    const teamId = teamMatch[1];
    const [teamData, roster] = await Promise.all([
      getTeam(leagueSlug, teamId),
      getRoster(leagueSlug, teamId),
    ]);
    if (!teamData) return null;
    return { team: teamData, leagueSlug, teamId, roster: roster ?? [] };
  } catch {
    return null;
  }
}
// ─── Jersey SVG ───────────────────────────────────────────────────────────────
function JerseyHero({ jersey, name }: {
  jersey: string | null; name: string;
  teamLogo?: string | null; teamColor?: string | null;
}) {
  const parts = name.trim().split(" ");
  const lastName = parts[parts.length - 1] || name;
  return (
    <svg viewBox="0 0 500.152 500.152" xmlns="http://www.w3.org/2000/svg"
      style={{ width: "clamp(120px, 30vw, 180px)", height: "clamp(120px, 30vw, 180px)", display: "block", filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.3))" }}>
      <path
        d="M463.776,116.236c-9.688-30.68-32.52-54.76-62.656-66.056l-79.048-29.648V2.076h-144v18.456l-79.048,29.64 c-30.136,11.304-52.968,35.376-62.656,66.056L0,231.412l95.44,28.632l18.632-62.128v300.16h272v-300.16l18.64,62.12l95.44-28.632 L463.776,116.236z"
        fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.8)" strokeWidth="12"
      />
      <text x="250" y="220" textAnchor="middle" dominantBaseline="middle"
        fontSize="160" fontWeight="900" fontFamily="'Inter', system-ui, sans-serif"
        fill="rgba(255,255,255,0.95)" letterSpacing="-4">
        {jersey ?? "–"}
      </text>
      <text x="250" y="340" textAnchor="middle" dominantBaseline="middle"
        fontSize="38" fontWeight="700" fontFamily="'Inter', system-ui, sans-serif"
        fill="rgba(255,255,255,0.85)" letterSpacing="5">
        {lastName.toUpperCase().slice(0, 9)}
      </text>
    </svg>
  );
}
// ─── Game Log Table ───────────────────────────────────────────────────────────
function GameLogTable({ gameLog, league }: { gameLog: RawJSON; league: string }) {
  if (!gameLog) return null;
  const statsArr = gameLog.statistics;
  if (!Array.isArray(statsArr) || statsArr.length === 0) return null;
  const cat = statsArr[0] as RawJSON;
  const labels: string[] = cat?.labels ?? [];
  const events: RawJSON[] = cat?.events ?? [];
  const eventMap: Record<string, RawJSON> = gameLog.events ?? {};
  if (labels.length === 0 || events.length === 0) return null;
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
        Last 5 Matches
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480, fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", position: "sticky", left: 0, background: "var(--white)", minWidth: 160 }}>
                Match
              </th>
              {labels.map((l: string) => (
                <th key={l} style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", minWidth: 36 }}>
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((ev: RawJSON, i: number) => {
              const eventId = String(ev?.eventId ?? "");
              const info = eventMap[eventId] as RawJSON;
              const stats: string[] = ev?.stats ?? [];
              const opp = (info?.opponent as RawJSON)?.abbreviation ?? (info?.opponent as RawJSON)?.displayName ?? "";
              const atVs = String(info?.atVs ?? "vs");
              const leagueName2 = String(info?.leagueAbbreviation ?? "");
              const dateRaw = String(info?.gameDate ?? "");
              const t = Date.parse(dateRaw);
              const dateStr = Number.isFinite(t)
                ? new Date(t).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })
                : "";
              const playerTeamLogo = String((info?.team as RawJSON)?.logo ?? "");
              const oppLogo = String((info?.opponent as RawJSON)?.logo ?? "");
              return (
                <tr key={eventId || i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "7px 12px", position: "sticky", left: 0, background: "var(--white)" }}>
                    <Link href={`/football/${eventId}?league=${league}`} style={{ textDecoration: "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        {playerTeamLogo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={playerTeamLogo} alt="" width={18} height={18}
                            style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
                        )}
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>
                          {atVs === "@" ? "@" : "vs"}
                        </span>
                        {oppLogo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={oppLogo} alt="" width={18} height={18}
                            style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
                        )}
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--navy)" }}>{opp}</span>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        {[dateStr, leagueName2].filter(Boolean).join(" · ")}
                      </div>
                    </Link>
                  </td>
                  {stats.map((v: string, si: number) => (
                    <td key={si} style={{ padding: "7px 6px", textAlign: "center", fontSize: 12, color: v !== "0" && si > 0 ? "var(--obsidian)" : "var(--text-muted)" }}>
                      {v}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
// ─── Season Stats ─────────────────────────────────────────────────────────────
function SeasonStats({ stats }: { stats: RawJSON }) {
  if (!stats) return null;
  const splits: RawJSON[] = stats.splits ?? [];
  const labels: string[] = stats.displayNames ?? stats.names ?? [];
  if (splits.length === 0 || labels.length === 0) return null;
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
        Season Stats
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 400, fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "var(--obsidian)", fontSize: 10, textTransform: "uppercase", minWidth: 140 }}>Competition</th>
              {labels.map((l: string) => (
                <th key={l} style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", minWidth: 36 }}>
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {splits.map((split: RawJSON, i: number) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "7px 12px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                  {String(split?.displayName ?? `Split ${i + 1}`)}
                </td>
                {(split?.stats as string[] ?? []).map((v: string, si: number) => (
                  <td key={si} style={{ padding: "7px 6px", textAlign: "center", fontSize: 12, color: v !== "0" ? "var(--obsidian)" : "var(--text-muted)" }}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default async function PlayerPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { league: contextLeague = "eng.1" } = await searchParams;
  const [clubResult, overviewRaw] = await Promise.all([
    resolvePlayerClub(id),
    getAthleteOverviewRaw(contextLeague, id),
  ]);
  if (!clubResult) return notFound();
  const { team: brandTeam, leagueSlug: clubLeagueSlug, teamId: clubTeamId, roster } = clubResult;
  const rosterPlayer = roster.find(p => p.id === id);
  const player: ESPNPlayer = rosterPlayer ?? {
    id,
    name: brandTeam.name,
    jersey: null,
    position: null,
    age: null,
    nationality: null,
    headshot: null,
  };
  const coreAthleteRes = await fetch(
    `https://sports.core.api.espn.com/v2/sports/soccer/athletes/${id}?lang=en&region=us`,
    { next: { revalidate: 3600 } }
  );
  if (coreAthleteRes.ok) {
    const coreAthlete: RawJSON = await coreAthleteRes.json();
    if (coreAthlete) {
      player.name = coreAthlete.displayName ?? coreAthlete.fullName ?? player.name;
      player.jersey = coreAthlete.jersey ?? player.jersey;
      player.age = coreAthlete.age ?? player.age;
      player.nationality = coreAthlete.citizenship ?? player.nationality;
      player.position = coreAthlete.position?.abbreviation ?? player.position;
    }
  }
  const clubLeagueInfo = LEAGUES.find(l => l.slug === clubLeagueSlug);
  const position = player.position ? (posFull[player.position] ?? player.position) : null;
  const age = player.age;
  const nationality = player.nationality;
  const headshot: string | null = overviewRaw?.athlete?.headshot?.href ?? null;
  const gameLog: RawJSON = overviewRaw?.gameLog ?? null;
  const seasonStats: RawJSON = overviewRaw?.statistics ?? null;
  const newsRaw: RawJSON = overviewRaw ?? null;
  const nextGameEvents: RawJSON[] = overviewRaw?.nextGame?.league?.events ?? [];
  const nextMatch = nextGameEvents.length > 0 ? nextGameEvents[0] : null;
  const nextMatchLeague: string = overviewRaw?.nextGame?.league?.slug ?? clubLeagueSlug;
  const nameParts = player.name.trim().split(" ");
  const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : "";
  const lastName = nameParts[nameParts.length - 1];
  const bannerColor = brandTeam?.color
    ? `linear-gradient(135deg, #${brandTeam.color.replace("#", "")} 0%, #0a1628 100%)`
    : "linear-gradient(135deg, #1e3a5f 0%, #0a1628 100%)";
  return (
    <div style={{ background: "var(--cloud)", minHeight: "100vh" }}>
      {/* ─── Hero Banner ─── */}
      <div style={{ background: bannerColor, borderBottom: "1px solid rgba(255,255,255,0.08)", overflow: "hidden", position: "relative" }}>
        {brandTeam?.logo && (
          <div className="player-hero-logo" style={{
            position: "absolute", right: 30, top: "50%", transform: "translateY(-50%)",
            opacity: 0.8, pointerEvents: "none",
            filter: "drop-shadow(8px 12px 20px rgba(0,0,0,0.5))",
            height: 220, width: 220,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brandTeam.logo} alt="" width={220} height={220} style={{ width: 220, height: 220, objectFit: "contain" }} />
          </div>
        )}
        <div className="container" style={{ paddingTop: 0, paddingBottom: 0, position: "relative", zIndex: 1 }}>
          <div className="player-hero-row" style={{ display: "flex", alignItems: "flex-end", gap: 28, flexWrap: "wrap" }}>
            <div style={{ flexShrink: 0, paddingTop: 24, marginBottom: -4 }}>
              {headshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={headshot} alt={player.name} className="player-hero-headshot"
                  style={{ width: "clamp(120px, 30vw, 180px)", height: "clamp(120px, 30vw, 180px)", objectFit: "cover", objectPosition: "top", display: "block" }} />
              ) : (
                <JerseyHero jersey={player.jersey} name={player.name}
                  teamLogo={brandTeam?.logo ?? null} teamColor={brandTeam?.color ?? null} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 220, paddingBottom: 28, paddingTop: 32 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                {brandTeam?.logo && <TeamLogo logo={brandTeam.logo} shortName={brandTeam.shortName} size={22} />}
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                  {brandTeam?.name}
                  {clubLeagueInfo && <span style={{ color: "rgba(255,255,255,0.4)" }}> · {clubLeagueInfo.short}</span>}
                </span>
              </div>
              <div style={{ marginBottom: 14 }}>
                {firstName && (
                  <div style={{ fontSize: "clamp(15px, 2.5vw, 22px)", fontWeight: 300, color: "rgba(255,255,255,0.8)", lineHeight: 1.1 }}>
                    {firstName.toUpperCase()}
                  </div>
                )}
                <div style={{ fontSize: "clamp(26px, 5vw, 52px)", fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: "-1.5px" }}>
                  {lastName.toUpperCase()}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 6, fontWeight: 500 }}>
                  {[player.jersey ? `#${player.jersey}` : null, position].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                {age != null && <HeroBioItem label="Age" value={String(age)} />}
                {nationality && <HeroBioItem label="Nationality" value={nationality} />}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* ─── Body ─── */}
      <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <div className="player-body-grid">
          {/* LEFT: Switch Player */}
          <div className="player-col-left">
            <PlayerSidebars
              roster={roster.map(p => ({ id: p.id, name: p.name, jersey: p.jersey, position: p.position }))}
              currentId={id}
              teamId={clubTeamId}
              league={clubLeagueSlug}
              quickLinks={[]} leagueQuickLinks={[]} side="left"
            />
          </div>
          {/* MIDDLE */}
          <div className="player-col-mid" style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
            {nextMatch && <NextMatchCard match={nextMatch} league={nextMatchLeague} />}
            {gameLog && <GameLogTable gameLog={gameLog} league={clubLeagueSlug} />}
            {seasonStats && <SeasonStats stats={seasonStats} />}
            {newsRaw && (
              <div>
                <SectionLabel text="Latest News" />
                <PlayerNewsFeed data={newsRaw} />
              </div>
            )}
          </div>
          {/* RIGHT: Quick links */}
          <div className="player-col-right">
            <PlayerSidebars
              roster={[]} currentId={id} teamId={clubTeamId} league={clubLeagueSlug}
              quickLinks={[
                { label: "Squad", href: `/football/team/${clubTeamId}?league=${clubLeagueSlug}` },
                { label: "Schedule", href: `/football/team/${clubTeamId}?league=${clubLeagueSlug}#schedule` },
                { label: "News", href: `/football/news?league=${clubLeagueSlug}` },
              ]}
              leagueQuickLinks={clubLeagueInfo ? [
                { label: "Live Scores", href: `/football?league=${clubLeagueSlug}` },
                { label: "Standings", href: `/football/standings?league=${clubLeagueSlug}` },
                { label: "Fixtures", href: `/football/fixtures?league=${clubLeagueSlug}` },
                { label: "Injuries", href: `/football/injuries?league=${clubLeagueSlug}` },
                { label: "Transfers", href: `/football/transactions?league=${clubLeagueSlug}` },
              ] : []}
              leagueShort={clubLeagueInfo?.short}
              teamShortName={brandTeam?.shortName}
              side="right"
            />
          </div>
        </div>
      </div>

      {/* ─── Responsive rules ─── */}
      <style>{`
        .player-body-grid {
          display: grid;
          grid-template-columns: 260px 1fr 260px;
          gap: 20px;
          align-items: start;
        }
        /* Tablet: drop the left roster column, keep content + right rail */
        @media (max-width: 1100px) {
          .player-body-grid { grid-template-columns: 1fr 260px; }
          .player-col-left { display: none; }
        }
        /* Mobile: single column, content first, then right rail below */
        @media (max-width: 768px) {
          .player-body-grid { grid-template-columns: 1fr; }
          .player-col-left { display: none; }
          .player-col-mid  { order: 1; }
          .player-col-right { order: 2; }
        }
        /* Hero team logo: shrink on tablet, hide on mobile so it never
           overlaps the name/headshot */
        @media (max-width: 900px) {
          .player-hero-logo { height: 150px !important; width: 150px !important; right: 12px !important; opacity: 0.5 !important; }
          .player-hero-logo img { width: 150px !important; height: 150px !important; }
        }
        @media (max-width: 640px) {
          .player-hero-logo { display: none !important; }
          .player-hero-row { gap: 16px !important; }
        }
      `}</style>
    </div>
  );
}
// ─── Sub-components ───────────────────────────────────────────────────────────
function HeroBioItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginTop: 1 }}>{value}</div>
    </div>
  );
}
function SectionLabel({ text }: { text: string }) {
  return (
    <h2 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>{text}</h2>
  );
}
function NextMatchCard({ match, league }: { match: RawJSON; league: string }) {
  const competitors: RawJSON[] = match?.competitors ?? [];
  const home = competitors.find((c: RawJSON) => c?.homeAway === "home") ?? competitors[0] ?? {};
  const away = competitors.find((c: RawJSON) => c?.homeAway === "away") ?? competitors[1] ?? {};
  const t = Date.parse(String(match?.date ?? ""));
  const dateStr = Number.isFinite(t)
    ? new Date(t).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "";
  const timeStr = Number.isFinite(t)
    ? new Date(t).toLocaleTimeString("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" })
    : "";
  const seasonName = String(match?.seasonName ?? "");
  const broadcast = String(match?.broadcast ?? "");
  const eventId = String(match?.id ?? match?.competitionId ?? "");
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>Next Match</span>
        {seasonName && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--navy)" }}>{seasonName}</span>}
      </div>
      <div style={{ padding: "16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <TeamLogo logo={String(home?.logo ?? "")} shortName={String(home?.abbreviation ?? "")} size={40} />
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--obsidian)", marginTop: 6 }}>{String(home?.displayName ?? home?.location ?? "")}</div>
        </div>
        <div style={{ textAlign: "center", flex: "0 0 auto", minWidth: 80 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{dateStr.split(",").slice(0, 2).join(",")}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{timeStr}</div>
          {broadcast && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{broadcast}</div>}
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <TeamLogo logo={String(away?.logo ?? "")} shortName={String(away?.abbreviation ?? "")} size={40} />
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--obsidian)", marginTop: 6 }}>{String(away?.displayName ?? away?.location ?? "")}</div>
        </div>
      </div>
      {eventId && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "10px 16px", textAlign: "center" }}>
          <Link href={`/football/${eventId}?league=${league}`} style={{ fontSize: 12, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}>
            Match Details →
          </Link>
        </div>
      )}
    </div>
  );
}