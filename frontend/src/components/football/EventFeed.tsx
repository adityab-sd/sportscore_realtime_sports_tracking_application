import { Match, MatchEvent } from '@/types/football';

interface Props {
  match: Match;
}

function EventIcon({ type, detail }: { type: MatchEvent['type']; detail: string }) {
  if (type === 'goal') return <span>⚽</span>;
  if (type === 'card' && detail === 'Yellow Card') return <span>🟨</span>;
  if (type === 'card' && detail === 'Red Card') return <span>🟥</span>;
  if (type === 'subst') return <span>🔄</span>;
  return <span>📋</span>;
}

export default function EventFeed({ match }: Props) {
  if (match.events.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">No events yet</p>;
  }

  const sorted = [...match.events].sort((a, b) => b.minute - a.minute);

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((event, index) => {
        const isHome = event.teamId === match.homeTeam.id;
        return (
          <div
            key={index}
            className={`flex items-center gap-3 text-sm ${isHome ? 'flex-row' : 'flex-row-reverse'}`}
          >
            <span className="text-xs text-gray-400 w-8 text-center">{event.minute}'</span>
            <EventIcon type={event.type} detail={event.detail} />
            <div className={`flex flex-col ${isHome ? 'text-left' : 'text-right'}`}>
              <span className="font-medium text-gray-900">{event.player}</span>
              {event.assist && (
                <span className="text-xs text-gray-400">Assist: {event.assist}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}