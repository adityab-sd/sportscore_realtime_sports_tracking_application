package org.Spring.fetcher;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.Spring.api.EspnHttpClient;
import org.Spring.model.Match;
import org.Spring.producer.EventHubProducer;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public abstract class AbstractEspnFetcher {

    protected final EspnHttpClient client;
    protected final ObjectMapper mapper;
    protected final EventHubProducer producer;

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

        return adapt(root,
                leagues().getOrDefault(league, league));
    }

    public final List<Match> fetchAllMatches() {

        List<Match> matches = new ArrayList<>();

        for (String league : leagues().keySet()) {

            try {

                matches.addAll(fetchMatches(league));

            } catch (Exception e) {

                System.out.println(
                        "(skipped " + league + ": " + e.getMessage() + ")");
            }
        }

        return matches;
    }

    public final void fetchAndPublishLive() throws Exception {

        List<Match> live =
                fetchAllMatches()
                        .stream()
                        .filter(this::isLive)
                        .toList();

        if (!live.isEmpty()) {

            producer.send(mapper.writeValueAsString(live));

        }
    }
}