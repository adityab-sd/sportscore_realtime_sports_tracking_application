package org.Spring.fetcher;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.Spring.api.EspnHttpClient;
import org.Spring.model.Match;
import org.Spring.model.MatchEvent;
import org.Spring.producer.EventHubProducer;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public abstract class AbstractEspnFetcher {

    protected final EspnHttpClient client;
    protected final ObjectMapper mapper;
    protected final EventHubProducer producer;

    // Per-fetcher (per-sport) instance state -- safe because LivePipelineRunner
    // keeps one long-lived instance of each fetcher for the app's lifetime, and
    // each sport gets its own fetcher bean, so match ids never collide across sports.
    private final Map<Integer, Set<String>> seenEvents = new ConcurrentHashMap<>();
    private final Map<Integer, String> lastStatus = new ConcurrentHashMap<>();

    protected AbstractEspnFetcher(
            EventHubProducer producer,
            EspnHttpClient client,
            ObjectMapper mapper) {

        this.producer = producer;
        this.client = client;
        this.mapper = mapper;
    }

    protected abstract String baseUrl();
    protected abstract Map<String, String> leagues();
    protected abstract List<Match> adapt(JsonNode root, String leagueName) throws Exception;
    protected abstract boolean isLive(Match match);
    public abstract String sportName();

    protected String scoreboardUrl(String league) {
        return baseUrl() + "/" + league + "/scoreboard";
    }

    public final List<Match> fetchMatches(String league) throws Exception {
        JsonNode root = client.get(scoreboardUrl(league));
        return adapt(root, leagues().getOrDefault(league, league));
    }

    public final List<Match> fetchAllMatches() {
        List<Match> matches = new ArrayList<>();
        for (String league : leagues().keySet()) {
            try {
                matches.addAll(fetchMatches(league));
            } catch (Exception e) {
                System.out.println("(skipped " + league + ": " + e.getMessage() + ")");
            }
        }
        return matches;
    }

    public final void fetchAndPublishLive() throws Exception {
        List<Match> live = fetchAllMatches().stream().filter(this::isLive).toList();

        List<Match> toPublish = new ArrayList<>();

        for (Match m : live) {
            if (m.id() == null) continue; // no dedup key possible, skip rather than crash

            List<MatchEvent> newEvents = new ArrayList<>();

            // Synthetic transition event (kickoff/half-time/full-time), since ESPN
            // never puts these in `details` -- they only show up as a status change.
            MatchEvent transition = detectTransition(m);
            if (transition != null) newEvents.add(transition);

            // Real incident events (goals/cards/subs), de-duplicated per match so the
            // same event from ESPN's `details` array isn't re-announced every poll.
            Set<String> seen = seenEvents.computeIfAbsent(m.id(), k -> ConcurrentHashMap.newKeySet());
            for (MatchEvent e : m.events()) {
                if (seen.add(fingerprint(e))) {
                    newEvents.add(e);
                }
            }

            if (!newEvents.isEmpty()) {
                toPublish.add(m.withEvents(newEvents));
            }
        }

        if (!toPublish.isEmpty()) {
            producer.send(mapper.writeValueAsString(toPublish));
        }

        // Finished matches won't be polled again (filtered out by isLive upstream),
        // so their dedup/status state would otherwise sit in memory forever. Clean up
        // anything not seen in this live batch.
        Set<Integer> stillLiveIds = live.stream().map(Match::id).filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        seenEvents.keySet().retainAll(stillLiveIds);
        lastStatus.keySet().retainAll(stillLiveIds);
    }

    private MatchEvent detectTransition(Match m) {
        String prev = lastStatus.put(m.id(), m.status());

        // First time we've ever seen this match (e.g. app just started, or it
        // came into scope mid-match) -- don't invent a fake kickoff/HT event
        // just because there's no prior status to compare against.
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