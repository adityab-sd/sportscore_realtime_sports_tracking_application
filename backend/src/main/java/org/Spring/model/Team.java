package org.Spring.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public record Team(
        @JsonProperty("id") int id,
        @JsonProperty("name") String name,
        @JsonProperty("shortName") String shortName,
        @JsonProperty("logo") String logo) {
}