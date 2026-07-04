package org.sportscore.model;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Unified, multi-sport match model - mirrors org.Spring.model.Match in the
 * backend. The Event Hub payload carries football, basketball and cricket
 * matches in this single shape; the SignalR broadcast forwards it as-is.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public record Match(
        @JsonProperty("id") int id,
        @JsonProperty("sport") String sport,
        @JsonProperty("status") String status,
        @JsonProperty("elapsed") Integer elapsed,
        @JsonProperty("clock") String clock,
        @JsonProperty("period") Integer period,
        @JsonProperty("statusDetail") String statusDetail,
        @JsonProperty("kickoff") String kickoff,
        @JsonProperty("competition") String competition,
        @JsonProperty("homeTeam") Team homeTeam,
        @JsonProperty("awayTeam") Team awayTeam,
        @JsonProperty("homeScore") Integer homeScore,
        @JsonProperty("awayScore") Integer awayScore,
        @JsonProperty("homeScoreDisplay") String homeScoreDisplay,
        @JsonProperty("awayScoreDisplay") String awayScoreDisplay,
        @JsonProperty("events") List<MatchEvent> events) {
}