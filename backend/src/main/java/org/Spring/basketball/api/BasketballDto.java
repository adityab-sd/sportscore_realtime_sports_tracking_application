package org.Spring.basketball.api;

import java.util.List;

import org.Spring.api.Dto;

public final class BasketballDto {
    private BasketballDto() {}

    public record GameDto(
            String id, String status, String statusState, String tipoff, String competition,
            Dto.TeamRef homeTeam, Dto.TeamRef awayTeam, Integer homeScore, Integer awayScore,
            Integer period, String clock) {}

    // Addressed: compact constructor defensively copies all list fields so null becomes
    // an empty list, and a caller's mutable list cannot be mutated after construction.
    public record Fixtures(List<GameDto> results, List<GameDto> upcoming) {
        public Fixtures {
            results  = List.copyOf(results  == null ? List.of() : results);
            upcoming = List.copyOf(upcoming == null ? List.of() : upcoming);
        }
    }

    public record StandingRow(
            int rank, String teamId, String team, String shortName, String logo,
            int wins, int losses, double winPct, double gamesBehind, double divisionGamesBehind,
            String streak, String homeRecord, String awayRecord, String conference) {}

    public record LineScore(String teamId, List<Integer> periods, int total) {}

    // Addressed: compact constructor defensively copies all list fields (lineScores,
    // events, officials, odds). Removed unused backward-compatible constructor since
    // the only call site already passes all 17 fields.
    public record GameDetail(
            String                   id,
            String                   status,
            String                   statusState,
            String                   tipoff,
            String                   competition,
            String                   venue,
            Integer                  attendance,
            Dto.TeamRef              homeTeam,
            Dto.TeamRef              awayTeam,
            Integer                  homeScore,
            Integer                  awayScore,
            Integer                  period,
            String                   clock,
            List<LineScore>          lineScores,
            List<Dto.MatchEventDto>  events,
            List<Dto.Official>       officials,
            List<Dto.OddsPick>       odds) {

        public GameDetail {
            lineScores = List.copyOf(lineScores == null ? List.of() : lineScores);
            events     = List.copyOf(events     == null ? List.of() : events);
            officials  = List.copyOf(officials  == null ? List.of() : officials);
            odds       = List.copyOf(odds       == null ? List.of() : odds);
        }
    }
}