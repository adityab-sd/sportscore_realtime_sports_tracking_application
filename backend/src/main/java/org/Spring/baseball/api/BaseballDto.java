package org.Spring.baseball.api;

import java.util.List;

import org.Spring.api.Dto;

public final class BaseballDto {
    private BaseballDto() {}

    public record GameDto(
            String id, String status, String statusState, String firstPitch, String competition,
            Dto.TeamRef homeTeam, Dto.TeamRef awayTeam, Integer homeScore, Integer awayScore,
            Integer inning, String inningDetail, String homePitcher, String awayPitcher) {}

    public record Fixtures(List<GameDto> results, List<GameDto> upcoming) {}

    public record StandingRow(
            int rank, String teamId, String team, String shortName, String logo,
            int wins, int losses, double winPct, double gamesBehind, double divisionGamesBehind,
            String streak, String homeRecord, String awayRecord, String division) {}

    public record LineScore(String teamId, List<Integer> innings, int runs, int hits, int errors) {}

    // GameDetail now carries officials + odds - both were already present in the
    // summary?event= response matchDetail() fetches, just never parsed out.
    // Backward-compatible constructor for any existing caller that built a
    // GameDetail without them.
    public record GameDetail(
            String                   id,
            String                   status,
            String                   statusState,
            String                   firstPitch,
            String                   competition,
            String                   venue,
            Integer                  attendance,
            Dto.TeamRef              homeTeam,
            Dto.TeamRef              awayTeam,
            Integer                  homeScore,
            Integer                  awayScore,
            Integer                  inning,
            String                   inningDetail,
            List<LineScore>          lineScores,
            List<Dto.MatchEventDto>  events,
            List<Dto.Official>       officials,
            List<Dto.OddsPick>       odds) {

        public GameDetail(String id, String status, String statusState, String firstPitch,
                          String competition, String venue, Integer attendance,
                          Dto.TeamRef homeTeam, Dto.TeamRef awayTeam, Integer homeScore, Integer awayScore,
                          Integer inning, String inningDetail,
                          List<LineScore> lineScores, List<Dto.MatchEventDto> events) {
            this(id, status, statusState, firstPitch, competition, venue, attendance,
                 homeTeam, awayTeam, homeScore, awayScore, inning, inningDetail,
                 lineScores, events, List.of(), List.of());
        }
    }
}