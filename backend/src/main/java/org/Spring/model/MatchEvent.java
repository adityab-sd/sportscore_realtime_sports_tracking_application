package org.Spring.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public record MatchEvent(
        @JsonProperty("minute") int minute,
        @JsonProperty("type") String type,
        @JsonProperty("detail") String detail,
        @JsonProperty("player") String player,
        @JsonProperty("assist") String assist,
        @JsonProperty("teamId") int teamId) {
}