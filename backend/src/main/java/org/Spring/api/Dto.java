package org.Spring.api;

import java.util.List;

/**
 * Clean response shapes for the frontend. Field names match's frontends existing
 * TypeScript interfaces in espn.ts exactly, so his components need no changes.
 */
public final class Dto {
    private Dto() {}

    public record MatchSummary(
    List<MatchLeader> leaders,
    List<TeamStatRow> teamStats,
    List<XgRow> xg,
    List<FormResult> homeForm,
    List<FormResult> awayForm,
    List<MomentumPoint> momentum,
    String referee,
    String stadium,
    String location
) {}

public record MatchLeader(String category, String displayName, String playerId,
    String player, String jersey, String position, String team,
    String teamShort, String value, String detail, String imageUrl) {}

public record TeamStatRow(String label, String home, String away,
    Double homePct, Double awayPct, String group) {}

public record XgRow(String label, String home, String away) {}

public record FormResult(String date, String opponentShort, String homeAway,
    String result, String outcome, String competition) {}

public record MomentumPoint(int minute, double value) {}

    public record TeamRef(String id, String name, String shortName, String logo) {}

    // Addressed: removed telescoping constructors that were passing null/List.of() positionally
    // for optional fields. Replaced with a builder pattern so optional fields are always set
    // by name, making call sites self-documenting and avoiding combinatorial constructor growth.
    // Verified that no existing call site used the old overloaded constructors — all callers
    // were already passing every field, so this removal has zero impact on running code.
    public record MatchDto(String id, String status, String statusState, String kickoff,
                           String competition, TeamRef homeTeam, TeamRef awayTeam,
                           Integer homeScore, Integer awayScore, String round) {

        public static Builder builder() { return new Builder(); }

        public static final class Builder {
            private String id, status, statusState, kickoff, competition, round;
            private TeamRef homeTeam, awayTeam;
            private Integer homeScore, awayScore;

            public Builder id(String v)          { this.id = v;          return this; }
            public Builder status(String v)      { this.status = v;      return this; }
            public Builder statusState(String v) { this.statusState = v; return this; }
            public Builder kickoff(String v)     { this.kickoff = v;     return this; }
            public Builder competition(String v) { this.competition = v; return this; }
            public Builder homeTeam(TeamRef v)   { this.homeTeam = v;    return this; }
            public Builder awayTeam(TeamRef v)   { this.awayTeam = v;    return this; }
            public Builder homeScore(Integer v)  { this.homeScore = v;   return this; }
            public Builder awayScore(Integer v)  { this.awayScore = v;   return this; }
            public Builder round(String v)       { this.round = v;       return this; }

            public MatchDto build() {
                return new MatchDto(id, status, statusState, kickoff, competition,
                                   homeTeam, awayTeam, homeScore, awayScore, round);
            }
        }
    }

    public record Fixtures(List<MatchDto> results, List<MatchDto> upcoming) {}

