"use client";

import { useState } from "react";
import Link from "next/link";
import { leagues } from "@/lib/mock/league";
import { standings } from "@/lib/mock/standing";

export default function StandingsPage() {
  const leaguesWithStandings = leagues.filter(l => standings[l.id]);
  const [selectedLeague, setSelectedLeague] = useState(leaguesWithStandings[0].id);

  const table = standings[selectedLeague] || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Standings</h1>
            <p className="text-sm text-gray-400 mt-0.5">League tables</p>
          </div>
          <Link href="/football" className="text-sm text-emerald-600 hover:underline">
            ← Back to Football
          </Link>
        </div>

        {/* League selector */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {leaguesWithStandings.map(l => (
            <button
              key={l.id}
              onClick={() => setSelectedLeague(l.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all ${
                selectedLeague === l.id
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-100 hover:border-gray-200"
              }`}
            >
              <span>{l.logo}</span>
              {l.name}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 text-xs uppercase tracking-wide">
                <th className="text-left py-3 px-4 font-semibold">#</th>
                <th className="text-left py-3 px-2 font-semibold">Team</th>
                <th className="text-center py-3 px-2 font-semibold">P</th>
                <th className="text-center py-3 px-2 font-semibold">W</th>
                <th className="text-center py-3 px-2 font-semibold">D</th>
                <th className="text-center py-3 px-2 font-semibold">L</th>
                <th className="text-center py-3 px-2 font-semibold">GD</th>
                <th className="text-center py-3 px-4 font-semibold">Pts</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row, i) => (
                <tr
                  key={row.team.id}
                  className={`border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${
                    i < 4 ? "border-l-2 border-l-emerald-400" : ""
                  }`}
                >
                  <td className="py-3 px-4 font-semibold text-gray-500">{row.position}</td>
                  <td className="py-3 px-2">
                    <Link href={`/football/team/${row.team.id}`} className="flex items-center gap-2 hover:text-emerald-600">
                      <span>{row.team.logo}</span>
                      <span className="font-medium text-gray-900">{row.team.name}</span>
                    </Link>
                  </td>
                  <td className="text-center py-3 px-2 text-gray-600">{row.played}</td>
                  <td className="text-center py-3 px-2 text-gray-600">{row.won}</td>
                  <td className="text-center py-3 px-2 text-gray-600">{row.drawn}</td>
                  <td className="text-center py-3 px-2 text-gray-600">{row.lost}</td>
                  <td className="text-center py-3 px-2 text-gray-600 tabular-nums">
                    {row.goalsFor - row.goalsAgainst > 0 ? '+' : ''}{row.goalsFor - row.goalsAgainst}
                  </td>
                  <td className="text-center py-3 px-4 font-bold text-gray-900">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 mt-4 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Champions League qualification
        </div>
      </div>
    </div>
  );
}