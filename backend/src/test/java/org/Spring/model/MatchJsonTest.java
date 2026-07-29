package org.Spring.model;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * JSON round-trip tests for the shared wire model (Match / Team / MatchEvent).
 *
 * These records are the contract between this backend and Aditya's Azure
 * Functions module (Event Hub -> SignalR). If their JSON shape drifts, the live
 * pipeline breaks quietly. Serializing to JSON and reading it back — and getting
 * an equal object — proves the shape is stable. It also pins the Integer-id fix:
 * a payload with no "id" must deserialize to null, not 0.
 */
class MatchJsonTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    @DisplayName("a fully-populated Match survives a JSON round-trip unchanged")
    void fullRoundTrip() throws Exception {
        Team home = new Team(1, "Arsenal", "ARS", "home-logo");
        Team away = new Team(2, "Chelsea", "CHE", "away-logo");
        MatchEvent goal = new MatchEvent(23, "GOAL", "Goal", "Saka", null, 1);

        Match original = new Match(100, "football", "LIVE", 67, null, null, "LIVE",
                "2026-05-10T14:00Z", "Premier League", home, away, 2, 1, null, null, List.of(goal));

        String json = mapper.writeValueAsString(original);
        Match restored = mapper.readValue(json, Match.class);

        assertThat(restored).isEqualTo(original);   // records compare by value, incl. nested
    }

    @Test
    @DisplayName("a Match built via the football convenience constructor round-trips")
    void footballConvenienceRoundTrip() throws Exception {
        Team home = new Team(1, "Liverpool", "LIV", null);
        Team away = new Team(2, "Man City", "MCI", null);

        Match original = new Match(200, "FT", 90, "2026-05-09", "Premier League",
                home, away, 3, 0, List.of());

        String json = mapper.writeValueAsString(original);
        Match restored = mapper.readValue(json, Match.class);

        assertThat(restored).isEqualTo(original);
        assertThat(restored.sport()).isEqualTo("football");   // defaulted by that constructor
    }

    @Test
    @DisplayName("a payload with no id deserializes to null, not 0 (Integer, not int)")
    void missingIdBecomesNull() throws Exception {
        Match restored = mapper.readValue("{\"status\":\"LIVE\"}", Match.class);

        assertThat(restored.id()).isNull();
        assertThat(restored.status()).isEqualTo("LIVE");
    }
}