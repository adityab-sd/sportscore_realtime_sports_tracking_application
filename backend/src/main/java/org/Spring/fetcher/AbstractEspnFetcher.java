package org.Spring.fetcher;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Semaphore;

import org.Spring.api.EspnHttpClient;
import org.Spring.model.Match;
import org.Spring.model.MatchEvent;
import org.Spring.producer.EventHubProducer;
import org.springframework.beans.factory.annotation.Value;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

public abstract class AbstractEspnFetcher {

    protected final EspnHttpClient client;
    protected final ObjectMapper mapper;
    protected final EventHubProducer producer;
    protected final ExecutorService executor;

    @Value("${espn.fetch.league-concurrency:4}")
    private int leagueConcurrency;

    private final Map<Integer, Set<String>> seenEvents = new ConcurrentHashMap<>();
    private final Map<Integer, String> lastStatus = new ConcurrentHashMap<>();
    private final Map<Integer, Match> lastSnapshot = new ConcurrentHashMap<>();

    protected AbstractEspnFetcher(
            EventHubProducer producer,
            EspnHttpClient client,
            ObjectMapper mapper,
            ExecutorService executor) {

        this.producer = producer;
        this.client   = client;
        this.mapper   = mapper;
        this.executor = executor;
    }

    protected abstract String baseUrl();
    protected abstract Map<String, String> leagues();
    protected abstract List<Match> adapt(JsonNode root, String leagueName) throws Exception;
    protected abstract boolean isLive(Match match);
    public abstract String sportName();

    protected String scoreboardUrl(String league) {
        return baseUrl() + "/" + league + "/scoreboard";
    }

    protected List<MatchEvent> detectCustomEvents(Match current, Match previous) {
        return List.of();
    }

    /**
     * Uses getFresh() instead of get() — this is the background poll path,
     * where Redis's 30s live-score TTL matches the 30s poll cadence, so caching
     * here never actually gets hit by its own repeat calls (see getFresh()'s
     * javadoc in EspnHttpClient for the full reasoning). Going straight to
     * ESPN removes a large chunk of wasted Redis traffic with no loss of
     * benefit, since nothing was being served from cache in this path anyway.
     */
    public final List<Match> fetchMatches(String league) throws Exception {
        JsonNode root = client.getFresh(scoreboardUrl(league));
        return adapt(root, leagues().getOrDefault(league, league));
    }

    public final List<Match> fetchAllMatches() {
        Semaphore limiter = new Semaphore(Math.max(1, leagueConcurrency));

        List<CompletableFuture<List<Match>>> futures = leagues().keySet().stream()
                .map(league -> CompletableFuture.supplyAsync(() -> {
                    try {
                        limiter.acquire();
                        return fetchMatches(league);
                    } catch (Exception e) {
                        System.out.println("(skipped " + league + ": " + e.getMessage() + ")");
                        return List.<Match>of();
                    } finally {
                        limiter.release();
                    }
                }, executor))
                .toList();

        List<Match> matches = new ArrayList<>();
        for (var f : futures) {
            matches.addAll(f.join());
        }
        return matches;
    }

    public final void fetchAndPublishLive() throws Exception {
        List<Match> live = fetchAllMatches().stream().filter(this::isLive).toList();

        List<Match> toPublish = new ArrayList<>();

        for (Match m : live) {
            if (m.id() == null) continue;

            List<MatchEvent> newEvents = new ArrayList<>();

            MatchEvent transition = detectTransition(m);
            if (transition != null) newEvents.add(transition);

            Set<String> seen = seenEvents.computeIfAbsent(m.id(), k -> ConcurrentHashMap.newKeySet());
            for (MatchEvent e : m.events()) {
                if (seen.add(fingerprint(e))) {
                    newEvents.add(e);
                }
            }
            List<MatchEvent> custom = detectCustomEvents(m, lastSnapshot.get(m.id()));
            newEvents.addAll(custom);
            Match previous = lastSnapshot.put(m.id(), m);
            boolean firstTimeSeenLive = previous == null;
            boolean scoreChanged = previous != null &&
                    (!java.util.Objects.equals(previous.homeScore(), m.homeScore())
                     || !java.util.Objects.equals(previous.awayScore(), m.awayScore())
                     || !java.util.Objects.equals(previous.status(), m.status()));
            if (!newEvents.isEmpty() || firstTimeSeenLive || scoreChanged) {
                toPublish.add(m.withEvents(newEvents));
            }
        }

        if (!toPublish.isEmpty()) {
            producer.send(mapper.writeValueAsString(toPublish));
        }

        Set<Integer> stillLiveIds = live.stream().map(Match::id).filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        seenEvents.keySet().retainAll(stillLiveIds);
        lastStatus.keySet().retainAll(stillLiveIds);
        lastSnapshot.keySet().retainAll(stillLiveIds);
    }

    private MatchEvent detectTransition(Match m) {
        String prev = lastStatus.put(m.id(), m.status());

        if (prev == null || prev.equals(m.status())) return null;

        if ("HT".equals(m.status())) {
            return new MatchEvent(m.elapsed(), "HALFTIME", null, null, null, null);
        }
        if ("LIVE".equals(m.status()) && "Scheduled".equals(prev)) {
            return new MatchEvent(0, "KICKOFF", null, null, null, null);
        }
        if (("FT".equals(m.status()) || "FT-Pens".equals(m.status())) && !prev.equals(m.status())) {
            return new MatchEvent(m.elapsed(), "FULLTIME", null, null, null, null);
        }
        return null;
    }

    private String fingerprint(MatchEvent e) {
        return e.minute() + "|" + e.type() + "|" + e.player() + "|" + e.teamId() + "|" + e.detail();
    }

    public final void fetchAndPublishLiveLegacyAlias() throws Exception {
        fetchAndPublishLive();
    }
}