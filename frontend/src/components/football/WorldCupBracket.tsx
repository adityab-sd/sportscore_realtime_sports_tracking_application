// ────────────────────────────────────────────────────────────────────────────
// WorldCupBracket — 2026 FIFA World Cup knockout bracket.
//
// There's no live API for this: ESPN's soccer endpoints (lib/api/espn.ts)
// give us group-stage-style "fixtures" per league, not a structured knockout
// tree, and nothing in this app's backend models a bracket shape at all. So
// this is a self-contained MOCK dataset — 32 teams, all the way through to
// the Final — that renders the same way real data eventually would.
//
// To wire up real results later: replace BRACKET_MATCHES below with fetched
// data shaped like `BracketMatch[]`. Nothing else in this file needs to
// change — the rendering is driven entirely by `round` + `status` on each
// match, not by hardcoded assumptions about which matches exist.
// ────────────────────────────────────────────────────────────────────────────

import type { BracketTeam, BracketSlot, Round, BracketMatch } from "@/types/worldcup";
import { ROUND_LABELS, ROUND_ORDER } from "@/types/worldcup";

// ── Small helpers to keep the mock data below readable ─────────────────────
function team(name: string, code: string, flag: string): BracketSlot {
  return { kind: "team", team: { name, code, flag } };
}
function tbd(label: string): BracketSlot {
  return { kind: "tbd", label };
}

