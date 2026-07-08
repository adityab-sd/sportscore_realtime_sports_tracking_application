package org.Spring.baseball.api;

import java.util.List;

import org.Spring.api.Dto;

/**
 * Baseball (MLB) response shapes. Sport-agnostic records (TeamRef, NewsItem,
 * TeamDetail, Player, Leader, MatchEventDto) are reused from Dto. Baseball-
 * specific fields are the inning, the inning detail string, pitchers, and
 * per-inning line scores. GameDetail also carries a football-style `events`
 * list (player-attributed scoring plays).
 */
public final class BaseballDto {
    private BaseballDto() {}

    public record GameDto(
            String id,
            String status,
            String statusState,
            String firstPitch,
            String competition,
            Dto.TeamRef homeTeam,
            Dto.TeamRef awayTeam,
            Integer homeScore,
            Integer awayScore,
            Integer inning,
            String  inningDetail,
            String  homePitcher,
            String  awayPitcher) {}

    public record Fixtures(List<GameDto> results, List<GameDto> upcoming) {}

    public record StandingRow(
            int    rank,
            String teamId,
            String team,
            String shortName,
            String logo,
            int    wins,
            int    losses,
            double winPct,
            double gamesBehind,
            String streak,
            String homeRecord,
            String awayRecord,
            String division) {}

    public record LineScore(String teamId, List<Integer> innings, int runs, int hits, int errors) {}

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
            List<Dto.MatchEventDto>  events) {}
}