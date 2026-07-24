package org.Spring.model;

import com.fasterxml.jackson.annotation.JsonProperty;

// PLEASE review — minute/teamId as primitive int default to 0 when absent (can't distinguish
// "minute 0" from "missing"); also duplicated in org.sportscore.model.MatchEvent. EXAMPLE: use Integer.
// UPDATE:
// minute/teamId are now Integer, so a missing value comes through as null instead of a
// silent 0 (which was indistinguishable from an actual kickoff-minute event). Shared-module
// dedup with the functions module's MatchEvent is still open (same follow-up as model.Match).
public record MatchEvent(
        @JsonProperty("minute") Integer minute,
        @JsonProperty("type") String type,
        @JsonProperty("detail") String detail,
        @JsonProperty("player") String player,
        @JsonProperty("assist") String assist,
        @JsonProperty("teamId") Integer teamId) {
}