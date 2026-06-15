import Link from "next/link";
import { Match, Player } from "@/types/football";

interface Props {
  match: Match;
}

const positionOrder: Record<Player['position'], number> = { GK: 0, DF: 1, MF: 2, FW: 3 };

function PlayerRow({ player, teamId }: { player: Player; teamId: number }) {
  return (
    <Link
      href={`/football/player/${player.id}?team=${teamId}`}
      className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600 flex-shrink-0">
        {player.number}
      </span>
      <span className="text-sm text-gray-800">{player.name}</span>
      <span className="text-xs text-gray-400 ml-auto">{player.position}</span>
    </Link>
  );
}

export default function LineupDisplay({ match }: Props) {
  if (!match.lineups || match.lineups.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">Lineups not available yet</p>;
  }

  const home = match.lineups.find(l => l.teamId === match.homeTeam.id);
  const away = match.lineups.find(l => l.teamId === match.awayTeam.id);

  return (
    <div className="grid grid-cols-2 gap-4">
      {[home, away].map((lineup, idx) => {
        if (!lineup) return null;
        const team = idx === 0 ? match.homeTeam : match.awayTeam;
        const sortedXI = [...lineup.startXI].sort((a, b) => positionOrder[a.position] - positionOrder[b.position]);

        return (
          <div key={lineup.teamId}>
            <div className="flex items-center gap-2 mb-2">
              <span>{team.logo}</span>
              <span className="font-semibold text-sm text-gray-900">{team.name}</span>
            </div>
            <div className="text-xs text-gray-400 mb-2">Formation: {lineup.formation}</div>
            <div className="flex flex-col">
              {sortedXI.map(p => <PlayerRow key={p.id} player={p} teamId={team.id} />)}
            </div>
            {lineup.substitutes.length > 0 && (
              <>
                <div className="text-xs text-gray-400 mt-3 mb-1 uppercase tracking-wide font-semibold">Substitutes</div>
                <div className="flex flex-col">
                  {lineup.substitutes.map(p => <PlayerRow key={p.id} player={p} teamId={team.id} />)}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}