// ────────────────────────────────────────────────────────────────────────────
// MOCK DATA — Round of 32 through the Final.
//
// Matches this app's fictional "current date" (mid-July 2026): the real 2026
// World Cup runs June 11 – July 19, so as of "today", Round of 32 through the
// Quarterfinals have results; the Semifinals are still upcoming (kickoffs a
// day or two out); the Third Place Playoff and Final are placeholders whose
// participants literally aren't determined yet ("Winner SF1", etc.) — same
// as a real bracket would look at this point in the tournament.
// ────────────────────────────────────────────────────────────────────────────
const MOCK_BRACKET_MATCHES: BracketMatch[] = [
  // ── Round of 32 ──────────────────────────────────────────────────────────
  { id: "r32-1", round: "R32", status: "completed", date: "Jun 28", venue: "MetLife Stadium",
    home: team("Argentina", "ARG", "🇦🇷"), away: team("Saudi Arabia", "KSA", "🇸🇦"), homeScore: 2, awayScore: 0 },
  { id: "r32-2", round: "R32", status: "completed", date: "Jun 28", venue: "Estadio Azteca",
    home: team("France", "FRA", "🇫🇷"), away: team("Morocco", "MAR", "🇲🇦"), homeScore: 2, awayScore: 1 },
  { id: "r32-3", round: "R32", status: "completed", date: "Jun 28", venue: "BC Place",
    home: team("Brazil", "BRA", "🇧🇷"), away: team("South Korea", "KOR", "🇰🇷"), homeScore: 3, awayScore: 1 },
  { id: "r32-4", round: "R32", status: "completed", date: "Jun 29", venue: "AT&T Stadium",
    home: team("England", "ENG", "🏴"), away: team("Senegal", "SEN", "🇸🇳"), homeScore: 2, awayScore: 0 },
  { id: "r32-5", round: "R32", status: "completed", date: "Jun 29", venue: "SoFi Stadium",
    home: team("Spain", "ESP", "🇪🇸"), away: team("Australia", "AUS", "🇦🇺"), homeScore: 3, awayScore: 0 },
  { id: "r32-6", round: "R32", status: "completed", date: "Jun 29", venue: "Lincoln Financial Field",
    home: team("Germany", "GER", "🇩🇪"), away: team("Japan", "JPN", "🇯🇵"), homeScore: 2, awayScore: 1 },
  { id: "r32-7", round: "R32", status: "completed", date: "Jun 30", venue: "Arrowhead Stadium",
    home: team("Portugal", "POR", "🇵🇹"), away: team("Ghana", "GHA", "🇬🇭"), homeScore: 2, awayScore: 1 },
  { id: "r32-8", round: "R32", status: "completed", date: "Jun 30", venue: "Mercedes-Benz Stadium",
    home: team("Netherlands", "NED", "🇳🇱"), away: team("USA", "USA", "🇺🇸"), homeScore: 2, awayScore: 1 },
  { id: "r32-9", round: "R32", status: "completed", date: "Jun 30", venue: "Gillette Stadium",
    home: team("Belgium", "BEL", "🇧🇪"), away: team("Canada", "CAN", "🇨🇦"), homeScore: 1, awayScore: 0 },
  { id: "r32-10", round: "R32", status: "completed", date: "Jul 1", venue: "Hard Rock Stadium",
    home: team("Croatia", "CRO", "🇭🇷"), away: team("Mexico", "MEX", "🇲🇽"), homeScore: 1, awayScore: 1, penalties: { home: 4, away: 2 } },
  { id: "r32-11", round: "R32", status: "completed", date: "Jul 1", venue: "NRG Stadium",
    home: team("Italy", "ITA", "🇮🇹"), away: team("Ecuador", "ECU", "🇪🇨"), homeScore: 2, awayScore: 0 },
  { id: "r32-12", round: "R32", status: "completed", date: "Jul 1", venue: "Levi's Stadium",
    home: team("Uruguay", "URU", "🇺🇾"), away: team("Switzerland", "SUI", "🇨🇭"), homeScore: 2, awayScore: 1 },
  { id: "r32-13", round: "R32", status: "completed", date: "Jul 2", venue: "Estadio BBVA",
    home: team("Colombia", "COL", "🇨🇴"), away: team("Poland", "POL", "🇵🇱"), homeScore: 1, awayScore: 0 },
  { id: "r32-14", round: "R32", status: "completed", date: "Jul 2", venue: "Estadio Akron",
    home: team("Denmark", "DEN", "🇩🇰"), away: team("Tunisia", "TUN", "🇹🇳"), homeScore: 2, awayScore: 0 },
  { id: "r32-15", round: "R32", status: "completed", date: "Jul 2", venue: "Lumen Field",
    home: team("Nigeria", "NGA", "🇳🇬"), away: team("Egypt", "EGY", "🇪🇬"), homeScore: 1, awayScore: 0 },
  { id: "r32-16", round: "R32", status: "completed", date: "Jul 2", venue: "Rose Bowl",
    home: team("Ivory Coast", "CIV", "🇨🇮"), away: team("Qatar", "QAT", "🇶🇦"), homeScore: 3, awayScore: 0 },

  // ── Round of 16 ──────────────────────────────────────────────────────────
  { id: "r16-1", round: "R16", status: "completed", date: "Jul 4", venue: "MetLife Stadium",
    home: team("Argentina", "ARG", "🇦🇷"), away: team("France", "FRA", "🇫🇷"), homeScore: 2, awayScore: 1 },
  { id: "r16-2", round: "R16", status: "completed", date: "Jul 4", venue: "AT&T Stadium",
    home: team("Brazil", "BRA", "🇧🇷"), away: team("England", "ENG", "🏴"), homeScore: 2, awayScore: 0 },
  { id: "r16-3", round: "R16", status: "completed", date: "Jul 5", venue: "SoFi Stadium",
    home: team("Spain", "ESP", "🇪🇸"), away: team("Germany", "GER", "🇩🇪"), homeScore: 1, awayScore: 0 },
  { id: "r16-4", round: "R16", status: "completed", date: "Jul 5", venue: "Mercedes-Benz Stadium",
    home: team("Netherlands", "NED", "🇳🇱"), away: team("Portugal", "POR", "🇵🇹"), homeScore: 2, awayScore: 2, penalties: { home: 4, away: 3 } },
  { id: "r16-5", round: "R16", status: "completed", date: "Jul 6", venue: "Gillette Stadium",
    home: team("Croatia", "CRO", "🇭🇷"), away: team("Belgium", "BEL", "🇧🇪"), homeScore: 1, awayScore: 1, penalties: { home: 5, away: 4 } },
  { id: "r16-6", round: "R16", status: "completed", date: "Jul 6", venue: "NRG Stadium",
    home: team("Italy", "ITA", "🇮🇹"), away: team("Uruguay", "URU", "🇺🇾"), homeScore: 2, awayScore: 1 },
  { id: "r16-7", round: "R16", status: "completed", date: "Jul 7", venue: "Estadio BBVA",
    home: team("Colombia", "COL", "🇨🇴"), away: team("Denmark", "DEN", "🇩🇰"), homeScore: 2, awayScore: 1 },
  { id: "r16-8", round: "R16", status: "completed", date: "Jul 7", venue: "Lumen Field",
    home: team("Nigeria", "NGA", "🇳🇬"), away: team("Ivory Coast", "CIV", "🇨🇮"), homeScore: 1, awayScore: 0 },

  // ── Quarterfinals ────────────────────────────────────────────────────────
  { id: "qf-1", round: "QF", status: "completed", date: "Jul 9", venue: "MetLife Stadium",
    home: team("Argentina", "ARG", "🇦🇷"), away: team("Brazil", "BRA", "🇧🇷"), homeScore: 3, awayScore: 1 },
  { id: "qf-2", round: "QF", status: "completed", date: "Jul 9", venue: "SoFi Stadium",
    home: team("Spain", "ESP", "🇪🇸"), away: team("Netherlands", "NED", "🇳🇱"), homeScore: 2, awayScore: 0 },
  { id: "qf-3", round: "QF", status: "completed", date: "Jul 10", venue: "Gillette Stadium",
    home: team("Croatia", "CRO", "🇭🇷"), away: team("Italy", "ITA", "🇮🇹"), homeScore: 1, awayScore: 0 },
  { id: "qf-4", round: "QF", status: "completed", date: "Jul 10", venue: "Estadio BBVA",
    home: team("Colombia", "COL", "🇨🇴"), away: team("Nigeria", "NGA", "🇳🇬"), homeScore: 2, awayScore: 1 },

  // ── Semifinals — upcoming as of "today" ─────────────────────────────────
  { id: "sf-1", round: "SF", status: "upcoming", date: "Jul 14 · 3:00 PM", venue: "MetLife Stadium",
    home: team("Argentina", "ARG", "🇦🇷"), away: team("Spain", "ESP", "🇪🇸") },
  { id: "sf-2", round: "SF", status: "upcoming", date: "Jul 15 · 3:00 PM", venue: "AT&T Stadium",
    home: team("Croatia", "CRO", "🇭🇷"), away: team("Colombia", "COL", "🇨🇴") },

  // ── Third Place & Final — participants not decided yet ──────────────────
  { id: "3rd", round: "3RD", status: "upcoming", date: "Jul 18 · 3:00 PM", venue: "Hard Rock Stadium",
    home: tbd("Loser SF1"), away: tbd("Loser SF2") },
  { id: "final", round: "F", status: "upcoming", date: "Jul 19 · 3:00 PM", venue: "MetLife Stadium",
    home: tbd("Winner SF1"), away: tbd("Winner SF2") },
];

