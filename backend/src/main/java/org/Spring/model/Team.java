package org.Spring.model;

import com.fasterxml.jackson.annotation.JsonProperty;

// Addressed: id changed from primitive int to Integer so missing/non-numeric team ids
// come through as null instead of a silent 0 that could collide with another team.
// Shared-module dedup with the functions module's Team was attempted but destabilized
// the build — kept as separate copies for now.
public record Team(
        @JsonProperty("id") Integer id,
        @JsonProperty("name") String name,
        @JsonProperty("shortName") String shortName,
        @JsonProperty("logo") String logo) {
}