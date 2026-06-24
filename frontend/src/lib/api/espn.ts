/**
 * ESPN public API - server-side only.
 * Called from Next.js server components and route handlers.
 * Never imported in client components (no "use client" files).
 *
 * All parsers are defensive: missing fields return nulls/empty arrays, never throw.
 * Shapes verified against soccer.md + Hema's CoreSportsAdapter.
 */
import { ESPN_BASE, ESPN_CORE, espnGet } from "@/lib/config";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface ESPNMatch {
  id: string;
  status: string;          // "FT" | "HT" | "67'" | "Scheduled" | full date string
  statusState: string;     // "pre" | "in" | "post"
  kickoff: string | null;
  competition: string;
  homeTeam: ESPNTeamRef;
  awayTeam: ESPNTeamRef;
  homeScore: number | null;
  awayScore: number | null;
}

export interface ESPNTeamRef {
  id: string;
  name: string;
  shortName: string;
  logo: string | null;
}

export interface ESPNStandingRow {
  rank: number;
  teamId: string;
  team: string;
  shortName: string;
  logo: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  note: string | null; // "Champions League" | "Relegation" etc
}

export interface ESPNNews {
  id: string;
  headline: string;
  description: string;
  published: string;
  image: string | null;
  category: string;
  link: string | null;
}

export interface ESPNTeam {
  id: string;
  name: string;
  shortName: string;
  logo: string | null;
  color: string | null;
  venue: string | null;
  record: string | null;
}

export interface ESPNPlayer {
  id: string;
  name: string;
  jersey: string | null;
  position: string | null;
  age: number | null;
  nationality: string | null;
  headshot: string | null;
}

export interface ESPNLeader {
  rank: number;
  category: string;
  player: string;
  team: string;
  teamLogo: string | null;
  headshot: string | null;
  value: number;
  displayValue: string;
}

// ─────────────────────────────────────────────
// SCOREBOARD  (live + scheduled + recent results)
// ─────────────────────────────────────────────

export async function getScoreboard(league: string): Promise<ESPNMatch[]> {
  const raw = await espnGet<any>(`${ESPN_BASE}/${league}/scoreboard`, 30);
  if (!raw) return [];
  return (raw.events ?? []).map(parseEvent).filter(Boolean) as ESPNMatch[];
}

function parseEvent(e: any): ESPNMatch | null {
  try {
    const comp = e.competitions?.[0];
    if (!comp) return null;
    const st = comp.status?.type ?? {};
    const home = comp.competitors?.find((c: any) => c.homeAway === "home") ?? comp.competitors?.[0];
    const away = comp.competitors?.find((c: any) => c.homeAway === "away") ?? comp.competitors?.[1];
    if (!home || !away) return null;

    return {
      id: String(e.id ?? ""),
      status: st.shortDetail ?? st.detail ?? st.name ?? "",
      statusState: st.state ?? "pre",           // "pre" | "in" | "post"
      kickoff: e.date ?? null,
      competition: e.season?.type?.name ?? comp.tournament?.name ?? "",
      homeTeam: parseTeamRef(home.team, home.team?.logo),
      awayTeam: parseTeamRef(away.team, away.team?.logo),
      homeScore: home.score != null ? Number(home.score) : null,
      awayScore: away.score != null ? Number(away.score) : null,
    };
  } catch { return null; }
}

function parseTeamRef(t: any, logo?: string): ESPNTeamRef {
  return {
    id: String(t?.id ?? ""),
    name: t?.displayName ?? t?.name ?? "-",
    shortName: t?.abbreviation ?? t?.shortDisplayName ?? "",
    logo: logo ?? t?.logo ?? t?.logos?.[0]?.href ?? null,
  };
}

// ─────────────────────────────────────────────
// STANDINGS
// ESPN v2 standings path:  /apis/v2/sports/soccer/{league}/standings
// ─────────────────────────────────────────────

