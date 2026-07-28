package org.Spring.baseball.adapter;

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
 * Unit tests for CoreBaseballAdapter.
 * Feeds a canned ESPN MLB scoreboard and checks the Match objects produced.
 * Baseball specifics: inning lives in period, statusDetail carries "Top 5th".
 */
class CoreBaseballAdapterTest {

    private CoreBaseballAdapter adapter;
    private JsonNode sampleRoot;

    @BeforeEach
    void setUp() throws Exception {
        adapter = new CoreBaseballAdapter();
        ObjectMapper mapper = new ObjectMapper();
        try (InputStream in = getClass().getClassLoader()
                .getResourceAsStream("baseball-scoreboard-sample.json")) {
            assertThat(in).as("fixture must be on the test classpath").isNotNull();
            sampleRoot = mapper.readTree(in);
        }
    }

    @Test
    @DisplayName("skips events whose id is missing or non-numeric")
    void skipsBadId() throws Exception {
        List<Match> matches = adapter.toMatches(sampleRoot, "MLB");
        assertThat(matches).hasSize(2);
        assertThat(matches).extracting(Match::id).containsExactly(401581, 401999);
    }

    @Test
    @DisplayName("maps a live game: LIVE, inning in period, statusDetail, scores")
    void mapsLiveGame() throws Exception {
        Match live = adapter.toMatches(sampleRoot, "MLB").get(0);

        assertThat(live.sport()).isEqualTo("baseball");
        assertThat(live.status()).isEqualTo("LIVE");
        assertThat(live.period()).isEqualTo(5);                 // inning
        assertThat(live.statusDetail()).isEqualTo("Top 5th");
        assertThat(live.competition()).isEqualTo("Major League Baseball");
        assertThat(live.homeTeam().name()).isEqualTo("New York Yankees");
        assertThat(live.homeScore()).isEqualTo(3);
        assertThat(live.awayScore()).isEqualTo(2);
        assertThat(live.elapsed()).isNull();                    // football-only field
        assertThat(live.clock()).isNull();                      // baseball has no game clock
        assertThat(live.events()).isEmpty();
    }

    @Test
    @DisplayName("finished game is FT with no inning exposed")
    void mapsFinishedGame() throws Exception {
        Match finished = adapter.toMatches(sampleRoot, "MLB").get(1);

        assertThat(finished.status()).isEqualTo("FT");
        assertThat(finished.period()).isNull();                 // inning only exposed while LIVE
        assertThat(finished.homeScore()).isEqualTo(5);
    }
}