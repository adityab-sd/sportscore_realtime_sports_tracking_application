package org.Spring.basketball.adapter;

import java.io.InputStream;
import java.util.List;

import org.Spring.model.Match;
import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Unit tests for CoreBasketballAdapter.
 * Feeds a canned ESPN basketball scoreboard and checks the Match objects.
 * Basketball specifics: status is period-aware (Q1-Q4, HT, OT) and a live
 * game exposes the display clock.
 */
class CoreBasketballAdapterTest {

    private CoreBasketballAdapter adapter;
    private JsonNode sampleRoot;

    @BeforeEach
    void setUp() throws Exception {
        adapter = new CoreBasketballAdapter();
        ObjectMapper mapper = new ObjectMapper();
        try (InputStream in = getClass().getClassLoader()
                .getResourceAsStream("basketball-scoreboard-sample.json")) {
            assertThat(in).as("fixture must be on the test classpath").isNotNull();
            sampleRoot = mapper.readTree(in);
        }
    }

    @Test
    @DisplayName("skips events whose id is missing or non-numeric")
    void skipsBadId() throws Exception {
        List<Match> matches = adapter.toMatches(sampleRoot, "NBA");
        assertThat(matches).hasSize(2);
        assertThat(matches).extracting(Match::id).containsExactly(40155, 40199);
    }

    @Test
    @DisplayName("maps a live game: period-aware status Q3, clock, period, scores")
    void mapsLiveGame() throws Exception {
        Match live = adapter.toMatches(sampleRoot, "NBA").get(0);

        assertThat(live.sport()).isEqualTo("basketball");
        assertThat(live.status()).isEqualTo("Q3");              // period 3 while state=in
        assertThat(live.clock()).isEqualTo("5:42");             // live clock exposed
        assertThat(live.period()).isEqualTo(3);
        assertThat(live.competition()).isEqualTo("National Basketball Association");
        assertThat(live.homeScore()).isEqualTo(68);
        assertThat(live.awayScore()).isEqualTo(72);
        assertThat(live.elapsed()).isNull();                    // football-only field
        assertThat(live.events()).isEmpty();
    }

    @Test
    @DisplayName("finished game is FT with no clock or period")
    void mapsFinishedGame() throws Exception {
        Match finished = adapter.toMatches(sampleRoot, "NBA").get(1);

        assertThat(finished.status()).isEqualTo("FT");
        assertThat(finished.clock()).isNull();                  // clock only while in play
        assertThat(finished.period()).isNull();
        assertThat(finished.homeScore()).isEqualTo(110);
    }
}