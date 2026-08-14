import {
  getTeamSchedule, getStandings,
  type ESPNTeam, type ESPNMatchDetail, type ESPNStandingRow, type RawJSON,
} from "@/lib/api/espn";
import { leagueHasFullTable } from "@/types/football";
import type { FormResult } from "@/types/matchSummary";
import LastFiveForm from "./LastFiveForm";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * MatchPreview — fills the middle column of a PRE-MATCH page (before lineups
 * are released), using only existing endpoints:
 *   1. Hero matchup card (crests, team-colour split, kickoff, venue, records)
 *   2. Dual last-5 form guide (from each team's schedule)
 *   3. Head-to-head recent meetings
 *   6. Standings snapshot (hidden for friendlies / knockouts / no-table leagues)
 *
 * Server component (does its own fetches). All rendering is INLINE JSX — no
 * nested component definitions — to stay clean across the RSC boundary. The
 * only client component used is <LastFiveForm>, which takes plain serializable
 * props (FormResult[]).
 */

interface SchedGame {
  id: string;
  dateMs: number;
  competition: string;
  isHome: boolean;
  oppId: string;
  oppShort: string;
  teamScore: number | null;
  oppScore: number | null;
  completed: boolean;
}

function parseSchedule(raw: RawJSON | null, teamId: string): SchedGame[] {
  const events = (raw as any)?.events ?? [];
  const out: SchedGame[] = [];
  for (const ev of events) {
    const comp = ev?.competitions?.[0];
    if (!comp) continue;
    const competitors = comp?.competitors ?? [];
    const me = competitors.find((c: any) => String(c?.team?.id ?? c?.id) === String(teamId));
    const opp = competitors.find((c: any) => String(c?.team?.id ?? c?.id) !== String(teamId));
    if (!me || !opp) continue;
    const t = Date.parse(ev?.date ?? comp?.date ?? "");
    const completed = Boolean(comp?.status?.type?.completed ?? ev?.status?.type?.completed);
    const num = (v: any) => (v == null || v === "" ? null : Number(v));
    out.push({
      id: String(ev?.id ?? comp?.id ?? ""),
      dateMs: Number.isFinite(t) ? t : 0,
      competition: comp?.type?.abbreviation ?? ev?.league?.abbreviation ?? ev?.season?.slug ?? "",
      isHome: (me?.homeAway ?? "").toLowerCase() === "home",
      oppId: String(opp?.team?.id ?? opp?.id ?? ""),
      oppShort: opp?.team?.abbreviation ?? opp?.team?.shortDisplayName ?? opp?.team?.displayName ?? "—",
      teamScore: num(me?.score?.value ?? me?.score),
      oppScore: num(opp?.score?.value ?? opp?.score),
      completed,
    });
  }
  return out.sort((a, b) => b.dateMs - a.dateMs);
}

function toFormResults(games: SchedGame[], max = 5): FormResult[] {
  return games
    .filter(g => g.completed && g.teamScore != null && g.oppScore != null)
    .slice(0, max)
    .map(g => {
      const outcome: FormResult["outcome"] =
        g.teamScore! > g.oppScore! ? "W" : g.teamScore! < g.oppScore! ? "L" : "D";
      return {
        date: g.dateMs ? new Date(g.dateMs).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" }) : "",
        opponentShort: g.oppShort,
        homeAway: g.isHome ? "H" : "A",
        result: `${g.teamScore}-${g.oppScore}`,
        outcome,
        competition: g.competition,
      };
    });
}

export default async function MatchPreview({
  match, league, homeInfo, awayInfo,
}: {
  match: ESPNMatchDetail;
  league: string;
  homeInfo: ESPNTeam | null;
  awayInfo: ESPNTeam | null;
}) {
  const homeId = match.homeTeam.id;
  const awayId = match.awayTeam.id;
  const showTable = leagueHasFullTable(league);

  const [homeSchedRaw, awaySchedRaw, standings] = await Promise.all([
    getTeamSchedule(league, homeId),
    getTeamSchedule(league, awayId),
    showTable ? getStandings(league) : Promise.resolve([] as ESPNStandingRow[]),
  ]);

  const homeGames = parseSchedule(homeSchedRaw, homeId);
  const awayGames = parseSchedule(awaySchedRaw, awayId);
  const homeForm = toFormResults(homeGames);
  const awayForm = toFormResults(awayGames);
  const h2h = homeGames.filter(g => g.completed && String(g.oppId) === String(awayId)).slice(0, 5);
  const standRelevant = standings.filter(r => String(r.teamId) === String(homeId) || String(r.teamId) === String(awayId));

  // ── Hero colours / labels ──
  const homeColor = homeInfo?.color ? `#${homeInfo.color.replace("#", "")}` : "#1e3a5f";
  const awayColor = awayInfo?.color ? `#${awayInfo.color.replace("#", "")}` : "#7a1620";
  const kickoff = match.kickoff ? new Date(match.kickoff) : null;
  const dateLabel = kickoff ? kickoff.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "Date TBD";
  const timeLabel = kickoff ? kickoff.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";

  return (
    <div>
      {/* 1. HERO — all inline JSX (no nested components) */}
      <div style={{
        position: "relative", overflow: "hidden", borderRadius: 14, marginBottom: 16,
        background: `linear-gradient(120deg, ${homeColor} 0%, #0a1628 48%, #0a1628 52%, ${awayColor} 100%)`,
        padding: "26px 22px",
      }}>
        <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 18 }}>
          {match.competition}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Home block */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, minWidth: 0 }}>
            {match.homeTeam.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={match.homeTeam.logo} alt={match.homeTeam.name} width={72} height={72} style={{ width: 72, height: 72, objectFit: "contain", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.25))" }} />
            )}
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", textAlign: "center", lineHeight: 1.2 }}>{match.homeTeam.name}</div>
            {homeInfo?.record && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{homeInfo.record}</div>}
          </div>
          {/* Centre: date/time */}
          <div style={{ flexShrink: 0, textAlign: "center", minWidth: 90 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>{dateLabel}</div>
            {timeLabel && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{timeLabel}</div>}
            <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Kickoff</div>
          </div>
          {/* Away block */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, minWidth: 0 }}>
            {match.awayTeam.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={match.awayTeam.logo} alt={match.awayTeam.name} width={72} height={72} style={{ width: 72, height: 72, objectFit: "contain", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.25))" }} />
            )}
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", textAlign: "center", lineHeight: 1.2 }}>{match.awayTeam.name}</div>
            {awayInfo?.record && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{awayInfo.record}</div>}
          </div>
        </div>
        {match.venue && (
          <div style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 18 }}>{match.venue}</div>
        )}
      </div>

      {/* 2. DUAL FORM GUIDE (client component; hides itself if both empty) */}
      <div style={{ marginBottom: 16 }}>
        <LastFiveForm
          homeShort={match.homeTeam.shortName}
          awayShort={match.awayTeam.shortName}
          homeForm={homeForm.length ? homeForm : undefined}
          awayForm={awayForm.length ? awayForm : undefined}
        />
      </div>

      {/* 3. HEAD-TO-HEAD (inline; hidden when no prior meetings) */}
      {h2h.length > 0 && (
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 16 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Head to Head · Recent Meetings
            </span>
          </div>
          <div>
            {h2h.map((m, i) => {
              const d = m.dateMs ? new Date(m.dateMs).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
              const left = m.isHome ? match.homeTeam.shortName : match.awayTeam.shortName;
              const right = m.isHome ? match.awayTeam.shortName : match.homeTeam.shortName;
              const ls = m.isHome ? m.teamScore : m.oppScore;
              const rs = m.isHome ? m.oppScore : m.teamScore;
              return (
                <div key={m.id + i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 18px", borderBottom: i < h2h.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 90 }}>{d}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--obsidian)" }}>
                    {left} <span style={{ color: "var(--text-muted)" }}>{ls ?? "–"} : {rs ?? "–"}</span> {right}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 60, textAlign: "right" }}>{m.competition}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. STANDINGS SNAPSHOT (inline; hidden for friendlies / knockouts / no-table) */}
      {showTable && standRelevant.length > 0 && (
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Standings</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr repeat(5,auto)", gap: 0 }}>
            {["#", "Club", "P", "W", "D", "L", "PTS"].map(h => (
              <div key={h} style={{ padding: "8px 10px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", borderBottom: "1px solid var(--border)", textAlign: h === "#" || h === "Club" ? "left" : "center" }}>{h}</div>
            ))}
            {standRelevant.map(r => (
              [r.rank, r.team, r.played, r.won, r.drawn, r.lost, r.points].map((v, i) => (
                <div key={`${r.teamId}-${i}`} style={{ padding: "10px", fontSize: 12, fontWeight: i === 6 ? 800 : 500, color: i === 6 ? "var(--navy)" : "var(--obsidian)", textAlign: i < 2 ? "left" : "center", background: "var(--cloud)" }}>{v}</div>
              ))
            ))}
          </div>
        </div>
      )}
    </div>
  );
}