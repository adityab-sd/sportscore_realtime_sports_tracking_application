"use client";

import { useState } from "react";
import type { BracketSlot, Round, BracketMatch } from "@/types/worldcup";
import { ROUND_LABELS, ROUND_ORDER } from "@/types/worldcup";

// ── Helpers for Mock Data ──────────────────────────────────────────────────
function team(name: string, code: string, flag: string): BracketSlot {
  return { kind: "team", team: { name, code, flag } };
}
function tbd(label: string): BracketSlot {
  return { kind: "tbd", label };
}

// ── Fallback Mock Bracket Dataset ──────────────────────────────────────────
const MOCK_BRACKET_MATCHES: BracketMatch[] = [
  // Round of 32
  { id: "r32-1", round: "R32", status: "completed", date: "Jun 28", venue: "MetLife Stadium", home: team("Argentina", "ARG", "🇦🇷"), away: team("Saudi Arabia", "KSA", "🇸🇦"), homeScore: 2, awayScore: 0 },
  { id: "r32-2", round: "R32", status: "completed", date: "Jun 28", venue: "Estadio Azteca", home: team("France", "FRA", "🇫🇷"), away: team("Morocco", "MAR", "🇲🇦"), homeScore: 2, awayScore: 1 },
  { id: "r32-3", round: "R32", status: "completed", date: "Jun 28", venue: "BC Place", home: team("Brazil", "BRA", "🇧🇷"), away: team("South Korea", "KOR", "🇰🇷"), homeScore: 3, awayScore: 1 },
  { id: "r32-4", round: "R32", status: "completed", date: "Jun 29", venue: "AT&T Stadium", home: team("England", "ENG", "🏴"), away: team("Senegal", "SEN", "🇸🇳"), homeScore: 2, awayScore: 0 },
  { id: "r32-5", round: "R32", status: "completed", date: "Jun 29", venue: "SoFi Stadium", home: team("Spain", "ESP", "🇪🇸"), away: team("Australia", "AUS", "🇦🇺"), homeScore: 3, awayScore: 0 },
  { id: "r32-6", round: "R32", status: "completed", date: "Jun 29", venue: "Lincoln Financial Field", home: team("Germany", "GER", "🇩🇪"), away: team("Japan", "JPN", "🇯🇵"), homeScore: 2, awayScore: 1 },
  { id: "r32-7", round: "R32", status: "completed", date: "Jun 30", venue: "Arrowhead Stadium", home: team("Portugal", "POR", "🇵🇹"), away: team("Ghana", "GHA", "🇬🇭"), homeScore: 2, awayScore: 1 },
  { id: "r32-8", round: "R32", status: "completed", date: "Jun 30", venue: "Mercedes-Benz Stadium", home: team("Netherlands", "NED", "🇳🇱"), away: team("USA", "USA", "🇺🇸"), homeScore: 2, awayScore: 1 },
  { id: "r32-9", round: "R32", status: "completed", date: "Jun 30", venue: "Gillette Stadium", home: team("Belgium", "BEL", "🇧🇪"), away: team("Canada", "CAN", "🇨🇦"), homeScore: 1, awayScore: 0 },
  { id: "r32-10", round: "R32", status: "completed", date: "Jul 1", venue: "Hard Rock Stadium", home: team("Croatia", "CRO", "🇭🇷"), away: team("Mexico", "MEX", "🇲🇽"), homeScore: 1, awayScore: 1, penalties: { home: 4, away: 2 } },
  { id: "r32-11", round: "R32", status: "completed", date: "Jul 1", venue: "NRG Stadium", home: team("Italy", "ITA", "🇮🇹"), away: team("Ecuador", "ECU", "🇪🇨"), homeScore: 2, awayScore: 0 },
  { id: "r32-12", round: "R32", status: "completed", date: "Jul 1", venue: "Levi's Stadium", home: team("Uruguay", "URU", "🇺🇾"), away: team("Switzerland", "SUI", "🇨🇭"), homeScore: 2, awayScore: 1 },
  { id: "r32-13", round: "R32", status: "completed", date: "Jul 2", venue: "Estadio BBVA", home: team("Colombia", "COL", "🇨🇴"), away: team("Poland", "POL", "🇵🇱"), homeScore: 1, awayScore: 0 },
  { id: "r32-14", round: "R32", status: "completed", date: "Jul 2", venue: "Estadio Akron", home: team("Denmark", "DEN", "🇩🇰"), away: team("Tunisia", "TUN", "🇹🇳"), homeScore: 2, awayScore: 0 },
  { id: "r32-15", round: "R32", status: "completed", date: "Jul 2", venue: "Lumen Field", home: team("Nigeria", "NGA", "🇳🇬"), away: team("Egypt", "EGY", "🇪🇬"), homeScore: 1, awayScore: 0 },
  { id: "r32-16", round: "R32", status: "completed", date: "Jul 2", venue: "Rose Bowl", home: team("Ivory Coast", "CIV", "🇨🇮"), away: team("Qatar", "QAT", "🇶🇦"), homeScore: 3, awayScore: 0 },

  // Round of 16
  { id: "r16-1", round: "R16", status: "completed", date: "Jul 4", venue: "MetLife Stadium", home: team("Argentina", "ARG", "🇦🇷"), away: team("France", "FRA", "🇫🇷"), homeScore: 2, awayScore: 1 },
  { id: "r16-2", round: "R16", status: "completed", date: "Jul 4", venue: "AT&T Stadium", home: team("Brazil", "BRA", "🇧🇷"), away: team("England", "ENG", "🏴"), homeScore: 2, awayScore: 0 },
  { id: "r16-3", round: "R16", status: "completed", date: "Jul 5", venue: "SoFi Stadium", home: team("Spain", "ESP", "🇪🇸"), away: team("Germany", "GER", "🇩🇪"), homeScore: 1, awayScore: 0 },
  { id: "r16-4", round: "R16", status: "completed", date: "Jul 5", venue: "Mercedes-Benz Stadium", home: team("Netherlands", "NED", "🇳🇱"), away: team("Portugal", "POR", "🇵🇹"), homeScore: 2, awayScore: 2, penalties: { home: 4, away: 3 } },
  { id: "r16-5", round: "R16", status: "completed", date: "Jul 6", venue: "Gillette Stadium", home: team("Croatia", "CRO", "🇭🇷"), away: team("Belgium", "BEL", "🇧🇪"), homeScore: 1, awayScore: 1, penalties: { home: 5, away: 4 } },
  { id: "r16-6", round: "R16", status: "completed", date: "Jul 6", venue: "NRG Stadium", home: team("Italy", "ITA", "🇮🇹"), away: team("Uruguay", "URU", "🇺🇾"), homeScore: 2, awayScore: 1 },
  { id: "r16-7", round: "R16", status: "completed", date: "Jul 7", venue: "Estadio BBVA", home: team("Colombia", "COL", "🇨🇴"), away: team("Denmark", "DEN", "🇩🇰"), homeScore: 2, awayScore: 1 },
  { id: "r16-8", round: "R16", status: "completed", date: "Jul 7", venue: "Lumen Field", home: team("Nigeria", "NGA", "🇳🇬"), away: team("Ivory Coast", "CIV", "🇨🇮"), homeScore: 1, awayScore: 0 },

  // Quarterfinals
  { id: "qf-1", round: "QF", status: "completed", date: "Jul 9", venue: "MetLife Stadium", home: team("Argentina", "ARG", "🇦🇷"), away: team("Brazil", "BRA", "🇧🇷"), homeScore: 3, awayScore: 1 },
  { id: "qf-2", round: "QF", status: "completed", date: "Jul 9", venue: "SoFi Stadium", home: team("Spain", "ESP", "🇪🇸"), away: team("Netherlands", "NED", "🇳🇱"), homeScore: 2, awayScore: 0 },
  { id: "qf-3", round: "QF", status: "completed", date: "Jul 10", venue: "Gillette Stadium", home: team("Croatia", "CRO", "🇭🇷"), away: team("Italy", "ITA", "🇮🇹"), homeScore: 1, awayScore: 0 },
  { id: "qf-4", round: "QF", status: "completed", date: "Jul 10", venue: "Estadio BBVA", home: team("Colombia", "COL", "🇨🇴"), away: team("Nigeria", "NGA", "🇳🇬"), homeScore: 2, awayScore: 1 },

  // Semifinals
  { id: "sf-1", round: "SF", status: "upcoming", date: "Jul 14 · 3:00 PM", venue: "MetLife Stadium", home: team("Argentina", "ARG", "🇦🇷"), away: team("Spain", "ESP", "🇪🇸") },
  { id: "sf-2", round: "SF", status: "upcoming", date: "Jul 15 · 3:00 PM", venue: "AT&T Stadium", home: team("Croatia", "CRO", "🇭🇷"), away: team("Colombia", "COL", "🇨🇴") },

  // Final & 3rd Place
  { id: "3rd", round: "3RD", status: "upcoming", date: "Jul 18 · 3:00 PM", venue: "Hard Rock Stadium", home: tbd("Loser SF1"), away: tbd("Loser SF2") },
  { id: "final", round: "F", status: "upcoming", date: "Jul 19 · 3:00 PM", venue: "MetLife Stadium", home: tbd("Winner SF1"), away: tbd("Winner SF2") },
];

