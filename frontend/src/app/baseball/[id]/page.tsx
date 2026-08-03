import Link from "next/link";
import { notFound } from "next/navigation";
import { getGameDetail, getStandings, BBGameDetail, BBLineScore } from "@/lib/api/baseball";
import { leagueName } from "@/types/baseball";
import ScoreHeader from "@/components/baseball/ScoreHeader";
import StandingsTable from "@/components/baseball/StandingsTable";
import MatchColumnTabs from "@/components/baseball/MatchColumnTabs";
import DiamondPlays from "@/components/baseball/DiamondPlays";
import LocalDateTime from "@/components/baseball/LocalDateTime";
import BaseballLiveScoreHeader from "@/components/baseball/BaseballLiveScoreHeader";

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
  if (league !== "mlb") cands.push("mlb");
  for (const lg of [...new Set(cands)]) {
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/${lg}/summary?event=${id}`, { headers: ESPN_HEADERS, next: { revalidate: 45 } });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.boxscore || data?.plays) return data;
    } catch { /* try next */ }
  }
  return null;
}

function buildTeams(summary: any, game: BBGameDetail): { away: TeamMeta; home: TeamMeta } {
  const _c = summary?.header?.competitions?.[0]?.competitors; const comps: any[] = Array.isArray(_c) ? _c : [];
  const mk = (ref: BBGameDetail["homeTeam"], homeAway: "home" | "away"): TeamMeta => {
    const c = comps.find(x => x.homeAway === homeAway) ?? comps.find(x => String(x.team?.id) === String(ref.id)) ?? {};
    const t = c.team ?? {};
    const recArr = c.records ?? c.record ?? [];
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

function parseGameInfo(summary: any, game: BBGameDetail) {
  const comp = summary?.header?.competitions?.[0] ?? {};
  const gi = summary?.gameInfo ?? {};
  const venueObj = gi.venue ?? comp.venue ?? {};
  const addr = venueObj.address ?? {};
  const broadcasts: string[] = (Array.isArray(comp.broadcasts) ? comp.broadcasts : []).flatMap((b: any) => b.names ?? (b.media?.shortName ? [b.media.shortName] : []));
  const umpires: { name: string; position: string }[] = (Array.isArray(gi.officials) ? gi.officials : []).map((o: any) => ({ name: o.displayName ?? o.fullName ?? "", position: o.position?.displayName ?? o.position?.name ?? "Umpire" }));
  const w = gi.weather ?? {};
  const weather = w.displayValue || w.temperature != null
    ? `${w.displayValue ?? ""}${w.temperature != null ? `${w.displayValue ? ", " : ""}${w.temperature}°${w.temperature > 45 ? "F" : ""}` : ""}`.trim()
    : null;
  return {
    dateISO: comp.date ?? game.firstPitch ?? null,
    venue: venueObj.fullName ?? game.venue ?? null,
    location: [addr.city, addr.state].filter(Boolean).join(", ") || null,
    attendance: gi.attendance ?? game.attendance ?? null,
    weather,
    broadcasts: [...new Set(broadcasts)] as string[],
    umpires: umpires.length ? umpires : game.officials.map(o => ({ name: o.name, position: o.position })),
  };
}

function signed(n: number): string { return n > 0 ? `+${n}` : String(n); }
function parseOdds(summary: any) {
  const pc: any[] = summary?.pickcenter ?? [];
  if (!Array.isArray(pc) || pc.length === 0) return null;
  const p = pc.find(x => x.awayTeamOdds || x.homeTeamOdds) ?? pc[0];
  const ou = p.overUnder ?? p.current?.total?.value ?? null;
  const spread = typeof p.spread === "number" ? p.spread : null;
  const cell = (to: any, isAway: boolean) => {
    if (!to) return { open: "—", runline: "—", total: "—", ml: "—" };
    const cur = to.current ?? {};
    const open = to.open ?? {};
    const ml = to.moneyLine ?? cur.moneyLine?.american ?? "—";
    const rlMain = cur.pointSpread?.american ?? cur.spread?.american
      ?? (spread != null ? signed(to.favorite ? -Math.abs(spread) : Math.abs(spread)) : "—");
    const rlSub = cur.spread?.american ?? (to.spreadOdds != null ? signed(to.spreadOdds) : "");
    const totMain = cur.total?.american ?? (ou != null ? `${isAway ? "o" : "u"}${ou}` : "—");
    const opnMain = open.pointSpread?.american ?? open.total?.american ?? open.spread?.american ?? "—";
    return {
      open: String(opnMain), runline: String(rlMain), runlineSub: String(rlSub ?? ""),
      total: String(totMain), ml: String(ml),
    };
  };
  return { provider: p.provider?.name ?? "Odds", away: cell(p.awayTeamOdds, true), home: cell(p.homeTeamOdds, false) };
}

function boxGroups(summary: any, teamId: string): { batting: any; pitching: any } {
  const players: any[] = summary?.boxscore?.players ?? [];
  const entry = players.find((p: any) => String(p?.team?.id) === String(teamId));
  const stats: any[] = Array.isArray(entry?.statistics) ? entry.statistics : [];
  const find = (kw: string) => stats.find((s: any) => (s?.name ?? s?.type ?? "").toLowerCase().includes(kw));
  return { batting: find("batting") ?? stats[0], pitching: find("pitching") ?? stats[1] };
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
function CardHead({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>{children}</span>
      {right}
    </div>
  );
}

// ── Live situation: count + runners on the diamond ───────────────────────────
function Dots({ n, total, color }: { n: number; total: number; color: string }) {
  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: i < n ? color : "var(--border)", display: "inline-block" }} />
      ))}
    </span>
  );
}
/* eslint-disable @typescript-eslint/no-explicit-any */
function SituationPanel({ summary, game }: { summary: any; game: BBGameDetail }) {
  const s = summary?.situation;
  if (game.statusState !== "in" || !s) return null;
  const balls = s.balls ?? 0, strikes = s.strikes ?? 0, outs = s.outs ?? 0;
  const on1 = !!s.onFirst, on2 = !!s.onSecond, on3 = !!s.onThird;
  const batter = s.batter?.athlete?.shortName ?? s.batter?.athlete?.displayName ?? s.dueUp?.[0]?.athlete?.shortName ?? "";
  const pitcher = s.pitcher?.athlete?.shortName ?? s.pitcher?.athlete?.displayName ?? "";
  const base = (occ: boolean, cx: number, cy: number) => (
    <rect x={cx - 9} y={cy - 9} width={18} height={18} rx={2} transform={`rotate(45 ${cx} ${cy})`}
      fill={occ ? "#EA580C" : "var(--white)"} stroke={occ ? "#EA580C" : "var(--text-muted)"} strokeWidth={2} />
  );
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <CardHead right={<span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626" }}>● {game.inningDetail ?? "Live"}</span>}>Current At-Bat</CardHead>
      <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "16px", flexWrap: "wrap" }}>
        <svg viewBox="0 0 120 120" width={116} height={116} style={{ flexShrink: 0 }}>
          <path d="M60,104 L96,68 L60,32 L24,68 Z" fill="#C89B6B" opacity={0.25} />
          {base(on2, 60, 32)}
          {base(on3, 24, 68)}
          {base(on1, 96, 68)}
          <rect x={54} y={98} width={12} height={12} rx={1.5} transform="rotate(45 60 104)" fill="var(--white)" stroke="var(--text-muted)" strokeWidth={2} />
        </svg>
        <div style={{ flex: 1, minWidth: 180 }}>
          {pitcher && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Pitching: <span style={{ fontWeight: 700, color: "var(--obsidian)" }}>{pitcher}</span></div>}
          {batter && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>At bat: <span style={{ fontWeight: 700, color: "var(--obsidian)" }}>{batter}</span></div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 52, fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Balls</span><Dots n={balls} total={3} color="#16a34a" /></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 52, fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Strikes</span><Dots n={strikes} total={2} color="#EA580C" /></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 52, fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Outs</span><Dots n={outs} total={2} color="#dc2626" /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pitching matchup (probables / decisions) ─────────────────────────────────
function PitchingMatchup({ summary, away, home }: { summary: any; away: TeamMeta; home: TeamMeta }) {
  const _c = summary?.header?.competitions?.[0]?.competitors; const comps: any[] = Array.isArray(_c) ? _c : [];
  const probFor = (teamId: string) => {
    const c = comps.find(x => String(x.team?.id) === String(teamId));
    const prob = c?.probables?.[0];
    const pr = prob?.athlete ?? prob;
    if (!pr) return null;
    const rawStats = prob?.statistics;
    let stat = "";
    if (Array.isArray(rawStats)) stat = rawStats.map((s: any) => `${s.displayValue}${s.abbreviation ? ` ${s.abbreviation}` : ""}`).join(" · ");
    else if (rawStats && typeof rawStats === "object") stat = rawStats.summary ?? rawStats.displayValue ?? "";
    return { name: pr.shortName ?? pr.displayName ?? "", stat };
  };
  const a = probFor(away.id); const h = probFor(home.id);
  if (!a && !h) return null;
  const side = (t: TeamMeta, p: { name: string; stat: string } | null) => (
    <div style={{ flex: 1, textAlign: "center", padding: "12px" }}>
      <TeamTag team={t} size={22} />
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--obsidian)", marginTop: 8 }}>{p?.name ?? "TBD"}</div>
      {p?.stat && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{p.stat}</div>}
    </div>
  );
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <CardHead>Probable Pitchers</CardHead>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {side(away, a)}
        <div style={{ width: 1, background: "var(--border)" }} />
        {side(home, h)}
      </div>
    </div>
  );
}

// ── Game Leaders (batting + pitching) ────────────────────────────────────────
function GameLeaders({ summary, away, home }: { summary: any; away: TeamMeta; home: TeamMeta }) {
  const teamsLeaders: any[] = summary?.leaders ?? [];
  if (!Array.isArray(teamsLeaders) || teamsLeaders.length === 0) return null;
  const byTeam = new Map<string, any[]>();
  for (const t of teamsLeaders) byTeam.set(String(t?.team?.id ?? ""), Array.isArray(t?.leaders) ? t.leaders : []);
  const cats = [
    { key: "hits", label: "Hits" }, { key: "homeruns", label: "HR" },
    { key: "rbis", label: "RBI" }, { key: "strikeouts", label: "Pitching K" },
  ];
  const cell = (teamId: string, key: string) => {
    const list = byTeam.get(String(teamId)) ?? [];
    const entry = list.find((l: any) => (l?.name ?? l?.abbreviation ?? "").toLowerCase().replace(/[^a-z]/g, "").includes(key));
    const leader = entry?.leaders?.[0];
    if (!leader) return null;
    const a = leader.athlete ?? {};
    return { name: a.shortName ?? a.displayName ?? "", value: leader.displayValue ?? String(leader.value ?? "") };
  };
  const rows = cats.filter(c => cell(away.id, c.key) || cell(home.id, c.key));
  if (rows.length === 0) return null;
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <CardHead>Game Leaders</CardHead>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "8px 16px", gap: 8, borderBottom: "1px solid var(--border)" }}>
        <span style={{ justifySelf: "end" }}><TeamTag team={away} bold /></span><span /><span><TeamTag team={home} bold /></span>
      </div>
      {rows.map(({ key, label }) => {
        const a = cell(away.id, key); const h = cell(home.id, key);
        return (
          <div key={key} style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--obsidian)" }}>{a?.value ?? "–"}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a?.name ?? ""}</div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", padding: "0 6px" }}>{label}</span>
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

// ── Line Score (innings + R/H/E, away then home) ─────────────────────────────
function LineScoreTable({ game, away, home }: { game: BBGameDetail; away: TeamMeta; home: TeamMeta }) {
  if (!game.lineScores || game.lineScores.length === 0) return null;
  const maxInnings = Math.max(...game.lineScores.map(l => l.innings.length), 9);
  const innings = Array.from({ length: maxInnings }, (_, i) => i + 1);
  const rowFor = (t: TeamMeta) => game.lineScores.find((ls: BBLineScore) => String(ls.teamId) === String(t.id));
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <CardHead>Line Score</CardHead>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520, fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", minWidth: 110 }}>Team</th>
              {innings.map(n => <th key={n} style={{ padding: "8px 6px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", minWidth: 24 }}>{n}</th>)}
              {["R", "H", "E"].map(c => <th key={c} style={{ padding: "8px 8px", textAlign: "center", fontSize: 10, fontWeight: 800, color: "var(--obsidian)", minWidth: 30 }}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {[away, home].map((t, ri) => {
              const ls = rowFor(t);
              return (
                <tr key={t.id} style={{ borderBottom: ri === 0 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding: "8px 12px" }}><TeamTag team={t} /></td>
                  {innings.map((_, i) => <td key={i} style={{ padding: "8px 6px", textAlign: "center", fontSize: 13, color: "var(--text-secondary)" }}>{ls?.innings[i] ?? ""}</td>)}
                  <td style={{ padding: "8px 8px", textAlign: "center", fontSize: 14, fontWeight: 800, color: "var(--navy)" }}>{ls?.runs ?? ""}</td>
                  <td style={{ padding: "8px 8px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "var(--obsidian)" }}>{ls?.hits ?? ""}</td>
                  <td style={{ padding: "8px 8px", textAlign: "center", fontSize: 13, color: "var(--text-secondary)" }}>{ls?.errors ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Odds (OPEN / RUN LINE / TOTAL / ML) ──────────────────────────────────────
function GameOdds({ summary, away, home }: { summary: any; away: TeamMeta; home: TeamMeta }) {
  const odds = parseOdds(summary);
  if (!odds) return null;
  const col = (main: string, sub?: string, boxed = false) => (
    <div style={{ textAlign: "center", padding: boxed ? "6px 8px" : "6px 4px", borderRadius: boxed ? 6 : 0, background: boxed ? "var(--cloud)" : "transparent", minWidth: 56 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--obsidian)" }}>{main}</div>
      {sub ? <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</div> : null}
    </div>
  );
  const row = (t: TeamMeta, o: any, last: boolean) => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 56px 56px 56px 56px", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <div style={{ minWidth: 0 }}>
        <TeamTag team={t} size={22} />
        {t.record ? <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>({t.record})</div> : null}
      </div>
      {col(o.open)}{col(o.runline, o.runlineSub, true)}{col(o.total, "", true)}{col(o.ml, "", true)}
    </div>
  );
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <CardHead right={<span style={{ fontSize: 11, color: "var(--text-muted)" }}>Odds by {odds.provider}</span>}>Game Odds</CardHead>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 56px 56px 56px 56px", gap: 8, padding: "8px 16px", borderBottom: "1px solid var(--border)" }}>
        <span />{["OPEN", "RUN LINE", "TOTAL", "ML"].map(h => <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textAlign: "center" }}>{h}</span>)}
      </div>
      {row(away, odds.away, false)}{row(home, odds.home, true)}
    </div>
  );
}

// ── Box Score (batting + pitching per team) ──────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
function StatGroupTable({ group, title, showPos }: { group: any; title: string; showPos?: boolean }) {
  const names: string[] = Array.isArray(group?.names) ? group.names : (Array.isArray(group?.labels) ? group.labels : []);
  const athletes: any[] = Array.isArray(group?.athletes) ? group.athletes : [];
  const totals: string[] = Array.isArray(group?.totals) ? group.totals : [];
  if (names.length === 0 || athletes.length === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ padding: "8px 16px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", background: "var(--cloud)", borderBottom: "1px solid var(--border)", borderTop: "1px solid var(--border)" }}>{title}</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520, fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", position: "sticky", left: 0, background: "var(--white)", minWidth: 150 }}>Player</th>
              {names.map((n, i) => <th key={`${n}-${i}`} style={{ padding: "8px 6px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", minWidth: 30 }}>{n}</th>)}
            </tr>
          </thead>
          <tbody>
            {athletes.map((a: any, i: number) => {
              const ath = a?.athlete ?? {};
              const pos = showPos ? (ath.position?.abbreviation ?? a?.position?.abbreviation ?? "") : "";
              const note = Array.isArray(a?.notes) ? a.notes.map((x: any) => x.text ?? x).join(", ") : "";
              return (
                <tr key={ath.id ?? i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "7px 12px", position: "sticky", left: 0, background: "var(--white)" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--obsidian)" }}>{ath.shortName ?? ath.displayName ?? "—"}</span>
                    {pos && <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 4 }}>{pos}</span>}
                    {note && <span style={{ fontSize: 10, color: "var(--navy)", fontWeight: 700, marginLeft: 4 }}>{note}</span>}
                  </td>
                  {names.map((_, si) => <td key={si} style={{ padding: "7px 6px", textAlign: "center", fontSize: 12, color: "var(--text-secondary)" }}>{a?.stats?.[si] ?? ""}</td>)}
                </tr>
              );
            })}
            {totals.length > 0 && (
              <tr style={{ borderTop: "2px solid var(--border)" }}>
                <td style={{ padding: "7px 12px", position: "sticky", left: 0, background: "var(--white)", fontSize: 11, fontWeight: 800, color: "var(--obsidian)" }}>TEAM</td>
                {totals.map((v, si) => <td key={si} style={{ padding: "7px 6px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "var(--obsidian)" }}>{v}</td>)}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamBox({ summary, team }: { summary: any; team: TeamMeta }) {
  const { batting, pitching } = boxGroups(summary, team.id);
  if (!batting && !pitching) return null;
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}><TeamTag team={team} size={22} bold /></div>
      <StatGroupTable group={batting} title="Batting" showPos />
      <StatGroupTable group={pitching} title="Pitching" />
    </div>
  );
}

function BoxScoreTab({ summary, away, home }: { summary: any; away: TeamMeta; home: TeamMeta }) {
  if (!(summary?.boxscore?.players?.length)) return <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "24px 0", textAlign: "center" }}>Box score is not available for this game.</p>;
  return <div><TeamBox summary={summary} team={away} /><TeamBox summary={summary} team={home} /></div>;
}

// ── Team Stats comparison ────────────────────────────────────────────────────
function TeamStatsTab({ summary, away, home }: { summary: any; away: TeamMeta; home: TeamMeta }) {
  const teams: any[] = Array.isArray(summary?.boxscore?.teams) ? summary.boxscore.teams : [];
  if (teams.length < 2) return <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "24px 0", textAlign: "center" }}>Team stats are not available for this game.</p>;
  const byId = new Map<string, any[]>();
  for (const t of teams) byId.set(String(t?.team?.id ?? ""), Array.isArray(t?.statistics) ? t.statistics : []);
  const awayStats = byId.get(String(away.id)) ?? [];
  const homeStats = byId.get(String(home.id)) ?? [];
  const labels = awayStats.map((s: any) => s.label ?? s.name);
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
        <span style={{ justifySelf: "end" }}><TeamTag team={away} bold /></span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Team Stats</span>
        <span><TeamTag team={home} bold /></span>
      </div>
      {labels.map((label: string, i: number) => (
        <div key={`${label}-${i}`} style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center", padding: "10px 16px", borderBottom: i < labels.length - 1 ? "1px solid var(--border)" : "none" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--obsidian)", textAlign: "right" }}>{awayStats[i]?.displayValue ?? ""}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap", padding: "0 4px" }}>{label}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--obsidian)" }}>{homeStats[i]?.displayValue ?? ""}</span>
        </div>
      ))}
    </div>
  );
}

// ── Play-by-Play (grouped by inning) ─────────────────────────────────────────
function PlayByPlayTab({ summary, away, home }: { summary: any; away: TeamMeta; home: TeamMeta }) {
  const plays: any[] = summary?.plays ?? [];
  if (plays.length === 0) return <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "24px 0", textAlign: "center" }}>Play-by-play is not available for this game.</p>;
  const groups: { label: string; plays: any[] }[] = [];
  let curKey = ""; let cur: any[] = [];
  for (const p of plays) {
    const per = p?.period ?? {};
    const key = `${per.type ?? ""}-${per.number ?? ""}`;
    const label = per.displayValue ?? `${per.type ?? ""} ${per.number ?? ""}`.trim();
    if (key !== curKey) { cur = []; groups.push({ label, plays: cur }); curKey = key; }
    cur.push(p);
  }
  const teamFor = (id: string): TeamMeta | null => String(id) === String(home.id) ? home : String(id) === String(away.id) ? away : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {groups.map((g, gi) => (
        <div key={gi} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <CardHead>{g.label}</CardHead>
          {g.plays.map((p: any, i: number) => {
            const t = teamFor(p?.team?.id);
            const score = (p?.awayScore != null && p?.homeScore != null) ? `${p.awayScore}-${p.homeScore}` : "";
            return (
              <div key={p?.id ?? i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 16px", borderBottom: i < g.plays.length - 1 ? "1px solid var(--border)" : "none", background: p?.scoringPlay ? "rgba(0,63,136,0.03)" : "transparent" }}>
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

// ── Left sidebar: Game Info ──────────────────────────────────────────────────
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--obsidian)" }}>{children}</div>
    </div>
  );
}
function GameInformation({ info }: { info: ReturnType<typeof parseGameInfo> }) {
  const hasAny = info.dateISO || info.venue || info.attendance != null || info.weather || info.broadcasts.length || info.umpires.length;
  if (!hasAny) return null;
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <CardHead>Game Info</CardHead>
      {info.dateISO && <InfoRow label="Date & Time"><LocalDateTime iso={info.dateISO} /></InfoRow>}
      {info.venue && <InfoRow label="Venue"><div>{info.venue}</div>{info.location && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{info.location}</div>}</InfoRow>}
      {info.attendance != null && <InfoRow label="Attendance">{info.attendance.toLocaleString()}</InfoRow>}
      {info.weather && <InfoRow label="Weather">{info.weather}</InfoRow>}
      {info.broadcasts.length > 0 && <InfoRow label="Where to Watch">{info.broadcasts.join(", ")}</InfoRow>}
      {info.umpires.length > 0 && (
        <div style={{ padding: "10px 16px" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Umpires</div>
          {info.umpires.map((o, i) => (
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

function SidebarLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
      {label}<span style={{ color: "var(--text-muted)" }}>→</span>
    </Link>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function parseSummaryNews(summary: any): { id: string; headline: string; image: string | null; link: string | null }[] {
  const articles: any[] = Array.isArray(summary?.news?.articles) ? summary.news.articles : [];
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
  const { league = "mlb" } = await searchParams;

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

  const sortedStandings = [...standings]
    .sort((a, b) => (b.winPct - a.winPct) || (b.wins - a.wins) || (a.losses - b.losses))
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const tabs: { key: string; label: string; content: React.ReactNode }[] = [
    {
      key: "summary", label: "Summary", content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {summary && <SituationPanel summary={summary} game={game} />}
          {summary && <PitchingMatchup summary={summary} away={away} home={home} />}
          {summary && <GameLeaders summary={summary} away={away} home={home} />}
          <LineScoreTable game={game} away={away} home={home} />
          <DiamondPlays events={game.events} homeTeam={game.homeTeam} awayTeam={game.awayTeam} />
          {summary && <GameOdds summary={summary} away={away} home={home} />}
        </div>
      ),
    },
  ];
  if (summary?.boxscore?.players?.length) tabs.push({ key: "box", label: "Box Score", content: <BoxScoreTab summary={summary} away={away} home={home} /> });
  if (summary?.boxscore?.teams?.length) tabs.push({ key: "teamstats", label: "Team Stats", content: <TeamStatsTab summary={summary} away={away} home={home} /> });
  if (summary?.plays?.length) tabs.push({ key: "pbp", label: "Play-by-Play", content: <PlayByPlayTab summary={summary} away={away} home={home} /> });

  return (
    <div className="container" style={{ maxWidth: 1320, paddingTop: 24, paddingBottom: 40 }}>
      <Link href="/baseball" style={{ display: "inline-block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none", marginBottom: 20, padding: "6px 10px", borderRadius: 7, background: "var(--cloud)" }}>← Baseball</Link>

      <div style={{ marginBottom: 20 }}><BaseballLiveScoreHeader initialGame={game} league={league} /></div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* LEFT: Game Info */}
        <div style={{ flex: "1 1 260px", minWidth: 240, maxWidth: 320, display: "flex", flexDirection: "column", gap: 16 }}>
          <GameInformation info={info} />
        </div>

        {/* CENTER: tabs */}
        <div style={{ flex: "3 1 520px", minWidth: 0 }}>
          <MatchColumnTabs tabs={tabs} />
        </div>

        {/* RIGHT: standings + news + quick links */}
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
            <SidebarLink href={`/baseball/team/${away.id}${qs}`} label={`${away.short} Roster`} />
            <SidebarLink href={`/baseball/team/${home.id}${qs}`} label={`${home.short} Roster`} />
            <SidebarLink href={`/baseball/league/${league}`} label={`${leagueName(league)} League`} />
          </div>
        </div>
      </div>
    </div>
  );
}