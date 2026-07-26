package org.Spring.basketball.api;

import java.util.List;

import org.Spring.api.Dto;

public final class BasketballDto {
    private BasketballDto() {}

    public record GameDto(
            String id, String status, String statusState, String tipoff, String competition,
            Dto.TeamRef homeTeam, Dto.TeamRef awayTeam, Integer homeScore, Integer awayScore,
            Integer period, String clock) {}
   // ============================================================================
    // PLEASE review — Null Object / immutability for collection record components
    // ----------------------------------------------------------------------------
    // Records do not defensively copy List components. A caller can pass a mutable
    // list into Fixtures/GameDetail and later mutate the DTO after construction; null
    // lists also force every consumer to special-case absence.
    //
    // EXAMPLE:
    //   public Fixtures {
    //       results = List.copyOf(results == null ? List.of() : results);
    //       upcoming = List.copyOf(upcoming == null ? List.of() : upcoming);
    //   }
    //
    // WHY: Null Object lists plus defensive copies make DTOs stable API values.
    // ============================================================================



    // ADDED — the fix this comment proposed was never wired in; the compact
    // constructor below now actually does it: null lists become empty lists,
    // and a caller's mutable list can no longer be mutated after construction.
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

        // ADDED — same defensive-copy fix as Fixtures above, applied to every
        // list component. Runs regardless of which constructor below is used,
        // since the secondary constructor delegates to this canonical one.
        public GameDetail {
            lineScores = List.copyOf(lineScores == null ? List.of() : lineScores);
            events     = List.copyOf(events     == null ? List.of() : events);
            officials  = List.copyOf(officials  == null ? List.of() : officials);
            odds       = List.copyOf(odds       == null ? List.of() : odds);
        }

        public GameDetail(String id, String status, String statusState, String tipoff,
                          String competition, String venue, Integer attendance,
                          Dto.TeamRef homeTeam, Dto.TeamRef awayTeam, Integer homeScore, Integer awayScore,
                          Integer period, String clock,
                          List<LineScore> lineScores, List<Dto.MatchEventDto> events) {
            this(id, status, statusState, tipoff, competition, venue, attendance,
                 homeTeam, awayTeam, homeScore, awayScore, period, clock,
                 lineScores, events, List.of(), List.of());
        }
    }
}