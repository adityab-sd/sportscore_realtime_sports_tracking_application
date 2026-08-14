import Link from "next/link";
import { notFound } from "next/navigation";
import { getGameDetail, getStandings, BBGameDetail, BBLineScore } from "@/lib/api/basketball";
import { leagueName } from "@/types/basketball";
import ScoreHeader from "@/components/basketball/ScoreHeader";
import StandingsTable from "@/components/basketball/StandingsTable";
import MatchColumnTabs from "@/components/basketball/MatchColumnTabs";
import ShotChart from "@/components/basketball/ShotChart";
import LocalDateTime from "@/components/basketball/LocalDateTime";
import BasketballLiveScoreHeader from "@/components/basketball/BasketballLiveScoreHeader";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ league?: string }>;
}

const ESPN_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
};

interface TeamMeta { id: string; name: string; short: string; logo: string | null; color: string; record: string; score: string | null }

/* eslint-disable @typescript-eslint/no-explicit-any */
async function fetchSummary(league: string, id: string): Promise<any | null> {
  const cands = [league];
  if (league !== "nba") cands.push("nba");
  for (const lg of [...new Set(cands)]) {
    try {
      const res = await fetch(`https://site.web.api.espn.com/apis/site/v2/sports/basketball/${lg}/summary?event=${id}`, { headers: ESPN_HEADERS, next: { revalidate: 60 } });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.boxscore || data?.plays) return data;
    } catch { /* try next */ }
  }
  return null;
}

// Build away/home team display objects (logo, short, record, color) from the summary header,
// falling back to the parsed game detail.
function buildTeams(summary: any, game: BBGameDetail): { away: TeamMeta; home: TeamMeta } {
  const comps: any[] = summary?.header?.competitions?.[0]?.competitors ?? [];
  const mk = (ref: BBGameDetail["homeTeam"], homeAway: "home" | "away"): TeamMeta => {
    const c = comps.find(x => x.homeAway === homeAway) ?? comps.find(x => String(x.team?.id) === String(ref.id)) ?? {};
    const t = c.team ?? {};
    const recArr = c.records ?? c.record ?? t.record ?? [];
    const record = Array.isArray(recArr)
      ? (recArr.find((r: any) => r.type === "total" || r.name === "overall")?.summary ?? recArr[0]?.summary ?? "")
      : (recArr?.summary ?? "");
    const rawColor = t.color ? `#${String(t.color).replace("#", "")}` : "";
    return {
      id: String(t.id ?? ref.id),
      name: t.displayName ?? ref.name,
      short: t.abbreviation ?? t.shortDisplayName ?? ref.shortName,
      logo: t.logo ?? t.logos?.[0]?.href ?? ref.logo ?? null,
      color: rawColor || (homeAway === "home" ? "#003F88" : "#111827"),
      record: String(record ?? ""),
      score: c.score != null ? String(c.score) : null,
    };
  };
  return { away: mk(game.awayTeam, "away"), home: mk(game.homeTeam, "home") };
}

function hasShotData(summary: any): boolean {
  const plays: any[] = summary?.plays ?? [];
  return plays.some(p => {
    if (!p?.shootingPlay && !p?.scoringPlay) return false;
    const c = p.coordinate ?? p.coordinates;
    return c && c.x != null && c.y != null;
  });
}

function parseGameInfo(summary: any, game: BBGameDetail) {
  const comp = summary?.header?.competitions?.[0] ?? {};
  const gi = summary?.gameInfo ?? {};
  const venueObj = gi.venue ?? comp.venue ?? {};
  const addr = venueObj.address ?? {};
  const broadcasts: string[] = (comp.broadcasts ?? []).flatMap((b: any) => b.names ?? (b.media?.shortName ? [b.media.shortName] : []));
  const officials: { name: string; position: string }[] = (gi.officials ?? []).map((o: any) => ({ name: o.displayName ?? o.fullName ?? "", position: o.position?.displayName ?? o.position?.name ?? "Official" }));
  return {
    dateISO: comp.date ?? game.tipoff ?? null,
    venue: venueObj.fullName ?? game.venue ?? null,
    location: [addr.city, addr.state].filter(Boolean).join(", ") || null,
    attendance: gi.attendance ?? game.attendance ?? null,
    broadcasts: [...new Set(broadcasts)] as string[],
    officials: officials.length ? officials : game.officials.map(o => ({ name: o.name, position: o.position })),
  };
}

