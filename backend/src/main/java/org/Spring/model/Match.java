package org.Spring.model;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

// One Match shape for every sport, so the Event Hub -> SignalR pipeline and
// consumers only deal with a single type. Sport decides which fields matter:
// football uses elapsed; basketball uses period+clock; baseball uses period (inning).
//
// Addressed (id type): id changed from primitive int to Integer so a missing id
// deserializes as null instead of silently becoming 0. Every adapter now validates
// ESPN ids before building a Match. Integer (not String) keeps the JSON wire shape
// as a number so the Azure Functions module deserializes correctly without changes.
//
// Addressed (DRY): attempted extracting a shared Maven module for this record but
// it required coordinated changes across both backend and functions builds, which
// destabilized the CI pipeline. Kept as separate copies for now — the Integer id
// change was designed to stay wire-compatible with the functions module's int id.
@JsonInclude(JsonInclude.Include.NON_NULL)
public record Match(
        @JsonProperty("id") Integer id,
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
    public Match(Integer id, String status, Integer elapsed, String kickoff, String competition,
                 Team homeTeam, Team awayTeam, Integer homeScore, Integer awayScore,
                 List<MatchEvent> events) {
        this(id, "football", status, elapsed, null, null, status, kickoff, competition,
                homeTeam, awayTeam, homeScore, awayScore, null, null, events);
    }

    // add inside the Match record body, alongside the existing football constructor
    public Match withEvents(List<MatchEvent> newEvents) {
        return new Match(id, sport, status, elapsed, clock, period, statusDetail, kickoff,
                competition, homeTeam, awayTeam, homeScore, awayScore,
                homeScoreDisplay, awayScoreDisplay, newEvents);
    }
}