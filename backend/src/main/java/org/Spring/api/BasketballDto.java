package org.Spring.api;

import java.util.List;

/**
 * Basketball response shapes. Sport-agnostic records (TeamRef, NewsItem,
 * TeamDetail, Player, Leader) are reused from Dto.
 */
public final class BasketballDto {
    private BasketballDto() {}

    public record GameDto(
            String id,
            String status,
            String statusState,
            String tipoff,
            String competition,
            Dto.TeamRef homeTeam,
            Dto.TeamRef awayTeam,
            Integer homeScore,
            Integer awayScore,
            Integer period,
            String  clock) {}

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
            String conference) {}

    public record LineScore(String teamId, List<Integer> periods, int total) {}

    public record GameDetail(
            String          id,
            String          status,
            String          statusState,
            String          tipoff,
            String          competition,
            String          venue,
            Integer         attendance,
            Dto.TeamRef     homeTeam,
            Dto.TeamRef     awayTeam,
            Integer         homeScore,
            Integer         awayScore,
            Integer         period,
            String          clock,
            List<LineScore> lineScores) {}
}