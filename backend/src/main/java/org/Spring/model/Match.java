package org.Spring.model;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Unified, multi-sport match model. One schema for football, basketball and
 * cricket so the live pipeline (Event Hub -> SignalR) and consumers handle a
 * single shape.
 *
 * Football remains source-compatible: a secondary constructor preserves the
 * original 10-arg signature, so existing football adapters compile unchanged.
 *
 * Sport-specific representation:
 *   football   -> elapsed (minute), homeScore/awayScore (goals)
 *   basketball -> period (quarter), clock (game clock), homeScore/awayScore (points)
 *   cricket    -> period (innings), homeScoreDisplay "245/6", clock "48.2 ov",
 *                 homeScore/awayScore = runs (numeric, for quick compare)
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
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

    /**
     * Backward-compatible football constructor (original 10-arg signature).
     * Defaults sport to "football" and leaves the multi-sport fields null.
     */
    public Match(int id, String status, Integer elapsed, String kickoff, String competition,
                 Team homeTeam, Team awayTeam, Integer homeScore, Integer awayScore,
                 List<MatchEvent> events) {
        this(id, "football", status, elapsed, null, null, status, kickoff, competition,
                homeTeam, awayTeam, homeScore, awayScore, null, null, events);
    }
}