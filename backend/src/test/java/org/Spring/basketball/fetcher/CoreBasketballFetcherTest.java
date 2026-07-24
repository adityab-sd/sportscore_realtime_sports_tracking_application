package org.Spring.basketball.fetcher;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.Spring.basketball.adapter.CoreBasketballAdapter;
import org.Spring.model.Match;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CoreBasketballFetcherTest {

    private final CoreBasketballFetcher fetcher = new CoreBasketballFetcher(
            null, null, new ObjectMapper(), new CoreBasketballAdapter());

    @Test
    void baseUrl_pointsAtEspnBasketballEndpoint() {
        assertEquals("https://site.api.espn.com/apis/site/v2/sports/basketball", fetcher.baseUrl());
    }

    @Test
    void sportName_isBasketball() {
        assertEquals("basketball", fetcher.sportName());
    }

    @Test
    void leagues_containsExpectedSlugsAndFriendlyNames() {
        Map<String, String> leagues = fetcher.leagues();
        assertEquals("NBA", leagues.get("nba"));
        assertEquals("WNBA", leagues.get("wnba"));
        assertEquals("NCAA Men's", leagues.get("mens-college-basketball"));
        assertFalse(leagues.isEmpty());
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
    void isLive_trueForAllInPlayStatuses() {
        for (String status : List.of("LIVE", "HT", "Q1", "Q2", "Q3", "Q4", "OT")) {
            assertTrue(fetcher.isLive(matchWithStatus(status)), status + " should count as live");
        }
    }

    @Test
    void isLive_falseForFinishedScheduledAndOther() {
        assertFalse(fetcher.isLive(matchWithStatus("FT")));
        assertFalse(fetcher.isLive(matchWithStatus("FT-OT")));
        assertFalse(fetcher.isLive(matchWithStatus("Scheduled")));
        assertFalse(fetcher.isLive(matchWithStatus("Canceled")));
    }

    @Test
    void isLive_falseForNullStatus_doesNotThrow() {
        assertFalse(fetcher.isLive(matchWithStatus(null)));
    }

    private Match matchWithStatus(String status) {
        return new Match(1, "basketball", status, null, null, null, status, null,
                "Test League", null, null, null, null, null, null, List.of());
    }
}