// ── Google-Style Slot Row Component ───────────────────────────────────────

function SlotRow({
  slot,
  score,
  isWinner,
  isHighlighted,
  onHover,
}: {
  slot: BracketSlot;
  score?: number;
  isWinner: boolean;
  isHighlighted: boolean;
  onHover: (teamName: string | null) => void;
}) {
  if (slot.kind === "tbd") {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-gray-400">
        <span className="text-[13px] font-medium italic">{slot.label}</span>
      </div>
    );
  }

  const teamName = slot.team.name;

  return (
    <div
      onMouseEnter={() => onHover(teamName)}
      onMouseLeave={() => onHover(null)}
      className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 transition-colors ${
        isHighlighted
          ? "bg-blue-100/90 ring-1 ring-inset ring-blue-500"
          : isWinner
          ? "bg-blue-50/60"
          : "hover:bg-slate-50"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {slot.team.flag && slot.team.flag.startsWith("http") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slot.team.flag} alt="" className="h-4 w-6 shrink-0 object-contain" />
        ) : (
          <span className="shrink-0 text-base leading-none">{slot.team.flag}</span>
        )}
        <span
          className={`truncate text-[13px] ${
            isHighlighted
              ? "font-bold text-blue-900"
              : isWinner
              ? "font-bold text-slate-900"
              : "font-normal text-slate-600"
          }`}
        >
          {slot.team.name}
        </span>
      </div>
      {score != null && (
        <span
          className={`shrink-0 text-sm ${
            isWinner ? "font-bold text-slate-900" : "font-medium text-slate-400"
          }`}
        >
          {score}
        </span>
      )}
    </div>
  );
}

