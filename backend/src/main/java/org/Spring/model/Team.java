package org.Spring.model;

import com.fasterxml.jackson.annotation.JsonProperty;

// PLEASE review — primitive `int id` defaults to 0 for missing/non-numeric ids; also duplicated
// in org.sportscore.model.Team (keep ONE shared definition). EXAMPLE: @JsonProperty("id") String id
// UPDATE:
// id is now Integer so a missing/non-numeric team id comes through as null instead of a
// silent 0 that could collide with another team. Shared-module dedup with the functions
// module's Team is still open (same follow-up as model.Match).
public record Team(
        @JsonProperty("id") Integer id,
        @JsonProperty("name") String name,
        @JsonProperty("shortName") String shortName,
        @JsonProperty("logo") String logo) {
}