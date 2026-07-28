package org.Spring.football.adapter;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.InputStream;
import java.util.List;

import org.Spring.model.Match;
import org.Spring.model.MatchEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Unit tests for CoreFootballAdapter.
 *
 * Pure logic: we feed it a canned ESPN scoreboard JSON (loaded from
 * src/test/resources/football-scoreboard-sample.json) and assert the Match
 * objects it produces. No network, no Spring — this runs in milliseconds.
 */
class CoreFootballAdapterTest {

    private CoreFootballAdapter adapter;
    private JsonNode sampleRoot;

    @BeforeEach
    void setUp() throws Exception {
        adapter = new CoreFootballAdapter();

        ObjectMapper mapper = new ObjectMapper();
        try (InputStream in = getClass().getClassLoader()
                .getResourceAsStream("football-scoreboard-sample.json")) {
            assertThat(in).as("fixture file must be on the test classpath").isNotNull();
            sampleRoot = mapper.readTree(in);
        }
    }

    @Test
    @DisplayName("skips events whose id is missing or non-numeric")
    void skipsBadId() throws Exception {
        List<Match> matches = adapter.toMatches(sampleRoot, "Premier League");

        // The fixture has 3 events; the third has id "not-a-number" and must be dropped.
        assertThat(matches).hasSize(2);
        assertThat(matches).extracting(Match::id).containsExactly(401773123, 401773999);
    }

    @Test
    @DisplayName("maps a live match: status, elapsed minute, teams, scores")
    void mapsLiveMatch() throws Exception {
        Match live = adapter.toMatches(sampleRoot, "Premier League").get(0);

        assertThat(live.status()).isEqualTo("LIVE");
        assertThat(live.elapsed()).isEqualTo(67);              // parsed from displayClock "67'"
        assertThat(live.competition()).isEqualTo("English Premier League");
        assertThat(live.homeTeam().name()).isEqualTo("Arsenal");
        assertThat(live.awayTeam().name()).isEqualTo("Chelsea");
        assertThat(live.homeScore()).isEqualTo(2);
        assertThat(live.awayScore()).isEqualTo(1);
    }

    @Test
    @DisplayName("maps a goal detail into a GOAL MatchEvent")
    void mapsGoalEvent() throws Exception {
        Match live = adapter.toMatches(sampleRoot, "Premier League").get(0);

        assertThat(live.events()).hasSize(1);
        MatchEvent goal = live.events().get(0);
        assertThat(goal.type()).isEqualTo("GOAL");             // scoringPlay:true -> GOAL
        assertThat(goal.minute()).isEqualTo(23);               // from clock.displayValue "23'"
        assertThat(goal.player()).isEqualTo("Bukayo Saka");
        assertThat(goal.teamId()).isEqualTo(359);
    }

    @Test
    @DisplayName("maps a finished match to FT with no elapsed minute")
    void mapsFinishedMatch() throws Exception {
        Match finished = adapter.toMatches(sampleRoot, "Premier League").get(1);

        assertThat(finished.status()).isEqualTo("FT");         // state "post" -> FT
        assertThat(finished.elapsed()).isNull();               // no live minute for finished games
        assertThat(finished.awayScore()).isEqualTo(3);
    }
}