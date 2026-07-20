package org.Spring.model;

import com.fasterxml.jackson.annotation.JsonProperty;

// PLEASE review — primitive `int id` defaults to 0 for missing/non-numeric ids; also duplicated
// in org.sportscore.model.Team (keep ONE shared definition). EXAMPLE: @JsonProperty("id") String id
public record Team(
        @JsonProperty("id") int id,
        @JsonProperty("name") String name,
        @JsonProperty("shortName") String shortName,
        @JsonProperty("logo") String logo) {
}