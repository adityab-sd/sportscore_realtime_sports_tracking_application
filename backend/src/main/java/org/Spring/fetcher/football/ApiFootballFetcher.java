package org.Spring.fetcher.football;

import org.Spring.adapter.football.ApiFootballAdapter;
import org.Spring.model.Match;
import org.Spring.Producer.EventHubProducer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;

@Component
public class ApiFootballFetcher {

    private static final String BASE = "https://v3.football.api-sports.io";

    private final HttpClient client = HttpClient.newHttpClient();
    private final ApiFootballAdapter adapter = new ApiFootballAdapter();
    private final String apiKey;
    private final EventHubProducer producer;

    public ApiFootballFetcher(
            @Value("${APISPORTS_KEY}") String apiKey,
            EventHubProducer producer) {
        this.apiKey = apiKey;
        this.producer = producer;
    }

    /**
     * Raw JSON for all live matches (events already included).
     * This is the payload handed to the ingestion pipeline. Costs one request.
     */
    public String fetchLiveRaw() throws Exception {
        return get("/fixtures?live=all");
    }

    /** Fetches, cleans into Match objects, serializes and publishes to Event Hubs. */
    public void fetchAndPublishLive() throws Exception {
        List<Match> matches = fetchLiveMatches();
        producer.send(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(matches));
    }

    /** The same live data parsed into Match objects with events filled in. */
    public List<Match> fetchLiveMatches() throws Exception {
        return adapter.toMatches(fetchLiveRaw());
    }

    private String get(String path) throws Exception {        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE + path))
                .header("x-apisports-key", apiKey)
                .GET()
                .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new RuntimeException("API error " + response.statusCode()
                    + ": " + response.body());
        }
        return response.body();
    }
}