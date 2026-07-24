package org.Spring.fetcher;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.Spring.api.EspnHttpClient;
import org.Spring.model.Match;
import org.Spring.producer.EventHubProducer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AbstractEspnFetcherTest {

    /**
     * Minimal concrete fetcher for exercising the shared pipeline.
     * adapt() turns each mocked scoreboard response into a single Match whose
     * id/status come straight from the JSON, so tests can control both the
     * HTTP layer (via the client mock) and the resulting Match without needing
     * a real ESPN payload shape.
     */
    static class FakeFetcher extends AbstractEspnFetcher {

        private final String base;
        private final Map<String, String> leagueMap;
        private final java.util.function.Predicate<Match> liveTest;

        FakeFetcher(EventHubProducer producer, EspnHttpClient client, ObjectMapper mapper,
                    String base, Map<String, String> leagueMap, java.util.function.Predicate<Match> liveTest) {
            super(producer, client, mapper);
            this.base = base;
            this.leagueMap = leagueMap;
            this.liveTest = liveTest;
        }

        @Override protected String baseUrl() { return base; }

        @Override protected Map<String, String> leagues() { return leagueMap; }

        @Override
        protected List<Match> adapt(JsonNode root, String leagueName) {
            if (root.path("empty").asBoolean(false)) return List.of();
            int id = root.path("id").asInt(1);
            String status = root.path("status").asText("FT");
            return List.of(new Match(id, status, null, null, leagueName, null, null, null, null, List.of()));
        }

        @Override protected boolean isLive(Match match) { return liveTest.test(match); }

        @Override public String sportName() { return "fake"; }
    }

    private EspnHttpClient client;
    private EventHubProducer producer;
    private ObjectMapper mapper;

    private JsonNode json(String s) throws Exception {
        return mapper.readTree(s);
    }

    @BeforeEach
    void setUp() {
        client = mock(EspnHttpClient.class);
        producer = mock(EventHubProducer.class); // Mockito bypasses the real constructor entirely
        mapper = new ObjectMapper();
    }

    private FakeFetcher fetcherWithLeagues(Map<String, String> leagues) {
        return new FakeFetcher(producer, client, mapper, "https://example.com/sport", leagues, m -> "LIVE".equals(m.status()));
    }

    // ---------------------------------------------------------------
    // scoreboardUrl()
    // ---------------------------------------------------------------

    @Test
    void scoreboardUrl_buildsBaseUrlSlashLeagueSlashScoreboard() {
        FakeFetcher fetcher = fetcherWithLeagues(Map.of());
        assertEquals("https://example.com/sport/eng.1/scoreboard", fetcher.scoreboardUrl("eng.1"));
    }

    // ---------------------------------------------------------------
    // fetchMatches()
    // ---------------------------------------------------------------

    @Test
    void fetchMatches_fetchesScoreboardUrl_andPassesFriendlyLeagueNameToAdapt() throws Exception {
        Map<String, String> leagues = new LinkedHashMap<>();
        leagues.put("eng.1", "Premier League");
        FakeFetcher fetcher = fetcherWithLeagues(leagues);

        when(client.get("https://example.com/sport/eng.1/scoreboard"))
                .thenReturn(json("{\"id\":7,\"status\":\"LIVE\"}"));

        List<Match> result = fetcher.fetchMatches("eng.1");

        assertEquals(1, result.size());
        assertEquals(7, result.get(0).id());
        assertEquals("Premier League", result.get(0).competition(),
                "adapt() should receive the friendly name from leagues(), not the raw slug");
    }

    @Test
    void fetchMatches_slugNotInLeaguesMap_fallsBackToSlugItselfAsFriendlyName() throws Exception {
        FakeFetcher fetcher = fetcherWithLeagues(Map.of()); // empty map - "unknown-slug" has no mapping
        when(client.get("https://example.com/sport/unknown-slug/scoreboard"))
                .thenReturn(json("{\"id\":1,\"status\":\"FT\"}"));

        List<Match> result = fetcher.fetchMatches("unknown-slug");
        assertEquals("unknown-slug", result.get(0).competition());
    }

    @Test
    void fetchMatches_emptyScoreboard_returnsEmptyList() throws Exception {
        Map<String, String> leagues = Map.of("eng.1", "Premier League");
        FakeFetcher fetcher = fetcherWithLeagues(leagues);
        when(client.get(anyString())).thenReturn(json("{\"empty\":true}"));

        assertTrue(fetcher.fetchMatches("eng.1").isEmpty());
    }

    @Test
    void fetchMatches_clientThrows_propagatesException_notCaughtAtThisLevel() throws Exception {
        FakeFetcher fetcher = fetcherWithLeagues(Map.of("eng.1", "Premier League"));
        when(client.get(anyString())).thenThrow(new java.io.IOException("network down"));

        assertThrows(java.io.IOException.class, () -> fetcher.fetchMatches("eng.1"));
    }

    // ---------------------------------------------------------------
    // fetchAllMatches()
    // ---------------------------------------------------------------

    @Test
    void fetchAllMatches_aggregatesResultsAcrossAllLeagues() throws Exception {
        Map<String, String> leagues = new LinkedHashMap<>();
        leagues.put("a", "League A");
        leagues.put("b", "League B");
        leagues.put("c", "League C");
        FakeFetcher fetcher = fetcherWithLeagues(leagues);

        when(client.get("https://example.com/sport/a/scoreboard")).thenReturn(json("{\"id\":1,\"status\":\"LIVE\"}"));
        when(client.get("https://example.com/sport/b/scoreboard")).thenReturn(json("{\"id\":2,\"status\":\"FT\"}"));
        when(client.get("https://example.com/sport/c/scoreboard")).thenReturn(json("{\"id\":3,\"status\":\"Scheduled\"}"));

        List<Match> all = fetcher.fetchAllMatches();

        assertEquals(3, all.size());
        assertTrue(all.stream().anyMatch(m -> "League A".equals(m.competition())));
        assertTrue(all.stream().anyMatch(m -> "League B".equals(m.competition())));
        assertTrue(all.stream().anyMatch(m -> "League C".equals(m.competition())));
    }

    @Test
    void fetchAllMatches_oneLeagueFails_isolatesFailure_stillReturnsOthers() throws Exception {
        Map<String, String> leagues = new LinkedHashMap<>();
        leagues.put("a", "League A");
        leagues.put("b", "League B - Flaky");
        leagues.put("c", "League C");
        FakeFetcher fetcher = fetcherWithLeagues(leagues);

        when(client.get("https://example.com/sport/a/scoreboard")).thenReturn(json("{\"id\":1,\"status\":\"LIVE\"}"));
        when(client.get("https://example.com/sport/b/scoreboard")).thenThrow(new RuntimeException("ESPN 503"));
        when(client.get("https://example.com/sport/c/scoreboard")).thenReturn(json("{\"id\":3,\"status\":\"FT\"}"));

        List<Match> all = fetcher.fetchAllMatches();

        assertEquals(2, all.size(), "one league failing must not take down the whole batch");
        assertTrue(all.stream().anyMatch(m -> "League A".equals(m.competition())));
        assertTrue(all.stream().anyMatch(m -> "League C".equals(m.competition())));
        assertFalse(all.stream().anyMatch(m -> "League B - Flaky".equals(m.competition())));
    }

    @Test
    void fetchAllMatches_everyLeagueFails_returnsEmptyList_doesNotThrow() throws Exception {
        Map<String, String> leagues = Map.of("a", "League A", "b", "League B");
        FakeFetcher fetcher = fetcherWithLeagues(leagues);
        when(client.get(anyString())).thenThrow(new RuntimeException("ESPN down"));

        List<Match> all = fetcher.fetchAllMatches();
        assertNotNull(all);
        assertTrue(all.isEmpty());
    }

    @Test
    void fetchAllMatches_noLeaguesConfigured_returnsEmptyList() {
        FakeFetcher fetcher = fetcherWithLeagues(Map.of());
        assertTrue(fetcher.fetchAllMatches().isEmpty());
    }

    // ---------------------------------------------------------------
    // fetchAndPublishLive()
    // ---------------------------------------------------------------

    @Test
    void fetchAndPublishLive_sendsOnlyLiveMatches_asOneJsonArray() throws Exception {
        Map<String, String> leagues = new LinkedHashMap<>();
        leagues.put("a", "League A");
        leagues.put("b", "League B");
        FakeFetcher fetcher = fetcherWithLeagues(leagues);

        when(client.get("https://example.com/sport/a/scoreboard")).thenReturn(json("{\"id\":1,\"status\":\"LIVE\"}"));
        when(client.get("https://example.com/sport/b/scoreboard")).thenReturn(json("{\"id\":2,\"status\":\"FT\"}"));

        fetcher.fetchAndPublishLive();

        ArgumentCaptor<String> payloadCaptor = ArgumentCaptor.forClass(String.class);
        verify(producer, times(1)).send(payloadCaptor.capture());

        JsonNode sent = mapper.readTree(payloadCaptor.getValue());
        assertTrue(sent.isArray());
        assertEquals(1, sent.size(), "only the LIVE match should be in the published payload");
        assertEquals("LIVE", sent.get(0).path("status").asText());
        assertEquals(1, sent.get(0).path("id").asInt());
    }

    @Test
    void fetchAndPublishLive_noLiveMatches_neverCallsProducerSend() throws Exception {
        Map<String, String> leagues = Map.of("a", "League A");
        FakeFetcher fetcher = fetcherWithLeagues(leagues);
        when(client.get(anyString())).thenReturn(json("{\"id\":1,\"status\":\"FT\"}"));

        fetcher.fetchAndPublishLive();

        verify(producer, never()).send(anyString());
    }

    @Test
    void fetchAndPublishLive_allLeaguesFail_neverCallsProducerSend() throws Exception {
        Map<String, String> leagues = Map.of("a", "League A");
        FakeFetcher fetcher = fetcherWithLeagues(leagues);
        when(client.get(anyString())).thenThrow(new RuntimeException("ESPN down"));

        assertDoesNotThrow(fetcher::fetchAndPublishLive);
        verify(producer, never()).send(anyString());
    }

    @Test
    void fetchAndPublishLive_multipleLiveMatchesAcrossLeagues_allIncludedInOneSend() throws Exception {
        Map<String, String> leagues = new LinkedHashMap<>();
        leagues.put("a", "League A");
        leagues.put("b", "League B");
        leagues.put("c", "League C");
        FakeFetcher fetcher = fetcherWithLeagues(leagues);

        when(client.get("https://example.com/sport/a/scoreboard")).thenReturn(json("{\"id\":1,\"status\":\"LIVE\"}"));
        when(client.get("https://example.com/sport/b/scoreboard")).thenReturn(json("{\"id\":2,\"status\":\"LIVE\"}"));
        when(client.get("https://example.com/sport/c/scoreboard")).thenReturn(json("{\"id\":3,\"status\":\"Scheduled\"}"));

        fetcher.fetchAndPublishLive();

        ArgumentCaptor<String> payloadCaptor = ArgumentCaptor.forClass(String.class);
        verify(producer, times(1)).send(payloadCaptor.capture());
        JsonNode sent = mapper.readTree(payloadCaptor.getValue());
        assertEquals(2, sent.size());
    }

    @Test
    void fetchAndPublishLive_usesFetcherOwnIsLiveDefinition_notAHardcodedOne() throws Exception {
        // isLive() is fetcher-specific (e.g. basketball treats Q1-Q4/OT as live).
        // Confirm the base class actually calls through to the override rather
        // than hardcoding "LIVE".equals(status) itself.
        Map<String, String> leagues = Map.of("a", "League A");
        FakeFetcher fetcher = new FakeFetcher(producer, client, mapper,
                "https://example.com/sport", leagues, m -> "Q3".equals(m.status()));
        when(client.get(anyString())).thenReturn(json("{\"id\":1,\"status\":\"Q3\"}"));

        fetcher.fetchAndPublishLive();

        verify(producer, times(1)).send(anyString());
    }
}