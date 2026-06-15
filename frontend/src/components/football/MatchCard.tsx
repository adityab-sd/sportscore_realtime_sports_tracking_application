import Link from 'next/link';
import { Match } from '@/types/football';

interface Props {
  match: Match;
}

const leagueIcons: Record<string, string> = {
  'Premier League': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'La Liga': '🇪🇸',
  'Serie A': '🇮🇹',
  'Bundesliga': '🇩🇪',
  'Ligue 1': '🇫🇷',
  'World Cup': '🌍',
};

function StatusBadge({ match }: { match: Match }) {
  if (match.status === 'NS') {
    const date = new Date(match.kickoff);
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    return (
      <span className="text-xs font-medium text-gray-400">
        {hours}:{minutes}
      </span>
    );
  }
  if (match.status === 'HT') {
    return <span className="text-xs font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">HT</span>;
  }
  if (match.status === 'FT') {
    return <span className="text-xs font-semibold text-gray-400">FT</span>;
  }
  return (
    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
      {match.elapsed}'
    </span>
  );
}

export default function MatchCard({ match }: Props) {
  const isLive = match.status === '1H' || match.status === '2H';

  return (
    <Link href={`/football/${match.id}`}>
      <div className="group bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-sm">{leagueIcons[match.league] || ''}</span>
          <span className="text-xs font-medium text-gray-400">{match.league}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 flex items-center gap-2 justify-end">
            <span className={`font-semibold text-gray-900 text-right ${isLive ? '' : ''}`}>
              {match.homeTeam.name}
            </span>
            <span className="text-xl flex-shrink-0">{match.homeTeam.logo}</span>
          </div>
          <div className="flex flex-col items-center min-w-[72px]">
            <div className="flex items-center gap-1.5 text-2xl font-bold text-gray-900 tabular-nums">
              <span className={match.homeScore !== null && match.awayScore !== null && match.homeScore > match.awayScore ? "text-gray-900" : "text-gray-400"}>
                {match.homeScore ?? '–'}
              </span>
              <span className="text-gray-200 text-lg">:</span>
              <span className={match.homeScore !== null && match.awayScore !== null && match.awayScore > match.homeScore ? "text-gray-900" : "text-gray-400"}>
                {match.awayScore ?? '–'}
              </span>
            </div>
            <div className="mt-1">
              <StatusBadge match={match} />
            </div>
          </div>
          <div className="flex-1 flex items-center gap-2">
            <span className="text-xl flex-shrink-0">{match.awayTeam.logo}</span>
            <span className="font-semibold text-gray-900">{match.awayTeam.name}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}