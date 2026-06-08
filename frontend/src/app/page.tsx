import { mockMatches } from '@/lib/mock/footballData';
import MatchCard from '@/components/football/MatchCard';

export default function FootballPage() {
  const live = mockMatches.filter(m => m.status === '1H' || m.status === '2H' || m.status === 'HT');
  const upcoming = mockMatches.filter(m => m.status === 'NS');
  const finished = mockMatches.filter(m => m.status === 'FT');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Football</h1>

        {live.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Live</h2>
            </div>
            <div className="flex flex-col gap-3">
              {live.map(match => <MatchCard key={match.id} match={match} />)}
            </div>
          </section>
        )}

        {upcoming.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Upcoming</h2>
            <div className="flex flex-col gap-3">
              {upcoming.map(match => <MatchCard key={match.id} match={match} />)}
            </div>
          </section>
        )}

        {finished.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Finished</h2>
            <div className="flex flex-col gap-3">
              {finished.map(match => <MatchCard key={match.id} match={match} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}