package org.Spring.fetcher;

import java.net.http.HttpClient;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.Spring.api.EspnHttpClient;
import org.Spring.model.Match;
import org.Spring.model.MatchEvent;
import org.Spring.producer.EventHubProducer;
import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Unit tests for AbstractEspnFetcher, the live-pipeline core.
 *
 * No Mockito here on purpose: EventHubProducer and EspnHttpClient are plain
 * classes, so we extend them with tiny hand-written fakes (FakeProducer records
 * what was "sent"; FakeHttpClient returns an empty node). That keeps the test
 * off any bytecode-mocking library, so it runs on any JDK.
 *
 * TestFetcher lets each test hand it the exact Match list it should "fetch" this
 * poll. Each fetchAndPublishLive() call simulates one 30-second poll.
 *
 * Publish contract these tests protect:
 *   - the FIRST time a live match is seen, its current state IS published, even
 *     with zero events, so a client connecting mid-match gets that game's state
 *     immediately (see the firstTimeSeenLive clause in fetchAndPublishLive).
 *   - after that first sighting, a real event is published once and then deduped
 *     on the next poll (no re-publishing the same event).
 *   - a status change (e.g. Scheduled -> LIVE) produces exactly one synthetic
 *     KICKOFF/HALFTIME/FULLTIME on top of the state publish.
 */
class AbstractEspnFetcherTest {

    private FakeProducer producer;
    private TestFetcher fetcher;
    private ExecutorService executor;

    @BeforeEach
    void setUp() {
        producer = new FakeProducer();
        // fetchAllMatches() dispatches each league via supplyAsync(task, executor);
        // production has a Spring-injected executor, so the test supplies a real one.
        executor = Executors.newFixedThreadPool(2);
        fetcher = new TestFetcher(producer, new FakeHttpClient(), new ObjectMapper(), executor);
    }

    @AfterEach
    void tearDown() {
        executor.shutdownNow();
    }

    @Test
    @DisplayName("a real event is published on first sighting, then deduped on the next poll")
    void realEventPublishedOnceThenDeduped() throws Exception {
        MatchEvent goal = new MatchEvent(23, "GOAL", "Goal", "Alpha", null, 1);
        Match m = liveMatch(1, "LIVE", List.of(goal));

        fetcher.nextMatches = List.of(m);
        fetcher.fetchAndPublishLive();   // poll 1: first sighting -> publishes state + the new event
        fetcher.fetchAndPublishLive();   // poll 2: same event, not first sighting, no change -> nothing

        // Only ONE publish total: the event is deduped on poll 2, and poll 2 is not a
        // first sighting, so there's nothing new to send.
        assertThat(producer.sent).hasSize(1);
        assertThat(producer.sent.get(0)).contains("Alpha");
    }

    @Test
    @DisplayName("Scheduled match publishes its first sighting, then KICKOFF when it goes LIVE")
    void kickoffOnScheduledToLive() throws Exception {
        fetcher.nextMatches = List.of(liveMatch(2, "Scheduled", List.of()));
        fetcher.fetchAndPublishLive();   // poll 1: first sighting -> state publish (no synthetic event yet)

        fetcher.nextMatches = List.of(liveMatch(2, "LIVE", List.of()));
        fetcher.fetchAndPublishLive();   // poll 2: status changed -> KICKOFF

        // Two publishes now: the first-sighting state on poll 1, then the KICKOFF on poll 2.
        assertThat(producer.sent).hasSize(2);
        assertThat(producer.sent.get(1)).contains("KICKOFF");
    }

    @Test
    @DisplayName("only the new event is published; the earlier one stays deduped")
    void onlyNewEventPublishedOnSecondPoll() throws Exception {
        MatchEvent a = new MatchEvent(10, "GOAL", "Goal", "Alpha", null, 1);
        MatchEvent b = new MatchEvent(20, "GOAL", "Goal", "Bravo", null, 1);

        fetcher.nextMatches = List.of(liveMatch(3, "LIVE", List.of(a)));
        fetcher.fetchAndPublishLive();                       // poll 1: first sighting -> publishes A

        fetcher.nextMatches = List.of(liveMatch(3, "LIVE", List.of(a, b)));
        fetcher.fetchAndPublishLive();                       // poll 2: publishes only B (A deduped)

        assertThat(producer.sent).hasSize(2);
        String secondPoll = producer.sent.get(1);
        assertThat(secondPoll).contains("Bravo");
        assertThat(secondPoll).doesNotContain("Alpha");
    }

    @Test
    @DisplayName("first sighting of a live match with no events still publishes its state")
    void firstSightingPublishesState() throws Exception {
        fetcher.nextMatches = List.of(liveMatch(4, "LIVE", List.of()));
        fetcher.fetchAndPublishLive();

        // First sighting publishes the match's current state so a mid-match client
        // gets it immediately, even though there are no events on it yet.
        assertThat(producer.sent).hasSize(1);
        String payload = producer.sent.get(0);
        assertThat(payload).contains("\"id\":4");
        assertThat(payload).contains("\"events\":[]");
    }

    // helpers

    /** Builds a Match via the 10-arg football-style constructor (teams left null). */
    private Match liveMatch(Integer id, String status, List<MatchEvent> events) {
        return new Match(id, status, 0, "2026-05-10T14:00Z", "Test League",
                null, null, 0, 0, events);
    }

    /** Records every payload instead of sending to Azure. super("","") skips the
     *  connection-string validation and makes the real send() a no-op anyway. */
    static class FakeProducer extends EventHubProducer {
        final List<String> sent = new ArrayList<>();
        FakeProducer() { super("", ""); }
        @Override public void send(String json) { sent.add(json); }
    }

    /** Returns an empty node for any URL. adapt() ignores it, so content is irrelevant. */
    static class FakeHttpClient extends EspnHttpClient {
        private final ObjectMapper m = new ObjectMapper();
        FakeHttpClient() { super(HttpClient.newHttpClient(), new ObjectMapper(), null, null); }

        @Override public JsonNode get(String url) { return m.createObjectNode(); }

        // fetchMatches() calls getFresh() (the no-cache background-poll path), not get().
        // Without this override the real getFresh() would attempt a live HTTP call to the
        // fake "http://test" URL, fail, and the league would be skipped, so adapt() (which
        // returns nextMatches) would never run and every assertion would see nothing.
        @Override public JsonNode getFresh(String url) { return m.createObjectNode(); }
    }

    /**
     * Controllable stand-in for a real sport fetcher. adapt() returns whatever
     * nextMatches is set to. isLive() returns true for everything so matches flow
     * through (including "Scheduled", which the transition detector must see first).
     */
    static class TestFetcher extends AbstractEspnFetcher {
        List<Match> nextMatches = List.of();

        TestFetcher(EventHubProducer producer, EspnHttpClient client, ObjectMapper mapper, ExecutorService executor) {
            super(producer, client, mapper, executor);
        }

        @Override protected String baseUrl() { return "http://test"; }
        @Override protected Map<String, String> leagues() { return Map.of("l", "Test League"); }
        @Override protected List<Match> adapt(JsonNode root, String leagueName) { return nextMatches; }
        @Override protected boolean isLive(Match match) { return true; }
        @Override public String sportName() { return "test"; }
    }
}