// (ROUND_ORDER now comes from @/types/worldcup)

// ────────────────────────────────────────────────────────────────────────────
// Presentation
// ────────────────────────────────────────────────────────────────────────────

function SlotRow({
  slot,
  score,
  isWinner,
}: {
  slot: BracketSlot;
  score?: number;
  isWinner: boolean;
}) {
  if (slot.kind === "tbd") {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="text-[13px] font-medium italic text-gray-400">{slot.label}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-2 ${isWinner ? "bg-blue-50" : ""}`}>
      <div className="flex min-w-0 items-center gap-2">
        {/*
          `flag` doubles as either an emoji (the built-in mock data below) or
          a real crest image URL (live backend data — ESPN gives a logo URL
          per team, not an emoji). Render whichever one it actually is rather
          than assuming, so this keeps working regardless of which data
          source is active.
        */}
        {slot.team.flag && slot.team.flag.startsWith("http") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slot.team.flag} alt="" className="h-4 w-6 shrink-0 object-contain" />
        ) : (
          <span className="shrink-0 text-base leading-none">{slot.team.flag}</span>
        )}
        <span className={`truncate text-[13px] ${isWinner ? "font-bold text-gray-900" : "font-medium text-gray-600"}`}>
          {slot.team.name}
        </span>
      </div>
      {score != null && (
        <span className={`shrink-0 text-sm ${isWinner ? "font-bold text-gray-900" : "font-medium text-gray-400"}`}>
          {score}
        </span>
      )}
    </div>
  );
}

function MatchCard({ match }: { match: BracketMatch }) {
  // ============================================================================
  // ADDRESSED: completed score validation
  // ----------------------------------------------------------------------------
  // Missing completed scores default to 0, so an incomplete backend payload can be
  // treated as a valid 0-0 draw and hide winner styling without surfacing bad data.
  // Require both scores before computing winners.
  //
  // EXAMPLE:
  //   const hasScore = match.homeScore != null && match.awayScore != null; const homeWins = hasScore && match.homeScore > match.awayScore;
  // ============================================================================
  const hasScore = match.status === "completed" && match.homeScore != null && match.awayScore != null;
  // ADDRESSED: completed score validation — require both scores before computing winners.
  const homeWins = hasScore && (match.homeScore ?? 0) > (match.awayScore ?? 0);
  const awayWins = hasScore && (match.awayScore ?? 0) > (match.homeScore ?? 0);
  // Penalty-shootout wins flip a 1-1-style scoreline into a decided winner.
  const penHome = match.penalties && match.penalties.home > match.penalties.away;
  const penAway = match.penalties && match.penalties.away > match.penalties.home;

  return (
    <div className="w-[220px] shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{match.venue}</span>
        {match.status === "upcoming" && (
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700">
            Upcoming
          </span>
        )}
      </div>

      <div className="divide-y divide-gray-100">
        <SlotRow slot={match.home} score={match.homeScore} isWinner={homeWins || Boolean(penHome)} />
        <SlotRow slot={match.away} score={match.awayScore} isWinner={awayWins || Boolean(penAway)} />
      </div>

      <div className="border-t border-gray-100 px-3 py-1.5">
        <span className="text-[10px] font-medium text-gray-400">
          {match.penalties
            ? `${match.date} · Pens ${match.penalties.home}-${match.penalties.away}`
            : match.date}
        </span>
      </div>
    </div>
  );
}

function RoundColumn({ round, matches }: { round: Round; matches: BracketMatch[] }) {
  return (
    <div className="flex w-[220px] shrink-0 flex-col">
      <div className="mb-3 text-center text-[11px] font-bold uppercase tracking-wider text-[var(--navy)]">
        {ROUND_LABELS[round]}
      </div>
      {/* justify-around is what makes each round visually "funnel" toward the
          final without hand-positioned connector lines — every column
          stretches to the SAME total height (set on the row below), so a
          round with fewer, taller-spaced matches naturally lines up between
          the pair of matches that fed into it. */}
      <div className="flex flex-1 flex-col justify-around gap-3">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} />
        ))}
      </div>
    </div>
  );
}

interface WorldCupBracketProps {
  /**
   * Real bracket data, once the backend has an endpoint for it (see
   * lib/api/espn.ts's getWorldCupBracket). Falls back to the built-in mock
   * dataset when omitted or empty, so this component keeps working on its
   * own during development.
   */
  matches?: BracketMatch[];
}

export default function WorldCupBracket({ matches }: WorldCupBracketProps) {
  const isMock = !matches || matches.length === 0;
  const source = isMock ? MOCK_BRACKET_MATCHES : matches;

  const byRound: Record<Round, BracketMatch[]> = {
    R32: [], R16: [], QF: [], SF: [], "3RD": [], F: [],
  };
  // ============================================================================
  // ADDRESSED: backend round validation
  // ----------------------------------------------------------------------------
  // Real bracket data is trusted to contain only known Round values. If the API
  // sends "R64" or a typo, byRound[m.round] is undefined and the whole bracket
  // crashes. Ignore or surface unsupported rounds explicitly.
  //
  // EXAMPLE:
  //   if (m.round in byRound) byRound[m.round as Round].push(m);
  // ============================================================================
  for (const m of source) {
    if (m.round in byRound) {
      byRound[m.round as Round].push(m);
    }
    // ADDRESSED: backend round validation — unsupported rounds are now silently skipped
    // instead of crashing the bracket.
  }

  // Tallest column sets the shared row height — every other column's height
  // gets stretched to match it (see the justify-around note on RoundColumn).
  const tallestColumn = Math.max(...ROUND_ORDER.map((r) => byRound[r].length), 1);
  const ROW_HEIGHT = tallestColumn * 92;

  return (
    <div>
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
        2026 FIFA World Cup
      </div>
      <h2 className="mb-1 text-2xl font-extrabold tracking-tight text-[var(--obsidian)]">
        Knockout Bracket
      </h2>
      <p className="mb-6 text-sm text-gray-500">
        {isMock
          ? "Mock bracket — the World Cup knockout tree isn't available via the current API, so this is placeholder data through the Quarterfinals with the Semifinals, Third Place Playoff and Final shown as upcoming."
          : "Live bracket data."}
      </p>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-6" style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }}>
          {ROUND_ORDER.filter((r) => byRound[r].length > 0).map((round) => (
            <RoundColumn key={round} round={round} matches={byRound[round]} />
          ))}
        </div>
      </div>
    </div>
  );
}