// ── ESPN-style odds table (summary.pickcenter) ───────────────────────────────
function signed(n: number): string { return n > 0 ? `+${n}` : String(n); }
function parseOdds(summary: any) {
  const pc: any[] = summary?.pickcenter ?? [];
  if (!Array.isArray(pc) || pc.length === 0) return null;
  const p = pc.find(x => x.awayTeamOdds || x.homeTeamOdds) ?? pc[0];
  const ou = p.overUnder ?? p.current?.total?.value ?? null;
  const spread = typeof p.spread === "number" ? p.spread : null;

  const cell = (to: any, isAway: boolean) => {
    if (!to) return { open: "—", spread: "—", total: "—", ml: "—" };
    const cur = to.current ?? {};
    const open = to.open ?? {};
    const ml = to.moneyLine ?? cur.moneyLine?.american ?? "—";
    const sprdMain = cur.pointSpread?.american ?? cur.spread?.american
      ?? (spread != null ? signed(to.favorite ? -Math.abs(spread) : Math.abs(spread)) : "—");
    const sprdSub = cur.spread?.american ?? (to.spreadOdds != null ? signed(to.spreadOdds) : "");
    const totMain = cur.total?.american ?? (ou != null ? `${isAway ? "o" : "u"}${ou}` : "—");
    const totSub = cur.total?.value != null ? String(cur.total.value) : "";
    const opnMain = open.pointSpread?.american ?? open.total?.american ?? open.spread?.american ?? "—";
    const opnSub = open.spread?.american ?? "";
    return {
      open: String(opnMain), openSub: String(opnSub ?? ""),
      spread: String(sprdMain), spreadSub: String(sprdSub ?? ""),
      total: String(totMain), totalSub: String(totSub ?? ""),
      ml: String(ml),
    };
  };
  return { provider: p.provider?.name ?? "Odds", away: cell(p.awayTeamOdds, true), home: cell(p.homeTeamOdds, false) };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Shared UI ────────────────────────────────────────────────────────────────
function TeamTag({ team, size = 20, bold = false }: { team: TeamMeta; size?: number; bold?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      {team.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logo} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} />
      )}
      <span style={{ fontWeight: bold ? 800 : 700, color: "var(--obsidian)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.short}</span>
    </span>
  );
}

