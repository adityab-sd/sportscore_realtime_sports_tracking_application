package org.Spring.model;

import com.fasterxml.jackson.annotation.JsonProperty;

// Addressed: minute and teamId changed from primitive int to Integer so missing values
// come through as null instead of a silent 0 (which was indistinguishable from a real
// kickoff-minute event). Shared-module dedup with the functions module's MatchEvent
// was attempted but destabilized the build — kept as separate copies for now.
public record MatchEvent(
        @JsonProperty("minute") Integer minute,
        @JsonProperty("type") String type,
        @JsonProperty("detail") String detail,
        @JsonProperty("player") String player,
        @JsonProperty("assist") String assist,
        @JsonProperty("teamId") Integer teamId) {
}