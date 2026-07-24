package org.Spring.football.fetcher;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.Spring.football.adapter.CoreFootballAdapter;
import org.Spring.model.Match;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Scope note: fetchMatches/fetchAllMatches/fetchAndPublishLive live in
 * AbstractEspnFetcher and depend on EspnHttpClient + EventHubProducer (network/Event
 * Hub side effects). Those deserve their own test against AbstractEspnFetcher with
 * mocked client/producer. Here we cover the parts CoreFootballFetcher actually owns:
 * the league catalog, the URL root, sport identity, and the live/not-live rule.
 */
class CoreFootballFetcherTest {

    // client/producer are unused by the methods under test, so null is safe here.
    private final CoreFootballFetcher fetcher = new CoreFootballFetcher(
            null, null, new ObjectMapper(), new CoreFootballAdapter());

    @Test
    void baseUrl_pointsAtEspnSoccerEndpoint() {
        assertEquals("https://site.api.espn.com/apis/site/v2/sports/soccer", fetcher.baseUrl());
    }

    @Test
    void sportName_isFootball() {
        assertEquals("football", fetcher.sportName());
    }

    @Test
    void leagues_containsExpectedSlugsAndFriendlyNames() {
        Map<String, String> leagues = fetcher.leagues();
        assertEquals("Premier League", leagues.get("eng.1"));
        assertEquals("Champions League", leagues.get("uefa.champions"));
        assertEquals("World Cup 2026", leagues.get("fifa.world"));
        assertFalse(leagues.isEmpty());
    }

    @Test
    void leagues_hasNoDuplicateOrNullMappings() {
        Map<String, String> leagues = fetcher.leagues();
        leagues.forEach((slug, name) -> {
            assertNotNull(slug);
            assertNotNull(name, "friendly name missing for slug: " + slug);
            assertFalse(slug.isBlank());
            assertFalse(name.isBlank());
        });
    }

    @Test
    void isLive_trueForLiveAndHalftime() {
        assertTrue(fetcher.isLive(matchWithStatus("LIVE")));
        assertTrue(fetcher.isLive(matchWithStatus("HT")));
    }

    @Test
    void isLive_falseForFinishedScheduledAndOther() {
        assertFalse(fetcher.isLive(matchWithStatus("FT")));
        assertFalse(fetcher.isLive(matchWithStatus("Scheduled")));
        assertFalse(fetcher.isLive(matchWithStatus("Canceled")));
        assertFalse(fetcher.isLive(matchWithStatus("Postponed")));
        assertFalse(fetcher.isLive(matchWithStatus("TBD")));
    }

    @Test
    void isLive_falseForNullStatus_doesNotThrow() {
        // AbstractEspnFetcher.fetchAndPublishLive() calls isLive() on every fetched
        // match via a stream filter — an NPE here would silently kill the whole
        // live-publish pass for every sport, not just football.
        assertFalse(fetcher.isLive(matchWithStatus(null)));
    }

    private Match matchWithStatus(String status) {
        return new Match(1, status, null, null, "Test League", null, null, null, null, List.of());
    }
}