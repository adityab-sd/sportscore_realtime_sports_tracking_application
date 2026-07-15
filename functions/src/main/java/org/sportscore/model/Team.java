package org.sportscore.model;

import com.fasterxml.jackson.annotation.JsonProperty;

// PLEASE review — `id` as primitive int defaults to 0 for a missing/non-numeric team id and
// blocks a null "unknown team" sentinel. Use Integer/String if ids may be absent.
// EXAMPLE: @JsonProperty("id") String id
public record Team(
        @JsonProperty("id") int id,
        @JsonProperty("name") String name,
        @JsonProperty("shortName") String shortName,
        @JsonProperty("logo") String logo) {
}
