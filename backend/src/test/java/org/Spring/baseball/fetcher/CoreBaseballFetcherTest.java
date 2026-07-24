package org.Spring.baseball.fetcher;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.Spring.baseball.adapter.CoreBaseballAdapter;
import org.Spring.model.Match;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CoreBaseballFetcherTest {

    private final CoreBaseballFetcher fetcher = new CoreBaseballFetcher(
            null, null, new ObjectMapper(), new CoreBaseballAdapter());

    @Test
    void baseUrl_pointsAtEspnBaseballEndpoint() {
        assertEquals("https://site.api.espn.com/apis/site/v2/sports/baseball", fetcher.baseUrl());
    }

    @Test
    void sportName_isBaseball() {
        assertEquals("baseball", fetcher.sportName());
    }

    @Test
    void leagues_containsAllTwelveDocumentedSlugs() {
        Map<String, String> leagues = fetcher.leagues();
        // Regression guard: this list previously only had mlb + college-baseball,
        // silently dropping live-score push for the other 10 leagues.
        assertEquals(12, leagues.size());
        assertEquals("MLB", leagues.get("mlb"));
        assertEquals("NCAA Baseball", leagues.get("college-baseball"));
        assertEquals("NCAA Softball", leagues.get("college-softball"));
        assertEquals("World Baseball Classic", leagues.get("world-baseball-classic"));
        assertEquals("Little League Baseball World Series", leagues.get("llb"));
        assertEquals("Little League Softball World Series", leagues.get("lls"));
    }

    @Test
    void leagues_hasNoDuplicateOrNullMappings() {
        fetcher.leagues().forEach((slug, name) -> {
            assertNotNull(slug);
            assertNotNull(name, "friendly name missing for slug: " + slug);
            assertFalse(slug.isBlank());
            assertFalse(name.isBlank());
        });
    }

    @Test
    void isLive_trueOnlyForExactlyLIVE() {
        assertTrue(fetcher.isLive(matchWithStatus("LIVE")));
    }

    @Test
    void isLive_falseForDelayed_evenThoughGameIsInProgress() {
        // Adapter deliberately maps mid-game rain delays to "Delayed", not "LIVE" -
        // confirming the fetcher's live-filter respects that and won't push a
        // delayed game as if it were actively playing.
        assertFalse(fetcher.isLive(matchWithStatus("Delayed")));
    }

    @Test
    void isLive_falseForFinishedScheduledForfeitAndOther() {
        assertFalse(fetcher.isLive(matchWithStatus("FT")));
        assertFalse(fetcher.isLive(matchWithStatus("Forfeit")));
        assertFalse(fetcher.isLive(matchWithStatus("Scheduled")));
        assertFalse(fetcher.isLive(matchWithStatus("Canceled")));
    }

    @Test
    void isLive_falseForNullStatus_doesNotThrow() {
        assertFalse(fetcher.isLive(matchWithStatus(null)));
    }

    private Match matchWithStatus(String status) {
        return new Match(1, "baseball", status, null, null, null, status, null,
                "Test League", null, null, null, null, null, null, List.of());
    }
}