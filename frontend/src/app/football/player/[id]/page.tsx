import { mockMatches } from '@/lib/mock/footballData';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ team?: string }>;
}

export default async function PlayerPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { team: teamIdParam } = await searchParams;
  const teamId = Number(teamIdParam);

  if (!teamId) return notFound();

  // Find the team and lineup
  const matchWithLineup = mockMatches.find(m =>
    m.lineups?.some(l => l.teamId === teamId)
  );

  if (!matchWithLineup) return notFound();

  const team = matchWithLineup.homeTeam.id === teamId ? matchWithLineup.homeTeam : matchWithLineup.awayTeam;
  const lineup = matchWithLineup.lineups?.find(l => l.teamId === teamId);
  const player = [...(lineup?.startXI || []), ...(lineup?.substitutes || [])].find(p => p.id === Number(id));

  if (!player) return notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href={`/football/team/${teamId}`} className="text-sm text-gray-500 hover:text-gray-900 mb-6 inline-block">
          ← Back to {team.name}
        </Link>

        <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl font-bold mx-auto mb-4">
            {player.number}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{player.name}</h1>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <span>{team.logo}</span>
            <span>{team.name}</span>
            <span>•</span>
            <span className="font-semibold">{player.position}</span>
          </div>
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          Full player statistics will be available once connected to real data.
        </p>
      </div>
    </div>
  );
}