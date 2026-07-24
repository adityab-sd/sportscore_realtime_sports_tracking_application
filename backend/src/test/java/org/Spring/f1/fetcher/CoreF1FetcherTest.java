package org.Spring.f1.fetcher;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.Spring.f1.adapter.CoreF1Adapter;
import org.Spring.model.Match;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CoreF1FetcherTest {

    private final CoreF1Fetcher fetcher = new CoreF1Fetcher(
            null, null, new ObjectMapper(), new CoreF1Adapter());

    @Test
    void baseUrl_pointsAtEspnF1RacingEndpoint() {
        assertEquals("https://site.api.espn.com/apis/site/v2/sports/racing/f1", fetcher.baseUrl());
    }

    @Test
    void sportName_isF1() {
        assertEquals("f1", fetcher.sportName());
    }

    @Test
    void leagues_containsOnlyF1() {
        Map<String, String> leagues = fetcher.leagues();
        assertEquals(1, leagues.size());
        assertEquals("Formula 1", leagues.get("f1"));
    }

    @Test
    void scoreboardUrl_ignoresLeagueArgument_alwaysHitsSingleEndpoint() {
        // Unlike the team sports, F1 is a single championship with one scoreboard -
        // the override must ignore whatever league string is passed in.
        String expected = "https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard";
        assertEquals(expected, fetcher.scoreboardUrl("f1"));
        assertEquals(expected, fetcher.scoreboardUrl("anything-else"));
        assertEquals(expected, fetcher.scoreboardUrl(null),
                "override must not depend on the league argument at all, including null");
    }

    @Test
    void isLive_trueOnlyForExactlyLIVE() {
        assertTrue(fetcher.isLive(matchWithStatus("LIVE")));
    }

    @Test
    void isLive_falseForFinishedScheduledAndOther() {
        assertFalse(fetcher.isLive(matchWithStatus("FT")));
        assertFalse(fetcher.isLive(matchWithStatus("Scheduled")));
        assertFalse(fetcher.isLive(matchWithStatus("Canceled")));
        assertFalse(fetcher.isLive(matchWithStatus("Postponed")));
    }

    @Test
    void isLive_falseForNullStatus_doesNotThrow() {
        assertFalse(fetcher.isLive(matchWithStatus(null)));
    }

    private Match matchWithStatus(String status) {
        return new Match(1, "f1", status, null, null, null, status, null,
                "Formula 1", null, null, null, null, null, null, List.of());
    }
}