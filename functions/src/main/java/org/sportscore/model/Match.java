package org.sportscore.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record Match(
        @JsonProperty("id") int id,
        @JsonProperty("status") String status,
        @JsonProperty("elapsed") Integer elapsed,
        @JsonProperty("kickoff") String kickoff,
        @JsonProperty("competition") String competition,
        @JsonProperty("homeTeam") Team homeTeam,
        @JsonProperty("awayTeam") Team awayTeam,
        @JsonProperty("homeScore") Integer homeScore,
        @JsonProperty("awayScore") Integer awayScore,
        @JsonProperty("events") List<MatchEvent> events) {
}
