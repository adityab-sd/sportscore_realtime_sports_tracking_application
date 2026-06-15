import { mockMatches } from '@/lib/mock/footballData';
import { standings } from '@/lib/mock/standing';
import MatchCard from '@/components/football/MatchCard';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TeamPage({ params }: Props) {
  const { id } = await params;
  const teamId = Number(id);

  // Find team from any match
  const matchWithTeam = mockMatches.find(
    m => m.homeTeam.id === teamId || m.awayTeam.id === teamId
  );

  if (!matchWithTeam) return notFound();

  const team = matchWithTeam.homeTeam.id === teamId ? matchWithTeam.homeTeam : matchWithTeam.awayTeam;

  // Find team's matches
  const teamMatches = mockMatches.filter(
    m => m.homeTeam.id === teamId || m.awayTeam.id === teamId
  );

  // Find team's standing
  let standingRow = null;
  let leagueId = null;
  for (const [lId, table] of Object.entries(standings)) {
    const row = table.find(r => r.team.id === teamId);
    if (row) {
      standingRow = row;
      leagueId = Number(lId);
      break;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/football" className="text-sm text-gray-500 hover:text-gray-900 mb-6 inline-block">
          ← Back to Football
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <span className="text-4xl">{team.logo}</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
            <p className="text-sm text-gray-400">{matchWithTeam.league}</p>
          </div>
        </div>

        {standingRow && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-400 uppercase mb-1">Position</div>
              <div className="text-xl font-bold text-gray-900">{standingRow.position}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase mb-1">Points</div>
              <div className="text-xl font-bold text-gray-900">{standingRow.points}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase mb-1">Played</div>
              <div className="text-xl font-bold text-gray-900">{standingRow.played}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase mb-1">GD</div>
              <div className="text-xl font-bold text-gray-900">
                {standingRow.goalsFor - standingRow.goalsAgainst > 0 ? '+' : ''}
                {standingRow.goalsFor - standingRow.goalsAgainst}
              </div>
            </div>
          </div>
        )}

        {leagueId && (
          <Link
            href="/football/standings"
            className="text-sm text-emerald-600 hover:underline mb-6 inline-block"
          >
            View full {matchWithTeam.league} table →
          </Link>
        )}

        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 mt-2">Matches</h2>
        <div className="flex flex-col gap-3">
          {teamMatches.map(match => <MatchCard key={match.id} match={match} />)}
        </div>
      </div>
    </div>
  );
}