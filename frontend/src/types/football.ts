export type MatchStatus = 'NS' | '1H' | 'HT' | '2H' | 'FT' | 'AET' | 'PEN';
export type EventType = 'goal' | 'card' | 'subst' | 'var';

export interface Team {
  id: number;
  name: string;
  shortName: string;
  logo: string;
}

export interface Player {
  id: number;
  name: string;
  number: number;
  position: 'GK' | 'DF' | 'MF' | 'FW';
}

export interface MatchEvent {
  minute: number;
  type: EventType;
  detail: string;
  player: string;
  assist: string | null;
  teamId: number;
}

export interface Lineup {
  teamId: number;
  formation: string;
  startXI: Player[];
  substitutes: Player[];
}

export interface Match {
  id: number;
  status: MatchStatus;
  elapsed: number | null;
  kickoff: string;
  league: string;
  leagueId: number;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
  events: MatchEvent[];
  lineups?: Lineup[];
}

export interface StandingRow {
  position: number;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface League {
  id: number;
  name: string;
  country: string;
  logo: string;
}