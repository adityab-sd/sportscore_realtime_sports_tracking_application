package org.Spring.f1.api;

import java.util.List;

/**
 * F1 response shapes for the frontend. F1 is NOT team-vs-team, so these are
 * race-oriented: weekends -> sessions -> driver grids, plus driver/constructor
 * standings. NewsItem is reused from Dto.
 */
public final class F1Dto {
    private F1Dto() {}

    /** One driver's line in a session classification. */
    public record DriverResult(int position, String driverId, String driver,
                               String country, String flag, boolean winner) {}

    /** A single session within a weekend (FP1 / FP2 / FP3 / Qualifying / Race). */
    public record SessionDto(String id, String type, String label, String date,
                             String statusState, String statusDetail,
                             List<DriverResult> grid) {}

    /** A whole Grand Prix weekend with its sessions. */
    public record RaceWeekend(String id, String name, String circuit, String city, String country,
                              String startDate, String endDate, String statusState,
                              List<SessionDto> sessions) {}

    /** A calendar entry for the season schedule. */
    public record ScheduleEntry(String id, String name, String circuit, String city, String country,
                                String startDate, String endDate, String statusState) {}

    public record DriverStanding(int rank, String driverId, String driver, String flag,
                                 String team, double points, int wins) {}

    public record ConstructorStanding(int rank, String teamId, String team, String logo,
                                      double points, int wins) {}

    public record Standings(List<DriverStanding> drivers, List<ConstructorStanding> constructors) {}
}