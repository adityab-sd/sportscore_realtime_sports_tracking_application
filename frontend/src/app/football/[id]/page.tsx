import { mockMatches } from '@/lib/mock/footballData';
import ScoreHeader from '@/components/football/ScoreHeader';
import EventFeed from '@/components/football/EventFeed';
import LineupDisplay from '@/components/football/LineupDisplay';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MatchPage({ params }: Props) {
  const { id } = await params;
  const match = mockMatches.find(m => m.id === Number(id));

  if (!match) return notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/football" className="text-sm text-gray-500 hover:text-gray-900 mb-6 inline-block">
          ← Back to Football
        </Link>
        <div className="flex flex-col gap-6">
          <ScoreHeader match={match} />

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">Match Events</h2>
            <EventFeed match={match} />
          </div>

          {match.lineups && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">Lineups</h2>
              <LineupDisplay match={match} />
            </div>
          )}

          <div className="flex gap-3">
            <Link
              href={`/football/team/${match.homeTeam.id}`}
              className="flex-1 text-center text-sm font-medium text-gray-700 border border-gray-200 rounded-lg py-2 hover:bg-gray-50 transition-colors"
            >
              {match.homeTeam.name} →
            </Link>
            <Link
              href={`/football/team/${match.awayTeam.id}`}
              className="flex-1 text-center text-sm font-medium text-gray-700 border border-gray-200 rounded-lg py-2 hover:bg-gray-50 transition-colors"
            >
              {match.awayTeam.name} →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}