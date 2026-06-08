import { Match } from '@/types/football';

interface Props {
  match: Match;
}

function StatusLabel({ match }: { match: Match }) {
  if (match.status === 'NS') return <span className="text-sm text-gray-500">Not Started</span>;
  if (match.status === 'HT') return <span className="text-sm font-semibold text-yellow-600">Half Time</span>;
  if (match.status === 'FT') return <span className="text-sm font-semibold text-gray-500">Full Time</span>;
  return <span className="text-sm font-semibold text-green-600 animate-pulse">{match.elapsed}' Live</span>;
}

export default function ScoreHeader({ match }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
      <div className="text-xs text-gray-400 mb-4">{match.competition}</div>
      <div className="flex items-center justify-between gap-6">
        <div className="flex-1">
          <div className="text-4xl mb-2">⚽</div>
          <div className="font-bold text-lg text-gray-900">{match.homeTeam.name}</div>
          <div className="text-xs text-gray-400">{match.homeTeam.shortName}</div>
        </div>
        <div className="flex flex-col items-center">
          <div className="text-5xl font-bold text-gray-900 mb-2">
            {match.homeScore ?? '-'} : {match.awayScore ?? '-'}
          </div>
          <StatusLabel match={match} />
        </div>
        <div className="flex-1">
          <div className="text-4xl mb-2">⚽</div>
          <div className="font-bold text-lg text-gray-900">{match.awayTeam.name}</div>
          <div className="text-xs text-gray-400">{match.awayTeam.shortName}</div>
        </div>
      </div>
    </div>
  );
}