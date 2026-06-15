import { StandingRow } from '@/types/football';

export const standings: Record<number, StandingRow[]> = {
  39: [ // Premier League
    { position: 1, team: { id: 3, name: 'Manchester City', shortName: 'MCI', logo: '⚽' }, played: 30, won: 22, drawn: 5, lost: 3, goalsFor: 68, goalsAgainst: 28, points: 71 },
    { position: 2, team: { id: 1, name: 'Arsenal', shortName: 'ARS', logo: '⚽' }, played: 30, won: 21, drawn: 6, lost: 3, goalsFor: 64, goalsAgainst: 30, points: 69 },
    { position: 3, team: { id: 4, name: 'Liverpool', shortName: 'LIV', logo: '⚽' }, played: 30, won: 20, drawn: 7, lost: 3, goalsFor: 66, goalsAgainst: 32, points: 67 },
    { position: 4, team: { id: 7, name: 'Newcastle', shortName: 'NEW', logo: '⚽' }, played: 30, won: 17, drawn: 6, lost: 7, goalsFor: 55, goalsAgainst: 38, points: 57 },
    { position: 5, team: { id: 6, name: 'Tottenham', shortName: 'TOT', logo: '⚽' }, played: 30, won: 16, drawn: 6, lost: 8, goalsFor: 58, goalsAgainst: 44, points: 54 },
    { position: 6, team: { id: 5, name: 'Manchester United', shortName: 'MUN', logo: '⚽' }, played: 30, won: 14, drawn: 8, lost: 8, goalsFor: 48, goalsAgainst: 42, points: 50 },
    { position: 7, team: { id: 2, name: 'Chelsea', shortName: 'CHE', logo: '⚽' }, played: 30, won: 13, drawn: 8, lost: 9, goalsFor: 50, goalsAgainst: 46, points: 47 },
    { position: 8, team: { id: 8, name: 'Aston Villa', shortName: 'AVL', logo: '⚽' }, played: 30, won: 12, drawn: 9, lost: 9, goalsFor: 44, goalsAgainst: 45, points: 45 },
  ],
  140: [ // La Liga
    { position: 1, team: { id: 9, name: 'Real Madrid', shortName: 'RMA', logo: '⚽' }, played: 30, won: 23, drawn: 4, lost: 3, goalsFor: 70, goalsAgainst: 25, points: 73 },
    { position: 2, team: { id: 10, name: 'Barcelona', shortName: 'BAR', logo: '⚽' }, played: 30, won: 22, drawn: 5, lost: 3, goalsFor: 72, goalsAgainst: 28, points: 71 },
    { position: 3, team: { id: 11, name: 'Atletico Madrid', shortName: 'ATM', logo: '⚽' }, played: 30, won: 19, drawn: 7, lost: 4, goalsFor: 58, goalsAgainst: 30, points: 64 },
    { position: 4, team: { id: 13, name: 'Real Sociedad', shortName: 'RSO', logo: '⚽' }, played: 30, won: 15, drawn: 8, lost: 7, goalsFor: 45, goalsAgainst: 38, points: 53 },
    { position: 5, team: { id: 12, name: 'Sevilla', shortName: 'SEV', logo: '⚽' }, played: 30, won: 13, drawn: 9, lost: 8, goalsFor: 42, goalsAgainst: 40, points: 48 },
    { position: 6, team: { id: 14, name: 'Villarreal', shortName: 'VIL', logo: '⚽' }, played: 30, won: 12, drawn: 8, lost: 10, goalsFor: 44, goalsAgainst: 46, points: 44 },
  ],
  135: [ // Serie A
    { position: 1, team: { id: 15, name: 'Inter Milan', shortName: 'INT', logo: '⚽' }, played: 30, won: 21, drawn: 7, lost: 2, goalsFor: 60, goalsAgainst: 22, points: 70 },
    { position: 2, team: { id: 17, name: 'Juventus', shortName: 'JUV', logo: '⚽' }, played: 30, won: 19, drawn: 8, lost: 3, goalsFor: 52, goalsAgainst: 25, points: 65 },
    { position: 3, team: { id: 16, name: 'AC Milan', shortName: 'MIL', logo: '⚽' }, played: 30, won: 17, drawn: 8, lost: 5, goalsFor: 50, goalsAgainst: 30, points: 59 },
    { position: 4, team: { id: 18, name: 'Napoli', shortName: 'NAP', logo: '⚽' }, played: 30, won: 16, drawn: 7, lost: 7, goalsFor: 48, goalsAgainst: 35, points: 55 },
  ],
  78: [ // Bundesliga
    { position: 1, team: { id: 19, name: 'Bayern Munich', shortName: 'BAY', logo: '⚽' }, played: 28, won: 22, drawn: 4, lost: 2, goalsFor: 75, goalsAgainst: 24, points: 70 },
    { position: 2, team: { id: 22, name: 'Bayer Leverkusen', shortName: 'B04', logo: '⚽' }, played: 28, won: 19, drawn: 7, lost: 2, goalsFor: 62, goalsAgainst: 28, points: 64 },
    { position: 3, team: { id: 21, name: 'RB Leipzig', shortName: 'RBL', logo: '⚽' }, played: 28, won: 17, drawn: 6, lost: 5, goalsFor: 55, goalsAgainst: 32, points: 57 },
    { position: 4, team: { id: 20, name: 'Borussia Dortmund', shortName: 'BVB', logo: '⚽' }, played: 28, won: 15, drawn: 7, lost: 6, goalsFor: 50, goalsAgainst: 36, points: 52 },
  ],
  61: [ // Ligue 1
    { position: 1, team: { id: 23, name: 'Paris Saint-Germain', shortName: 'PSG', logo: '⚽' }, played: 29, won: 24, drawn: 3, lost: 2, goalsFor: 78, goalsAgainst: 20, points: 75 },
    { position: 2, team: { id: 25, name: 'Monaco', shortName: 'MON', logo: '⚽' }, played: 29, won: 18, drawn: 6, lost: 5, goalsFor: 55, goalsAgainst: 32, points: 60 },
    { position: 3, team: { id: 26, name: 'Lyon', shortName: 'OL', logo: '⚽' }, played: 29, won: 15, drawn: 8, lost: 6, goalsFor: 48, goalsAgainst: 35, points: 53 },
    { position: 4, team: { id: 24, name: 'Marseille', shortName: 'OM', logo: '⚽' }, played: 29, won: 14, drawn: 8, lost: 7, goalsFor: 45, goalsAgainst: 38, points: 50 },
  ],
};