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

    // NEW — real data ESPN already returns inside summary?event=, previously
    // fetched but never parsed. Sport-agnostic, so baseball/basketball/football
    // can all reuse these without duplicating the shape.
    public record Official(String name, String position, int order) {}

    public record OddsPick(String provider, String details, Double spread,
                           Double overUnder, String favoriteTeamId) {}

    // NEW — real endpoints (teams/{id}/injuries, league-wide injuries,
    // transactions) that exist in ESPN's docs but weren't called anywhere.
    public record Injury(String athleteId, String athleteName, String team,
                         String status, String description, String date) {}

    public record Transaction(String id, String date, String team, String description) {}

    // NEW — individual athlete profile (site.web.api.espn.com .../athletes/{id}/overview).
    // Confirmed to exist and work for MLB/NBA per ESPN docs; field paths below
    // are conservative/defensive since I haven't fetched a live sample of this
    // exact endpoint's JSON the way I verified the others tonight - treat as
    // "should work, verify on first real call" rather than fully proven.
    public record AthleteOverview(String id, String name, String position, String team,
                                  String headshot, String jersey, Integer age,
                                  String nationality, List<StatLine> seasonStats) {}

    public record StatLine(String label, String value) {}

    public record MatchDetail(String id, String status, String statusState, String kickoff,
                              String competition, String venue, Integer attendance,
                              TeamRef homeTeam, TeamRef awayTeam, Integer homeScore, Integer awayScore,
                              List<MatchEventDto> events, List<TeamLineup> lineups,
                              List<Official> officials, List<OddsPick> odds) {
        // Backward-compatible constructor without officials/odds (defaults to empty list)
        public MatchDetail(String id, String status, String statusState, String kickoff,
                           String competition, String venue, Integer attendance,
                           TeamRef homeTeam, TeamRef awayTeam, Integer homeScore, Integer awayScore,
                           List<MatchEventDto> events, List<TeamLineup> lineups) {
            this(id, status, statusState, kickoff, competition, venue, attendance,
                 homeTeam, awayTeam, homeScore, awayScore, events, lineups, List.of(), List.of());
        }
        // Backward-compatible constructor without lineups/officials/odds (defaults to empty lists)
        public MatchDetail(String id, String status, String statusState, String kickoff,
                           String competition, String venue, Integer attendance,
                           TeamRef homeTeam, TeamRef awayTeam, Integer homeScore, Integer awayScore,
                           List<MatchEventDto> events) {
            this(id, status, statusState, kickoff, competition, venue, attendance,
                 homeTeam, awayTeam, homeScore, awayScore, events, List.of(), List.of(), List.of());
        }
    }
    // ── World Cup bracket ────────────────────────────────────────────────
    // Contract lives on the frontend at src/types/worldcup.ts — field names
    // and nesting must match exactly, Jackson serializes these records as-is.

    public record BracketTeamDto(String name, String code, String flag) {}

    /** A slot is either a decided team (kind="team", team set) or a
     *  not-yet-determined placeholder (kind="tbd", label set, team null). */
    public record BracketSlotDto(String kind, BracketTeamDto team, String label) {}

    public record BracketPenalties(int home, int away) {}

    public record BracketMatchDto(String id, String round, BracketSlotDto home, BracketSlotDto away,
                                  Integer homeScore, Integer awayScore, BracketPenalties penalties,
                                  String status, String date, String venue) {}
}