export async function getStandings(league: string): Promise<ESPNStandingRow[]> {
  // The site/v2 endpoint returns {} for soccer - must use the core v2 path
  const raw = await espnGet<any>(
    `https://site.web.api.espn.com/apis/v2/sports/soccer/${league}/standings`,
    300
  );
  if (!raw) return [];

  const entries =
    raw?.children?.[0]?.standings?.entries ??
    raw?.standings?.entries ??
    raw?.entries ?? [];

  return (entries as any[]).map((e: any, i: number) => {
    const stats: any[] = e?.stats ?? [];
    const t = e?.team ?? {};
    const sv = (names: string[]) => {
      for (const n of names) {
        const s = stats.find((x: any) => x?.name === n || x?.abbreviation === n);
        if (s?.value != null) return Number(s.value);
      }
      return 0;
    };
    const note = e?.note?.color ? e.note.description ?? null : null;
    const gf = sv(["pointsFor", "goalsFor"]);
    const ga = sv(["pointsAgainst", "goalsAgainst"]);
    return {
      rank: sv(["rank"]) || i + 1,
      teamId: String(t?.id ?? ""),
      team: t?.displayName ?? t?.name ?? "-",
      shortName: t?.abbreviation ?? "",
      logo: t?.logos?.[0]?.href ?? t?.logo ?? null,
      played: sv(["gamesPlayed"]),
      won: sv(["wins"]),
      drawn: sv(["ties", "draws"]),
      lost: sv(["losses"]),
      goalsFor: gf,
      goalsAgainst: ga,
      goalDiff: sv(["pointDifferential", "goalDifferential"]) || gf - ga,
      points: sv(["points"]),
      note,
    };
  });
}
// ─────────────────────────────────────────────
// NEWS
// ─────────────────────────────────────────────

export async function getNews(league: string, limit = 12): Promise<ESPNNews[]> {
  const raw = await espnGet<any>(
    `${ESPN_BASE}/${league}/news?limit=${limit}`,
    120 // ← 2 minutes
  );

  const GENERIC = new Set(["Soccer", "Football", "Sports", "Sport"]);
  const TRANSFER_RE =
    /\b(sign(ed|ing|s)?|transfer(red|ring|s)?|join(ed|ing|s)?|deal|move(d|s)?|loan(ed|ing)?|fee|bid(ding)?|want(ed|s)?|target(ed|ing|s)?|buy(ing)?|sold|sell(ing)?|agree(d|s|ment)?|swap|release(d)?|contract|renew(al|ed|ing|s)?|exit(s|ed|ing)?|depart(ed|ure|ing|s)?|arrive(d|s)?|unveil(ed|s)?|confirm(ed|s)?|scout(ed|ing|s)?|approach(ed|es|ing)?|negotiate(d|s|ing)?|pursue(d|s|ing)?|reject(ed|s|ion)?|offer(ed|s|ing)?|window|deadline|permanent|activat(e|ed|ion)?|option|clause|replac(e|ed|ing|ement)?|successor|appointment|manag(er|ement|orial)?|sack(ed|ing)?|resign(ed|ation|ing)?|hire(d|s)?|appoint(ed|ment|ing)?)\b/i;

  return ((raw?.articles ?? []) as any[]).map((a: any, i: number) => {
    const text = `${a?.headline ?? ""} ${a?.description ?? ""}`;

    let category: string;
    if (TRANSFER_RE.test(text)) {
      category = "Transfer";
    } else {
      const cats: any[] = a?.categories ?? [];
      category =
        cats.find((c: any) => c?.type === "league" && !GENERIC.has(c?.description))?.description ??
        cats.find((c: any) => c?.type === "team")?.description ??
        cats.find((c: any) => c?.description && !GENERIC.has(c?.description))?.description ??
        "Football";
    }

    return {
      id: String(a?.id ?? i),
      headline: a?.headline ?? "Untitled",
      description: a?.description ?? "",
      published: a?.published ?? "",
      image: (() => {
        const imgs: any[] = a?.images ?? [];
        const sorted = [...imgs].sort((x: any, y: any) => (y?.width ?? 0) - (x?.width ?? 0));
        for (const img of sorted) {
          const src = img?.href ?? img?.url ?? img?.src ?? null;
          if (src && src.startsWith("http")) return src;
        }
        return null;
      })(),
      category,
      link: a?.links?.web?.href ?? null,
    };
  });
}
// ─────────────────────────────────────────────
// TEAM DETAIL
// ─────────────────────────────────────────────