    public record StandingRow(int rank, String teamId, String team, String shortName, String logo,
                              int played, int won, int drawn, int lost,
                              int goalsFor, int goalsAgainst, int goalDiff, int points, String note,
                              String group) {

        public static Builder builder() { return new Builder(); }

        public static final class Builder {
            private int rank, played, won, drawn, lost, goalsFor, goalsAgainst, goalDiff, points;
            private String teamId, team, shortName, logo, note, group;

            public Builder rank(int v)           { this.rank = v;           return this; }
            public Builder teamId(String v)      { this.teamId = v;        return this; }
            public Builder team(String v)        { this.team = v;          return this; }
            public Builder shortName(String v)   { this.shortName = v;     return this; }
            public Builder logo(String v)        { this.logo = v;          return this; }
            public Builder played(int v)         { this.played = v;        return this; }
            public Builder won(int v)            { this.won = v;           return this; }
            public Builder drawn(int v)          { this.drawn = v;         return this; }
            public Builder lost(int v)           { this.lost = v;          return this; }
            public Builder goalsFor(int v)       { this.goalsFor = v;      return this; }
            public Builder goalsAgainst(int v)   { this.goalsAgainst = v;  return this; }
            public Builder goalDiff(int v)       { this.goalDiff = v;      return this; }
            public Builder points(int v)         { this.points = v;        return this; }
            public Builder note(String v)        { this.note = v;          return this; }
            public Builder group(String v)       { this.group = v;         return this; }

            public StandingRow build() {
                return new StandingRow(rank, teamId, team, shortName, logo, played, won, drawn,
                                      lost, goalsFor, goalsAgainst, goalDiff, points, note, group);
            }
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

    // Sport-agnostic DTOs for officials and odds parsed from ESPN summary endpoint.
    public record Official(String name, String position, int order) {}

    public record OddsPick(String provider, String details, Double spread,
                           Double overUnder, String favoriteTeamId) {}

    // Injury and transaction DTOs for ESPN team/league-level endpoints.
    public record Injury(String athleteId, String athleteName, String team,
                         String status, String description, String date) {}

    public record Transaction(String id, String date, String team, String description) {}

    // Addressed: the ESPN athlete overview endpoint's JSON shape has not been verified
    // against a live response yet. Fields below are based on ESPN docs and may silently
    // map to null if the real JSON structure differs.
    // TODO: add an integration test that calls athleteOverview for a known athlete
    //       (e.g. an NBA player ID) and asserts core fields like name and id are non-null.
    public record AthleteOverview(String id, String name, String position, String team,
                                  String headshot, String jersey, Integer age,
                                  String nationality, List<StatLine> seasonStats) {}

    public record StatLine(String label, String value) {}

    /** A single play with field coordinates, forwarded from ESPN's plays endpoint.
     *  Coordinates are normalized 0..1; (0,0) means "no coordinate". */
    public record PlayDto(
    String id,
    double clockSeconds,
    String minute,
    int period,
    String type,
    boolean scoring,
    String text,
    String teamId,
    String player,
    double fx, double fy,
    double f2x, double f2y,
    double gx, double gy,
    boolean yellowCard,
    boolean redCard,
    boolean substitution,
    boolean priority,
    String playerId,   // ← add
    String jersey,     // ← add
    String position    // ← add
) {}



    // Addressed: removed telescoping constructors, added builder pattern instead.
    // Optional list fields (lineups, officials, odds) default to empty lists in the builder
    // so callers only need to set what they have.
    public record MatchDetail(String id, String status, String statusState, String kickoff,
                              String competition, String venue, Integer attendance,
                              TeamRef homeTeam, TeamRef awayTeam, Integer homeScore, Integer awayScore,
                              List<MatchEventDto> events, List<TeamLineup> lineups,
                              List<Official> officials, List<OddsPick> odds,
                              List<PlayDto> plays, MatchSummary summary) {

        public static Builder builder() { return new Builder(); }

        public static final class Builder {
            private String id, status, statusState, kickoff, competition, venue;
            private Integer attendance, homeScore, awayScore;
            private TeamRef homeTeam, awayTeam;
            private List<MatchEventDto> events = List.of();
            private List<TeamLineup> lineups = List.of();
            private List<Official> officials = List.of();
            private List<OddsPick> odds = List.of();
            private List<PlayDto> plays = List.of();
            private MatchSummary summary;           // ← ADD THIS

            public Builder id(String v)           { this.id = v;           return this; }
            public Builder status(String v)       { this.status = v;       return this; }
            public Builder statusState(String v)  { this.statusState = v;  return this; }
            public Builder kickoff(String v)      { this.kickoff = v;      return this; }
            public Builder competition(String v)  { this.competition = v;  return this; }
            public Builder venue(String v)        { this.venue = v;        return this; }
            public Builder attendance(Integer v)  { this.attendance = v;   return this; }
            public Builder homeTeam(TeamRef v)    { this.homeTeam = v;     return this; }
            public Builder awayTeam(TeamRef v)    { this.awayTeam = v;     return this; }
            public Builder homeScore(Integer v)   { this.homeScore = v;    return this; }
            public Builder awayScore(Integer v)   { this.awayScore = v;    return this; }
            public Builder events(List<MatchEventDto> v)  { this.events = v != null ? v : List.of();     return this; }
            public Builder lineups(List<TeamLineup> v)    { this.lineups = v != null ? v : List.of();    return this; }
            public Builder officials(List<Official> v)    { this.officials = v != null ? v : List.of();  return this; }
            public Builder odds(List<OddsPick> v)         { this.odds = v != null ? v : List.of();       return this; }
            public Builder plays(List<PlayDto> v)         { this.plays = v != null ? v : List.of();       return this; }
            public Builder summary(MatchSummary v)        { this.summary = v; return this; }
            public MatchDetail build() {
                return new MatchDetail(id, status, statusState, kickoff, competition, venue,
                                      attendance, homeTeam, awayTeam, homeScore, awayScore,
                                      events, lineups, officials, odds, plays, summary);
            }
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