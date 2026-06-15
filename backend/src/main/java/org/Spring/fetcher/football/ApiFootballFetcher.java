package org.Spring.fetcher.football;

import org.Spring.adapter.football.ApiFootballAdapter;
import org.Spring.model.Match;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;

/**
 * Retrieves live football data from API-Football.
 * Pulls the raw JSON (handed to Aditya's Event Hubs producer) and can also
 * parse it into Match objects using the adapter, for local checks / the
 * dashboard.
 */
public class ApiFootballFetcher {

    private static final String BASE = "https://v3.football.api-sports.io";

    private final HttpClient client = HttpClient.newHttpClient();
    private final ApiFootballAdapter adapter = new ApiFootballAdapter();
    private final String apiKey;

    public ApiFootballFetcher(String apiKey) {
        this.apiKey = apiKey;
    }

    /**
     * Raw JSON for all live matches (events already included).
     * This is the payload handed to the ingestion pipeline. Costs one request.
     */
    public String fetchLiveRaw() throws Exception {
        return get("/fixtures?live=all");
    }

    /** The same live data parsed into Match objects with events filled in. */
    public List<Match> fetchLiveMatches() throws Exception {
        return adapter.toMatches(fetchLiveRaw());
    }

    private String get(String path) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
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

    /** Quick manual test. Reads the API key from an environment variable. */
    public static void main(String[] args) throws Exception {
        String key = System.getenv("APISPORTS_KEY");
        if (key == null || key.isBlank()) {
            System.out.println("Set the APISPORTS_KEY environment variable first.");
            return;
        }
        ApiFootballFetcher fetcher = new ApiFootballFetcher(key);
        List<Match> live = fetcher.fetchLiveMatches();
        System.out.println("Fetched " + live.size() + " live matches.");
        live.stream().findFirst().ifPresent(m -> System.out.println(m.homeTeam().name() + " " + m.homeScore()
                + "-" + m.awayScore() + " " + m.awayTeam().name()
                + " | events: " + m.events().size()));
    }
}