export async function getTeam(league: string, teamId: string): Promise<ESPNTeam | null> {
  const raw = await espnGet<any>(`${ESPN_BASE}/${league}/teams/${teamId}`, 3600);
  const t = raw?.team ?? raw;
  if (!t?.displayName && !t?.name) return null;
  return {
    id: String(t?.id ?? teamId),
    name: t?.displayName ?? t?.name ?? "-",
    shortName: t?.abbreviation ?? t?.shortDisplayName ?? "",
    logo: t?.logos?.[0]?.href ?? t?.logo ?? null,
    color: t?.color ? `#${t.color}` : null,
    venue: t?.venue?.fullName ?? null,
    record: t?.record?.items?.[0]?.summary ?? null,
  };
}

// ─────────────────────────────────────────────
// ROSTER / SQUAD
// ─────────────────────────────────────────────

export async function getRoster(league: string, teamId: string): Promise<ESPNPlayer[]> {
  const raw = await espnGet<any>(`${ESPN_BASE}/${league}/teams/${teamId}/roster`, 3600);
  let list: any[] = raw?.athletes ?? [];
  // some leagues group by position: [{position, items:[...]}]
  if (list.length > 0 && list[0]?.items) {
    list = list.flatMap((g: any) => g.items ?? []);
  }
  return list.map((p: any, i: number) => ({
    id: String(p?.id ?? i),
    name: p?.displayName ?? p?.fullName ?? "-",
    jersey: p?.jersey ?? null,
    position: p?.position?.abbreviation ?? p?.position?.name ?? null,
    age: p?.age ?? null,
    nationality: p?.citizenship ?? p?.birthPlace?.country ?? null,
    headshot: p?.headshot?.href ?? null,
  }));
}

// ─────────────────────────────────────────────
// TOP SCORERS / LEADERS
// ─────────────────────────────────────────────

export async function getLeaders(league: string): Promise<ESPNLeader[]> {
  const raw = await espnGet<any>(`${ESPN_BASE}/${league}/leaders`, 3600);
  const cats: any[] = raw?.categories ?? [];

  // prefer goals category; fall back to first
  const cat = cats.find((c: any) => /goal|scor/i.test(c?.name ?? "")) ?? cats[0];
  if (!cat) return [];

  return (cat?.leaders ?? [] as any[]).map((l: any, i: number) => ({
    rank: i + 1,
    category: cat?.displayName ?? cat?.name ?? "Leaders",
    player: l?.athlete?.displayName ?? "-",
    team: l?.team?.abbreviation ?? l?.team?.displayName ?? "",
    teamLogo: l?.team?.logos?.[0]?.href ?? null,
    headshot: l?.athlete?.headshot?.href ?? null,
    value: Number(l?.value ?? 0),
    displayValue: String(l?.displayValue ?? l?.value ?? ""),
  }));
}
export type NewsItem = ESPNNews;

// ─────────────────────────────────────────────
// SCOREBOARD WITH DATE RANGE (results + fixtures)
// ESPN scoreboard accepts dates param: dates=20250601-20250630
// ─────────────────────────────────────────────

export interface ESPNFixture {
  id: string;
  status: string;
  statusState: string;   // "pre" | "in" | "post"
  kickoff: string | null;
  competition: string;
  homeTeam: ESPNTeamRef;
  awayTeam: ESPNTeamRef;
  homeScore: number | null;
  awayScore: number | null;
}

