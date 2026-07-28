package org.Spring.f1.api;

import java.util.List;

/**
 * F1 response shapes for the frontend. F1 is NOT team-vs-team, so these are
 * race-oriented: weekends -> sessions -> driver grids, plus driver/constructor
 * standings. NewsItem is reused from Dto.
 */
public final class F1Dto {
    private F1Dto() {}

    // Addressed: added compact constructors with List.copyOf on all records that carry
    // list fields (SessionDto, RaceWeekend, Standings) so null becomes an empty list
    // and mutable lists passed by callers cannot be mutated after construction.

    /**
     * One driver's line in a session classification.
     *
     * laps / timeOrStatus / points / isRetired are only populated for completed
     * RACE and SPRINT sessions (ESPN returns an empty statistics array for
     * practice/qualifying). laps and points are boxed so they serialize as null
     * — not 0 — when absent, letting the frontend render "—" instead of a
     * misleading zero. timeOrStatus is the finish time / gap / retirement string
     * (e.g. "1:28:20.480", "+4.120", "+1 Lap", "DNF").
     */
    public record DriverResult(int position, String driverId, String driver,
                               String country, String flag, boolean winner,
                               Integer laps, String timeOrStatus, Integer points,
                               boolean isRetired) {}

    /** A single session within a weekend (FP1 / FP2 / FP3 / Qualifying / Race). */
    public record SessionDto(String id, String type, String label, String date,
                             String statusState, String statusDetail,
                             List<DriverResult> grid) {
        public SessionDto {
            grid = List.copyOf(grid == null ? List.of() : grid);
        }
    }

    /** A whole Grand Prix weekend with its sessions. */
    public record RaceWeekend(String id, String name, String circuit, String city, String country,
                              String startDate, String endDate, String statusState,
                              List<SessionDto> sessions) {
        public RaceWeekend {
            sessions = List.copyOf(sessions == null ? List.of() : sessions);
        }
    }

    /** A calendar entry for the season schedule. */
    public record ScheduleEntry(String id, String name, String circuit, String city, String country,
                                String startDate, String endDate, String statusState) {}

    public record DriverStanding(int rank, String driverId, String driver, String flag,
                                 String team, double points, int wins) {}

    public record ConstructorStanding(int rank, String teamId, String team, String logo,
                                      double points, int wins) {}

    public record Standings(List<DriverStanding> drivers, List<ConstructorStanding> constructors) {
        public Standings {
            drivers      = List.copyOf(drivers      == null ? List.of() : drivers);
            constructors = List.copyOf(constructors == null ? List.of() : constructors);
        }
    }
}