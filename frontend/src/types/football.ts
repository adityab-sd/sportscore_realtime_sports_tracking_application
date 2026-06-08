export type MatchStatus = 'NS' | '1H' | 'HT' | '2H' | 'FT' | 'AET' | 'PEN';

export type EventType = 'goal' | 'card' | 'subst' | 'var';

export interface Team {
  id: number;
  name: string;
  shortName: string;
  logo: string;
}

export interface MatchEvent {
  minute: number;
  type: EventType;
  detail: string;
  player: string;
  assist: string | null;
  teamId: number;
}

export interface Match {
  id: number;
  status: MatchStatus;
  elapsed: number | null;
  kickoff: string;
  competition: string;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
  events: MatchEvent[];
}