// ── Google-Style Match Card Component ──────────────────────────────────────

function MatchCard({
  match,
  hoveredTeam,
  onHoverTeam,
}: {
  match: BracketMatch;
  hoveredTeam: string | null;
  onHoverTeam: (teamName: string | null) => void;
}) {
  const hasScore = match.status === "completed" && match.homeScore != null && match.awayScore != null;
  const homeWins = hasScore && (match.homeScore ?? 0) > (match.awayScore ?? 0);
  const awayWins = hasScore && (match.awayScore ?? 0) > (match.homeScore ?? 0);

  const penHome = match.penalties && match.penalties.home > match.penalties.away;
  const penAway = match.penalties && match.penalties.away > match.penalties.home;

  const isHomeHighlighted = match.home.kind === "team" && match.home.team.name === hoveredTeam;
  const isAwayHighlighted = match.away.kind === "team" && match.away.team.name === hoveredTeam;

  return (
    <div
      className={`w-full md:w-[220px] shrink-0 overflow-hidden rounded-xl border bg-white transition-all shadow-sm ${
        isHomeHighlighted || isAwayHighlighted
          ? "border-blue-400 shadow-md ring-2 ring-blue-100"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-3 py-1.5">
        <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400 max-w-[130px]">
          {match.venue}
        </span>
        {match.status === "upcoming" && (
          <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-600 border border-blue-100">
            Upcoming
          </span>
        )}
      </div>

      <div className="divide-y divide-slate-100">
        <SlotRow
          slot={match.home}
          score={match.homeScore}
          isWinner={homeWins || Boolean(penHome)}
          isHighlighted={isHomeHighlighted}
          onHover={onHoverTeam}
        />
        <SlotRow
          slot={match.away}
          score={match.awayScore}
          isWinner={awayWins || Boolean(penAway)}
          isHighlighted={isAwayHighlighted}
          onHover={onHoverTeam}
        />
      </div>

      <div className="border-t border-slate-100 bg-slate-50/40 px-3 py-1 text-right">
        <span className="text-[10px] font-medium text-slate-400">
          {match.penalties
            ? `${match.date} · Pens ${match.penalties.home}-${match.penalties.away}`
            : match.date}
        </span>
      </div>
    </div>
  );
}

// ── Round Column ────────────────────────────────────────────────────────────

function RoundColumn({
  round,
  matches,
  hoveredTeam,
  onHoverTeam,
}: {
  round: Round;
  matches: BracketMatch[];
  hoveredTeam: string | null;
  onHoverTeam: (teamName: string | null) => void;
}) {
  return (
    <div className="flex w-full md:w-[220px] shrink-0 flex-col">
      <div className="mb-3 hidden md:block text-center text-[11px] font-bold uppercase tracking-wider text-slate-600">
        {ROUND_LABELS[round]}
      </div>
      <div className="flex flex-1 flex-col justify-around gap-4 md:gap-3">
        {matches.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            hoveredTeam={hoveredTeam}
            onHoverTeam={onHoverTeam}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main WorldCupBracket Component ─────────────────────────────────────────

interface WorldCupBracketProps {
  matches?: BracketMatch[];
}

export default function WorldCupBracket({ matches }: WorldCupBracketProps) {
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);
  const [selectedMobileRound, setSelectedMobileRound] = useState<Round>("R32");

  const isMock = !matches || matches.length === 0;
  const source = isMock ? MOCK_BRACKET_MATCHES : matches;

  const byRound: Record<Round, BracketMatch[]> = {
    R32: [],
    R16: [],
    QF: [],
    SF: [],
    "3RD": [],
    F: [],
  };

  for (const m of source) {
    if (m.round in byRound) {
      byRound[m.round as Round].push(m);
    }
  }

  const activeRounds = ROUND_ORDER.filter((r) => byRound[r].length > 0);
  const tallestColumn = Math.max(...ROUND_ORDER.map((r) => byRound[r].length), 1);
  const ROW_HEIGHT = tallestColumn * 96;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
          2026 FIFA World Cup
        </div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900">
          Knockout Bracket
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {isMock
            ? "Showing fallback mock bracket. Live backend integration ready."
            : "Live backend bracket feed."}
        </p>
      </div>

      {/* 📱 Mobile Round Navigation Tabs (Hidden on Desktop) */}
      <div className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-2 md:hidden">
        {activeRounds.map((r) => (
          <button
            key={r}
            onClick={() => setSelectedMobileRound(r)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              selectedMobileRound === r
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {ROUND_LABELS[r]}
          </button>
        ))}
      </div>

      {/* 📱 Mobile View: Selected Round Only */}
      <div className="block md:hidden">
        <RoundColumn
          round={selectedMobileRound}
          matches={byRound[selectedMobileRound]}
          hoveredTeam={hoveredTeam}
          onHoverTeam={setHoveredTeam}
        />
      </div>

      {/* 💻 Desktop View: Full Horizontal Interactive Bracket */}
      <div className="hidden md:block overflow-x-auto pb-6">
        <div className="flex gap-6" style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }}>
          {activeRounds.map((round) => (
            <RoundColumn
              key={round}
              round={round}
              matches={byRound[round]}
              hoveredTeam={hoveredTeam}
              onHoverTeam={setHoveredTeam}
            />
          ))}
        </div>
      </div>
    </div>
  );
}