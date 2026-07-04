package org.Spring.api;

import java.util.List;

/**
 * Clean response shapes for the frontend. Field names match Vamsi's existing
 * TypeScript interfaces in espn.ts exactly, so his components need no changes.
 */
public final class Dto {
    private Dto() {}

    public record TeamRef(String id, String name, String shortName, String logo) {}

    public record MatchDto(String id, String status, String statusState, String kickoff,
                           String competition, TeamRef homeTeam, TeamRef awayTeam,
                           Integer homeScore, Integer awayScore, String round) {
        // Backward-compatible constructor without round
        public MatchDto(String id, String status, String statusState, String kickoff,
                        String competition, TeamRef homeTeam, TeamRef awayTeam,
                        Integer homeScore, Integer awayScore) {
            this(id, status, statusState, kickoff, competition, homeTeam, awayTeam,
                 homeScore, awayScore, null);
        }
    }

    public record Fixtures(List<MatchDto> results, List<MatchDto> upcoming) {}

    public record StandingRow(int rank, String teamId, String team, String shortName, String logo,
                              int played, int won, int drawn, int lost,
                              int goalsFor, int goalsAgainst, int goalDiff, int points, String note,
                              String group) {
        // Backward-compatible constructor without group (defaults to null)
        public StandingRow(int rank, String teamId, String team, String shortName, String logo,
                           int played, int won, int drawn, int lost,
                           int goalsFor, int goalsAgainst, int goalDiff, int points, String note) {
            this(rank, teamId, team, shortName, logo, played, won, drawn, lost,
                 goalsFor, goalsAgainst, goalDiff, points, note, null);
        }
    }

    public record NewsItem(String id, String headline, String description, String published,
                           String image, String category, String link) {}

    public record TeamDetail(String id, String name, String shortName, String logo,
                             String color, String venue, String record) {}

    public record Player(String id, String name, String jersey, String position,
                         Integer age, String nationality, String headshot) {}

    public record Leader(int rank, String category, String player, String team,
                         String teamLogo, String headshot, double value, String displayValue) {}

    public record MatchEventDto(int minute, String type, String detail,
                                String player, String assist, String teamId) {}

    public record LineupPlayer(String id, String name, String jersey, String position,
                               boolean starter, String teamId) {}

    public record TeamLineup(String teamId, String formation, List<LineupPlayer> starters,
                             List<LineupPlayer> bench) {}

    public record MatchDetail(String id, String status, String statusState, String kickoff,
                              String competition, String venue, Integer attendance,
                              TeamRef homeTeam, TeamRef awayTeam, Integer homeScore, Integer awayScore,
                              List<MatchEventDto> events, List<TeamLineup> lineups) {
        // Backward-compatible constructor without lineups (defaults to empty list)
        public MatchDetail(String id, String status, String statusState, String kickoff,
                           String competition, String venue, Integer attendance,
                           TeamRef homeTeam, TeamRef awayTeam, Integer homeScore, Integer awayScore,
                           List<MatchEventDto> events) {
            this(id, status, statusState, kickoff, competition, venue, attendance,
                 homeTeam, awayTeam, homeScore, awayScore, events, List.of());
        }
    }
}