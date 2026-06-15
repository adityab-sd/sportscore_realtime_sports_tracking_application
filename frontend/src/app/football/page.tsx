"use client";

import { useState } from "react";
import Link from "next/link";
import { mockMatches } from '@/lib/mock/footballData';
import MatchCard from '@/components/football/MatchCard';

type FilterType = 'all' | 'live' | 'scheduled' | 'finished';

export default function FootballPage() {
  const [filter, setFilter] = useState<FilterType>('all');

  const live = mockMatches.filter(m => m.status === '1H' || m.status === '2H' || m.status === 'HT');
  const upcoming = mockMatches.filter(m => m.status === 'NS');
  const finished = mockMatches.filter(m => m.status === 'FT');

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: mockMatches.length },
    { key: 'live', label: 'Live', count: live.length },
    { key: 'scheduled', label: 'Scheduled', count: upcoming.length },
    { key: 'finished', label: 'Finished', count: finished.length },
  ];

  const showLive = filter === 'all' || filter === 'live';
  const showUpcoming = filter === 'all' || filter === 'scheduled';
  const showFinished = filter === 'all' || filter === 'finished';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Football</h1>
            <p className="text-sm text-gray-400 mt-0.5">Live scores, fixtures & results</p>
          </div>
          <Link
            href="/football/standings"
            className="text-sm text-emerald-600 hover:underline flex items-center gap-1"
          >
            📊 Standings
          </Link>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all ${
                filter === f.key
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-100 hover:border-gray-200 hover:shadow-sm"
              }`}
            >
              {f.key === 'live' && (
                <span className={`w-1.5 h-1.5 rounded-full ${filter === f.key ? "bg-green-400" : "bg-green-500"} ${f.count > 0 ? "animate-pulse" : ""}`} />
              )}
              {f.label}
              <span className={`text-xs font-semibold ${filter === f.key ? "text-gray-400" : "text-gray-300"}`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {showLive && live.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Live Now</h2>
            </div>
            <div className="flex flex-col gap-3">
              {live.map(match => <MatchCard key={match.id} match={match} />)}
            </div>
          </section>
        )}

        {showUpcoming && upcoming.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Scheduled</h2>
            <div className="flex flex-col gap-3">
              {upcoming.map(match => <MatchCard key={match.id} match={match} />)}
            </div>
          </section>
        )}

        {showFinished && finished.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Finished</h2>
            <div className="flex flex-col gap-3">
              {finished.map(match => <MatchCard key={match.id} match={match} />)}
            </div>
          </section>
        )}

        {((filter === 'live' && live.length === 0) ||
          (filter === 'scheduled' && upcoming.length === 0) ||
          (filter === 'finished' && finished.length === 0)) && (
          <div className="text-center py-16 text-gray-400 text-sm">
            <div className="text-3xl mb-2">⚽</div>
            No matches in this category
          </div>
        )}
      </div>
    </div>
  );
}