/** Fetch results (past) and fixtures (upcoming) for a league directly from ESPN. */
export async function getFixtures(league: string): Promise<{
  results: ESPNFixture[];
  upcoming: ESPNFixture[];
}> {
  // Get a 6-week window: 3 weeks back + 3 weeks ahead
  const now = new Date();
  const from = new Date(now); from.setDate(from.getDate() - 21);
  const to   = new Date(now); to.setDate(to.getDate() + 21);
  const fmt  = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const url  = `${ESPN_BASE}/${league}/scoreboard?dates=${fmt(from)}-${fmt(to)}&limit=100`;

  const raw = await espnGet<any>(url, 60);
  if (!raw) return { results: [], upcoming: [] };

  const all: ESPNFixture[] = (raw.events ?? [])
    .map((e: any) => {
      const comp = e.competitions?.[0];
      if (!comp) return null;
      const st   = comp.status?.type ?? {};
      const home = comp.competitors?.find((c: any) => c.homeAway === "home") ?? comp.competitors?.[0];
      const away = comp.competitors?.find((c: any) => c.homeAway === "away") ?? comp.competitors?.[1];
      if (!home || !away) return null;
      return {
        id: String(e.id ?? ""),
        status: st.shortDetail ?? st.detail ?? "",
        statusState: st.state ?? "pre",
        kickoff: e.date ?? null,
        competition: e.season?.type?.name ?? "",
        homeTeam: { id: String(home.team?.id ?? ""), name: home.team?.displayName ?? "-", shortName: home.team?.abbreviation ?? "", logo: home.team?.logo ?? null },
        awayTeam: { id: String(away.team?.id ?? ""), name: away.team?.displayName ?? "-", shortName: away.team?.abbreviation ?? "", logo: away.team?.logo ?? null },
        homeScore: home.score != null ? Number(home.score) : null,
        awayScore: away.score != null ? Number(away.score) : null,
      } as ESPNFixture;
    })
    .filter(Boolean) as ESPNFixture[];

  const results  = all.filter(f => f.statusState === "post").reverse(); // most recent first
  const upcoming = all.filter(f => f.statusState === "pre");            // chronological
  return { results, upcoming };
}

// ─────────────────────────────────────────────
// MATCH SUMMARY  (/summary?event=id)
// Full detail: scores, events, venue
// ─────────────────────────────────────────────

export interface ESPNMatchDetail {
  id: string;
  status: string;
  statusState: string;
  kickoff: string | null;
  competition: string;
  venue: string | null;
  attendance: number | null;
  homeTeam: ESPNTeamRef;
  awayTeam: ESPNTeamRef;
  homeScore: number | null;
  awayScore: number | null;
  events: {
    minute: number;
    type: string;
    detail: string;
    player: string | null;
    assist: string | null;
    teamId: string;
  }[];
}

