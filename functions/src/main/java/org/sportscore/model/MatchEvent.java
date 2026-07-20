package org.sportscore.model;

import com.fasterxml.jackson.annotation.JsonProperty;

// PLEASE review — primitives hide missing data: minute/teamId as `int` default to 0 when the
// JSON field is absent, so "minute 0" is indistinguishable from "no minute". Use Integer when
// the field can be missing. EXAMPLE: @JsonProperty("minute") Integer minute
public record MatchEvent(
        @JsonProperty("minute") int minute,
        @JsonProperty("type") String type,
        @JsonProperty("detail") String detail,
        @JsonProperty("player") String player,
        @JsonProperty("assist") String assist,
        @JsonProperty("teamId") int teamId) {
}
