import Link from 'next/link';
import { Match } from '@/types/football';

interface Props {
  match: Match;
}

function StatusBadge({ match }: { match: Match }) {
  if (match.status === 'NS') {
    return (
      <span className="text-xs text-gray-500">
        {new Date(match.kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    );
  }
  if (match.status === 'HT') {
    return <span className="text-xs font-semibold text-yellow-600">HT</span>;
  }
  if (match.status === 'FT') {
    return <span className="text-xs font-semibold text-gray-500">FT</span>;
  }
  return (
    <span className="text-xs font-semibold text-green-600">{match.elapsed}'</span>
  );
}

export default function MatchCard({ match }: Props) {
  return (
    <Link href={`/football/${match.id}`}>
      <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer">
        <div className="text-xs text-gray-400 mb-3">{match.competition}</div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 text-right">
            <span className="font-semibold text-gray-900">{match.homeTeam.name}</span>
          </div>
          <div className="flex flex-col items-center min-w-[80px]">
            <div className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <span>{match.homeScore ?? '-'}</span>
              <span className="text-gray-300">:</span>
              <span>{match.awayScore ?? '-'}</span>
            </div>
            <StatusBadge match={match} />
          </div>
          <div className="flex-1 text-left">
            <span className="font-semibold text-gray-900">{match.awayTeam.name}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}