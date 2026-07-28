package org.Spring.f1.adapter;

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
 * Unit tests for CoreF1Adapter.
 * F1 is different from the team sports: a whole GP weekend is folded into ONE
 * Match. The adapter picks a representative session (in-progress > earliest
 * upcoming > latest completed), ranks drivers into P1 (homeTeam) and P2
 * (awayTeam), and puts their names in the score-display fields.
 */
class CoreF1AdapterTest {

    private CoreF1Adapter adapter;
    private JsonNode sampleRoot;

    @BeforeEach
    void setUp() throws Exception {
        adapter = new CoreF1Adapter();
        ObjectMapper mapper = new ObjectMapper();
        try (InputStream in = getClass().getClassLoader()
                .getResourceAsStream("f1-scoreboard-sample.json")) {
            assertThat(in).as("fixture must be on the test classpath").isNotNull();
            sampleRoot = mapper.readTree(in);
        }
    }

    @Test
    @DisplayName("skips weekends whose id is missing or non-numeric")
    void skipsBadId() throws Exception {
        List<Match> matches = adapter.toMatches(sampleRoot, "Formula 1");
        assertThat(matches).hasSize(2);
        assertThat(matches).extracting(Match::id).containsExactly(600001, 600003);
    }

    @Test
    @DisplayName("live weekend: picks in-progress race, ranks drivers into P1/P2")
    void mapsLiveRaceWeekend() throws Exception {
        Match monaco = adapter.toMatches(sampleRoot, "Formula 1").get(0);

        assertThat(monaco.sport()).isEqualTo("f1");
        assertThat(monaco.status()).isEqualTo("LIVE");
        assertThat(monaco.competition()).isEqualTo("Monaco Grand Prix");
        assertThat(monaco.statusDetail()).isEqualTo("Race - Lap 30/78");

        // Norris has order=1 so he is P1 (homeTeam); Verstappen order=2 is P2 (awayTeam).
        assertThat(monaco.homeTeam().name()).isEqualTo("Lando Norris");
        assertThat(monaco.homeTeam().id()).isEqualTo(4002);
        assertThat(monaco.awayTeam().name()).isEqualTo("Max Verstappen");
        assertThat(monaco.awayTeam().id()).isEqualTo(4001);
        assertThat(monaco.homeScoreDisplay()).isEqualTo("P1 Lando Norris");
        assertThat(monaco.awayScoreDisplay()).isEqualTo("P2 Max Verstappen");
    }

    @Test
    @DisplayName("F1 leaves numeric score / period / clock / elapsed unused")
    void unusedFieldsAreNull() throws Exception {
        Match monaco = adapter.toMatches(sampleRoot, "Formula 1").get(0);

        assertThat(monaco.homeScore()).isNull();
        assertThat(monaco.awayScore()).isNull();
        assertThat(monaco.period()).isNull();
        assertThat(monaco.clock()).isNull();
        assertThat(monaco.elapsed()).isNull();
        assertThat(monaco.events()).isEmpty();
    }

    @Test
    @DisplayName("upcoming weekend: picks the earliest upcoming session by date")
    void picksEarliestUpcomingSession() throws Exception {
        Match spain = adapter.toMatches(sampleRoot, "Formula 1").get(1);

        assertThat(spain.status()).isEqualTo("Scheduled");
        assertThat(spain.competition()).isEqualTo("Spanish Grand Prix");
        // Practice 1 (Jun 12) is earlier than Qualifying (Jun 13), so it is chosen
        // even though Qualifying appears first in the JSON.
        assertThat(spain.statusDetail()).startsWith("Practice 1");
    }
}