function CardHead({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>{children}</div>;
}

// ── Summary: Line Score (away then home) ─────────────────────────────────────
function LineScoreTable({ game, away, home }: { game: BBGameDetail; away: TeamMeta; home: TeamMeta }) {
  if (!game.lineScores || game.lineScores.length === 0) return null;
  const maxPeriods = Math.max(...game.lineScores.map(l => l.periods.length), 4);
  const periods = Array.from({ length: maxPeriods }, (_, i) => i + 1);
  const label = (n: number) => (n <= 4 ? `Q${n}` : `OT${n - 4}`);
  const rowFor = (t: TeamMeta) => game.lineScores.find((ls: BBLineScore) => String(ls.teamId) === String(t.id));
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <CardHead>Line Score</CardHead>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 380, fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", minWidth: 110 }}>Team</th>
              {periods.map(n => <th key={n} style={{ padding: "8px 8px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", minWidth: 32 }}>{label(n)}</th>)}
              <th style={{ padding: "8px 10px", textAlign: "center", fontSize: 10, fontWeight: 800, color: "var(--obsidian)", minWidth: 34 }}>T</th>
            </tr>
          </thead>
          <tbody>
            {[away, home].map((t, ri) => {
              const ls = rowFor(t);
              return (
                <tr key={t.id} style={{ borderBottom: ri === 0 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding: "8px 12px" }}><TeamTag team={t} /></td>
                  {periods.map((_, i) => <td key={i} style={{ padding: "8px 8px", textAlign: "center", fontSize: 13, color: "var(--text-secondary)" }}>{ls?.periods[i] ?? ""}</td>)}
                  <td style={{ padding: "8px 10px", textAlign: "center", fontSize: 15, fontWeight: 800, color: "var(--navy)" }}>{ls?.total ?? t.score ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function GameLeaders({ summary, away, home }: { summary: any; away: TeamMeta; home: TeamMeta }) {
  const teamsLeaders: any[] = summary?.leaders ?? [];
  if (!Array.isArray(teamsLeaders) || teamsLeaders.length === 0) return null;
  const byTeam = new Map<string, any[]>();
  for (const t of teamsLeaders) byTeam.set(String(t?.team?.id ?? ""), t?.leaders ?? []);
  const cats = ["points", "rebounds", "assists"];
  const catLabel: Record<string, string> = { points: "Points", rebounds: "Rebounds", assists: "Assists" };
  const cell = (teamId: string, cat: string) => {
    const list = byTeam.get(String(teamId)) ?? [];
    const entry = list.find((l: any) => (l?.name ?? l?.abbreviation ?? "").toLowerCase().includes(cat));
    const leader = entry?.leaders?.[0];
    if (!leader) return null;
    const a = leader.athlete ?? {};
    return { name: a.shortName ?? a.displayName ?? "", value: leader.displayValue ?? String(leader.value ?? "") };
  };
  if (!cats.some(c => cell(away.id, c) || cell(home.id, c))) return null;
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <CardHead>Game Leaders</CardHead>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "8px 16px", gap: 8, borderBottom: "1px solid var(--border)" }}>
        <span style={{ justifySelf: "end" }}><TeamTag team={away} bold /></span>
        <span />
        <span><TeamTag team={home} bold /></span>
      </div>
      {cats.map(cat => {
        const a = cell(away.id, cat); const h = cell(home.id, cat);
        if (!a && !h) return null;
        return (
          <div key={cat} style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--obsidian)" }}>{a?.value ?? "–"}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a?.name ?? ""}</div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", padding: "0 6px" }}>{catLabel[cat]}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--obsidian)" }}>{h?.value ?? "–"}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h?.name ?? ""}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ESPN-style Game Odds table ───────────────────────────────────────────────
function GameOdds({ summary, away, home }: { summary: any; away: TeamMeta; home: TeamMeta }) {
  const odds = parseOdds(summary);
  if (!odds) return null;
  const col = (main: string, sub?: string, boxed = false) => (
    <div style={{ textAlign: "center", padding: boxed ? "6px 8px" : "6px 4px", borderRadius: boxed ? 6 : 0, background: boxed ? "var(--cloud)" : "transparent", minWidth: 56 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--obsidian)" }}>{main}</div>
      {sub ? <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</div> : null}
    </div>
  );
  const row = (t: TeamMeta, o: ReturnType<typeof parseOdds> extends null ? never : any, last: boolean) => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 56px 56px 56px 56px", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <div style={{ minWidth: 0 }}>
        <TeamTag team={t} size={22} />
        {t.record ? <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>({t.record})</div> : null}
      </div>
      {col(o.open, o.openSub)}
      {col(o.spread, o.spreadSub, true)}
      {col(o.total, o.totalSub, true)}
      {col(o.ml, "", true)}
    </div>
  );
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>Game Odds</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Odds by {odds.provider}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 56px 56px 56px 56px", gap: 8, padding: "8px 16px", borderBottom: "1px solid var(--border)" }}>
        <span />
        {["OPEN", "SPREAD", "TOTAL", "ML"].map(h => <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textAlign: "center" }}>{h}</span>)}
      </div>
      {row(away, odds.away, false)}
      {row(home, odds.home, true)}
    </div>
  );
}

// ── Team Stats comparison bars ───────────────────────────────────────────────
function TeamStatsTab({ summary, away, home }: { summary: any; away: TeamMeta; home: TeamMeta }) {
  const teams: any[] = summary?.boxscore?.teams ?? [];
  if (teams.length < 2) return <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "24px 0", textAlign: "center" }}>Team stats are not available for this game.</p>;
  const byId = new Map<string, any[]>();
  for (const t of teams) byId.set(String(t?.team?.id ?? ""), t?.statistics ?? []);
  const awayStats = byId.get(String(away.id)) ?? [];
  const homeStats = byId.get(String(home.id)) ?? [];
  const labels = awayStats.map((s: any) => s.label ?? s.name);
  const pctFromDisplay = (v: string): number | null => {
    const m = String(v).match(/([\d.]+)%/) ?? String(v).match(/^([\d.]+)$/);
    return m ? Number(m[1]) : null;
  };
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
        <span style={{ justifySelf: "end" }}><TeamTag team={away} bold /></span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Team Stats</span>
        <span><TeamTag team={home} bold /></span>
      </div>
      {labels.map((label: string, i: number) => {
        const av = awayStats[i]?.displayValue ?? "";
        const hv = homeStats[i]?.displayValue ?? "";
        const ap = pctFromDisplay(av); const hp = pctFromDisplay(hv);
        const showBar = ap != null && hp != null && (ap + hp) > 0;
        const aw = showBar ? (ap! / (ap! + hp!)) * 100 : 50;
        return (
          <div key={`${label}-${i}`} style={{ padding: "10px 16px", borderBottom: i < labels.length - 1 ? "1px solid var(--border)" : "none" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--obsidian)", textAlign: "right" }}>{av}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap", padding: "0 4px" }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--obsidian)" }}>{hv}</span>
            </div>
            <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", background: "var(--cloud)" }}>
              <div style={{ width: `${aw}%`, background: away.color, opacity: 0.85 }} />
              <div style={{ width: `${100 - aw}%`, background: home.color, opacity: 0.85 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Box Score ────────────────────────────────────────────────────────────────
function PlayerTable({ summary, team }: { summary: any; team: TeamMeta }) {
  const players: any[] = summary?.boxscore?.players ?? [];
  const entry = players.find((p: any) => String(p?.team?.id) === String(team.id));
  const stat = entry?.statistics?.[0];
  const names: string[] = stat?.names ?? [];
  const athletes: any[] = stat?.athletes ?? [];
  if (names.length === 0 || athletes.length === 0) return null;
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}><TeamTag team={team} size={22} bold /></div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560, fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", position: "sticky", left: 0, background: "var(--white)", minWidth: 140 }}>Player</th>
              {names.map((n, i) => <th key={`${n}-${i}`} style={{ padding: "8px 6px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", minWidth: 30 }}>{n}</th>)}
            </tr>
          </thead>
          <tbody>
            {athletes.map((a: any, i: number) => {
              const ath = a?.athlete ?? {};
              const dnp = a?.didNotPlay || (Array.isArray(a?.stats) && a.stats.length === 0);
              return (
                <tr key={ath.id ?? i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "7px 12px", position: "sticky", left: 0, background: "var(--white)" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--obsidian)" }}>{ath.shortName ?? ath.displayName ?? "—"}</span>
                    {a?.starter && <span style={{ fontSize: 9, color: "var(--navy)", fontWeight: 700, marginLeft: 4 }}>ST</span>}
                  </td>
                  {dnp
                    ? <td colSpan={names.length} style={{ padding: "7px 6px", textAlign: "center", fontSize: 11, color: "var(--text-muted)" }}>DNP{a?.reason ? ` — ${a.reason}` : ""}</td>
                    : names.map((_, si) => <td key={si} style={{ padding: "7px 6px", textAlign: "center", fontSize: 12, color: "var(--text-secondary)" }}>{a?.stats?.[si] ?? ""}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BoxScoreTab({ summary, away, home }: { summary: any; away: TeamMeta; home: TeamMeta }) {
  if (!(summary?.boxscore?.players?.length)) return <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "24px 0", textAlign: "center" }}>Box score is not available for this game.</p>;
  return <div><PlayerTable summary={summary} team={away} /><PlayerTable summary={summary} team={home} /></div>;
}

// ── Play-by-Play ─────────────────────────────────────────────────────────────
function PlayByPlayTab({ summary, away, home }: { summary: any; away: TeamMeta; home: TeamMeta }) {
  const plays: any[] = summary?.plays ?? [];
  if (plays.length === 0) return <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "24px 0", textAlign: "center" }}>Play-by-play is not available for this game.</p>;
  const byPeriod = new Map<number, any[]>();
  for (const p of plays) { const n = p?.period?.number ?? 1; if (!byPeriod.has(n)) byPeriod.set(n, []); byPeriod.get(n)!.push(p); }
  const periods = Array.from(byPeriod.keys()).sort((a, b) => a - b);
  const pLabel = (n: number) => (n <= 4 ? `Quarter ${n}` : `OT ${n - 4}`);
  const teamFor = (id: string): TeamMeta | null => String(id) === String(home.id) ? home : String(id) === String(away.id) ? away : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {periods.map(n => (
        <div key={n} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <CardHead>{pLabel(n)}</CardHead>
          {byPeriod.get(n)!.map((p: any, i: number, arr: any[]) => {
            const t = teamFor(p?.team?.id);
            const score = (p?.awayScore != null && p?.homeScore != null) ? `${p.awayScore}-${p.homeScore}` : "";
            return (
              <div key={p?.id ?? i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 16px", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none", background: p?.scoringPlay ? "rgba(0,63,136,0.03)" : "transparent" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 42, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{p?.clock?.displayValue ?? ""}</span>
                {t?.logo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={t.logo} alt="" width={16} height={16} style={{ width: 16, height: 16, objectFit: "contain", flexShrink: 0 }} />
                  : <span style={{ width: 16, flexShrink: 0 }} />}
                <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1, lineHeight: 1.4 }}>{p?.text ?? ""}</span>
                {score && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--obsidian)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{score}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Left sidebar: Game Information ───────────────────────────────────────────
function GameInformation({ info }: { info: ReturnType<typeof parseGameInfo> }) {
  const hasAny = info.dateISO || info.venue || info.attendance != null || info.broadcasts.length || info.officials.length;
  if (!hasAny) return null;
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <CardHead>Game Information</CardHead>
      {info.dateISO && (
        <Row label="Date & Time"><LocalDateTime iso={info.dateISO} /></Row>
      )}
      {info.venue && (
        <Row label="Venue">
          <div>{info.venue}</div>
          {info.location && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{info.location}</div>}
        </Row>
      )}
      {info.attendance != null && <Row label="Attendance">{info.attendance.toLocaleString()}</Row>}
      {info.broadcasts.length > 0 && <Row label="Where to Watch">{info.broadcasts.join(", ")}</Row>}
      {info.officials.length > 0 && (
        <div style={{ padding: "10px 16px" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Officiating Crew</div>
          {info.officials.map((o, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, padding: "3px 0" }}>
              <span style={{ color: "var(--text-muted)" }}>{o.position}</span>
              <span style={{ fontWeight: 600, color: "var(--obsidian)", textAlign: "right" }}>{o.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)" }}>{children}</div>
    </div>
  );
}

function SidebarLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
      {label}<span style={{ color: "var(--text-muted)" }}>→</span>
    </Link>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function parseSummaryNews(summary: any): { id: string; headline: string; image: string | null; link: string | null }[] {
  const articles: any[] = summary?.news?.articles ?? [];
  return articles.slice(0, 6).map((a: any, i: number) => ({
    id: String(a?.id ?? i),
    headline: String(a?.headline ?? a?.title ?? ""),
    image: a?.images?.[0]?.url ?? null,
    link: a?.links?.web?.href ?? null,
  })).filter((a: any) => a.headline);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default async function MatchPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { league = "nba" } = await searchParams;

  const [game, summary, standings] = await Promise.all([
    getGameDetail(league, id),
    fetchSummary(league, id),
    getStandings(league),
  ]);
  if (!game) return notFound();

  const { away, home } = buildTeams(summary, game);
  const info = parseGameInfo(summary, game);
  const news = parseSummaryNews(summary);
  const qs = `?league=${league}`;

  // Standings arrive unsorted with an inconsistent rank field — order them by
  // the actual standings rule (win% desc, then wins, then fewer losses) and
  // renumber sequentially so the table reads 1..N correctly.
  const sortedStandings = [...standings]
    .sort((a, b) => (b.winPct - a.winPct) || (b.wins - a.wins) || (a.losses - b.losses))
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const tabs: { key: string; label: string; content: React.ReactNode }[] = [
    {
      key: "summary", label: "Summary", content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {summary && <GameLeaders summary={summary} away={away} home={home} />}
          <LineScoreTable game={game} away={away} home={home} />
          {summary && <GameOdds summary={summary} away={away} home={home} />}
        </div>
      ),
    },
  ];
  if (summary?.boxscore?.players?.length) tabs.push({ key: "box", label: "Box Score", content: <BoxScoreTab summary={summary} away={away} home={home} /> });
  if (summary?.boxscore?.teams?.length) tabs.push({ key: "teamstats", label: "Team Stats", content: <TeamStatsTab summary={summary} away={away} home={home} /> });
  if (hasShotData(summary)) tabs.push({
    key: "shotchart", label: "Shot Chart", content: (
      <ShotChart data={summary} homeTeamId={home.id} awayTeamId={away.id}
        homeShort={home.short} awayShort={away.short} homeColor={home.color} awayColor={away.color}
        homeLogo={home.logo ?? undefined} awayLogo={away.logo ?? undefined} />
    ),
  });
  if (summary?.plays?.length) tabs.push({ key: "pbp", label: "Play-by-Play", content: <PlayByPlayTab summary={summary} away={away} home={home} /> });

  return (
    <div className="container" style={{ maxWidth: 1320, paddingTop: 24, paddingBottom: 40 }}>
      <Link href="/basketball" style={{ display: "inline-block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none", marginBottom: 20, padding: "6px 10px", borderRadius: 7, background: "var(--cloud)" }}>← Basketball</Link>

      <div style={{ marginBottom: 20 }}><BasketballLiveScoreHeader initialGame={game} league={league} /></div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* LEFT: Game Information */}
        <div style={{ flex: "1 1 260px", minWidth: 240, maxWidth: 320, display: "flex", flexDirection: "column", gap: 16 }}>
          <GameInformation info={info} />
        </div>

        {/* CENTER: tabs */}
        <div style={{ flex: "3 1 520px", minWidth: 0 }}>
          <MatchColumnTabs tabs={tabs} />
        </div>

        {/* RIGHT: standings + news */}
        <div style={{ flex: "1 1 280px", minWidth: 260, maxWidth: 340, display: "flex", flexDirection: "column", gap: 16 }}>
          {sortedStandings.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--obsidian)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 8 }}>{leagueName(league)} Standings</div>
              <StandingsTable rows={sortedStandings} league={league} limit={16} highlightTeamIds={[home.id, away.id]} />
            </div>
          )}
          {news.length > 0 && (
            <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              <CardHead>{leagueName(league)} News</CardHead>
              {news.map((a, i) => (
                <a key={a.id} href={a.link ?? "#"} target="_blank" rel="noopener noreferrer" style={{ display: "flex", gap: 10, padding: "12px 16px", borderBottom: i < news.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none" }}>
                  {a.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.image} alt="" width={52} height={52} style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.headline}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <CardHead>Quick Links</CardHead>
            <SidebarLink href={`/basketball/team/${home.id}${qs}`} label={`${home.short} Roster`} />
            <SidebarLink href={`/basketball/team/${away.id}${qs}`} label={`${away.short} Roster`} />
            <SidebarLink href={`/basketball/league/${league}`} label={`${leagueName(league)} League`} />
          </div>
        </div>
      </div>
    </div>
  );
}