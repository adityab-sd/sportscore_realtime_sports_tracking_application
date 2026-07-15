package org.Spring.model;

import com.fasterxml.jackson.annotation.JsonProperty;

// PLEASE review — minute/teamId as primitive int default to 0 when absent (can't distinguish
// "minute 0" from "missing"); also duplicated in org.sportscore.model.MatchEvent. EXAMPLE: use Integer.
public record MatchEvent(
        @JsonProperty("minute") int minute,
        @JsonProperty("type") String type,
        @JsonProperty("detail") String detail,
        @JsonProperty("player") String player,
        @JsonProperty("assist") String assist,
        @JsonProperty("teamId") int teamId) {
}