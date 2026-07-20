package org.Spring.model;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

// One Match shape for every sport, so the Event Hub -> SignalR pipeline and
// consumers only deal with a single type. Sport decides which fields matter:
// football uses elapsed; basketball uses period+clock; baseball uses period (inning).
// ============================================================================
// PLEASE review — two concerns:
// 1) DRY: this record is duplicated field-for-field in the functions module
//    (org.sportscore.model.Match) and kept in sync by hand. Extract a shared module
//    so the wire contract has ONE definition (drift here silently breaks the pipeline).
// 2) `id` is a primitive int, so a payload missing "id" deserializes to 0 instead of
//    failing. Use Integer/String if ids can be absent or non-numeric.
// EXAMPLE: move this record to a `common` module both backend + functions depend on;
//          declare @JsonProperty("id") String id.
// ============================================================================
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

    // Original 10-arg football constructor, kept so football adapters compile unchanged.
    public Match(int id, String status, Integer elapsed, String kickoff, String competition,
                 Team homeTeam, Team awayTeam, Integer homeScore, Integer awayScore,
                 List<MatchEvent> events) {
        this(id, "football", status, elapsed, null, null, status, kickoff, competition,
                homeTeam, awayTeam, homeScore, awayScore, null, null, events);
    }
}