export async function getMatchDetail(league: string, eventId: string): Promise<ESPNMatchDetail | null> {
  const raw = await espnGet<any>(
    `${ESPN_BASE}/${league}/summary?event=${eventId}`,
    30
  );
  if (!raw) return null;

  const header = raw.header ?? {};
  const comp   = header.competitions?.[0] ?? {};
  const st     = comp.status?.type ?? {};
  const comps  = comp.competitors ?? [];
  const home   = comps.find((c: any) => c.homeAway === "home") ?? comps[0];
  const away   = comps.find((c: any) => c.homeAway === "away") ?? comps[1];
  if (!home || !away) return null;

  // ESPN summary can put events in several places - try all of them
  const rawEvents: any[] = [
    ...(raw.keyEvents ?? []),
    ...(raw.plays ?? []),
    ...(raw.scoringPlays ?? []),
  ];

  // Also pull from boxscore drives/plays if present
  const parsedEvents = rawEvents
    .filter((e: any) => {
      const text = (e?.type?.text ?? "").toLowerCase();
      return e?.scoringPlay || e?.redCard || e?.yellowCard ||
        text.includes("goal") || text.includes("card");
    })
    .map((e: any) => {
      const typeText = (e?.type?.text ?? "").toLowerCase();
      const isGoal = e?.scoringPlay || typeText.includes("goal");
      const isCard = e?.redCard || e?.yellowCard || typeText.includes("card");
      const detail = e?.type?.text ?? (isGoal ? "Goal" : isCard ? "Card" : "");
      const cardDetail = e?.redCard ? "Red Card" : e?.yellowCard ? "Yellow Card" : detail;
      return {
        minute: (() => {
          const raw = e?.clock?.displayValue ?? e?.clock ?? "";
          const m = String(raw).match(/\d+/);
          return m ? parseInt(m[0]) : 0;
        })(),
        type: isGoal ? "goal" : "card",
        detail: isGoal ? detail : cardDetail,
        player: e?.athletesInvolved?.[0]?.displayName
          ?? e?.participants?.[0]?.athlete?.displayName
          ?? e?.athlete?.displayName
          ?? null,
        assist: e?.athletesInvolved?.[1]?.displayName
          ?? e?.participants?.[1]?.athlete?.displayName
          ?? null,
        teamId: String(e?.team?.id ?? e?.homeTeam?.id ?? ""),
      };
    })
    // dedupe by minute+type+player
    .filter((e, i, arr) =>
      arr.findIndex(x => x.minute === e.minute && x.type === e.type && x.player === e.player) === i
    );

  // Also parse from competitions[0].details (same shape CoreSportsAdapter uses - reliable)
  const compDetails: any[] = comp?.details ?? [];
  const detailEvents = compDetails.map((d: any) => {
    const typeText = (d?.type?.text ?? "").toLowerCase();
    const isGoal = d?.scoringPlay || typeText.includes("goal");
    const isCard = d?.redCard || d?.yellowCard || typeText.includes("card");
    if (!isGoal && !isCard) return null;
    const athletes = d?.athletesInvolved ?? [];
    return {
      minute: (() => {
        const raw = d?.clock?.displayValue ?? "";
        const m = String(raw).match(/\d+/);
        return m ? parseInt(m[0]) : 0;
      })(),
      type: isGoal ? "goal" : "card",
      detail: d?.redCard ? "Red Card" : d?.yellowCard ? "Yellow Card" : d?.type?.text ?? "",
      player: athletes[0]?.displayName ?? null,
      assist: athletes[1]?.displayName ?? null,
      teamId: String(d?.team?.id ?? ""),
    };
  }).filter(Boolean) as typeof parsedEvents;

  // Merge both sources, deduplicate
  const allEvents = [...parsedEvents, ...detailEvents].filter((e, i, arr) =>
    arr.findIndex(x => x.minute === e.minute && x.type === e.type && x.player === e.player) === i
  );

  const gi = raw.gameInfo ?? {};

  return {
    id: String(comp.id ?? eventId),
    status: st.shortDetail ?? st.detail ?? "",
    statusState: st.state ?? "post",
    kickoff: comp.date ?? null,
    competition: header.league?.name ?? "",
    venue: gi.venue?.fullName ?? null,
    attendance: gi.attendance ?? null,
    homeTeam: { id: String(home.id ?? ""), name: home.team?.displayName ?? "-", shortName: home.team?.abbreviation ?? "", logo: home.team?.logo ?? null },
    awayTeam: { id: String(away.id ?? ""), name: away.team?.displayName ?? "-", shortName: away.team?.abbreviation ?? "", logo: away.team?.logo ?? null },
    homeScore: home.score != null ? Number(home.score) : null,
    awayScore: away.score != null ? Number(away.score) : null,
    events: allEvents,
  };
}