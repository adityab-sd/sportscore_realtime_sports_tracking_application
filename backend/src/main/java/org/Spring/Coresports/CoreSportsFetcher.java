package org.Spring.Coresports;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.Spring.Coresports.CoreSportsAdapter;
import org.Spring.model.Match;
import org.Spring.producer.EventHubProducer;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Fetches football data from the Core Sports provider across many competitions,
 * including the World Cup. No API key required.
 */
@Component
public class CoreSportsFetcher {

    private static final String BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

    /** Competitions to pull. Key = slug, value = friendly name. */
    private static final Map<String, String> LEAGUES = new LinkedHashMap<>();
    static {
        LEAGUES.put("fifa.world", "World Cup 2026");
        LEAGUES.put("fifa.friendly", "International Friendly");
        LEAGUES.put("uefa.champions", "Champions League");
        LEAGUES.put("eng.1", "Premier League");
        LEAGUES.put("esp.1", "La Liga");
        LEAGUES.put("ita.1", "Serie A");
        LEAGUES.put("ger.1", "Bundesliga");
        LEAGUES.put("fra.1", "Ligue 1");
        LEAGUES.put("usa.1", "MLS");
        LEAGUES.put("bra.1", "Brazil Serie A");
    }

    private final HttpClient client = HttpClient.newHttpClient();
    private final CoreSportsAdapter adapter = new CoreSportsAdapter();
    private final ObjectMapper mapper = new ObjectMapper();
    private final EventHubProducer producer;

    public CoreSportsFetcher(EventHubProducer producer) {
        this.producer = producer;
    }

    /** Fetches FIFA World Cup matches and publishes to Event Hub. */
    public void fetchAndPublishLive() throws Exception {
        List<Match> matches = fetchMatches("fifa.world");
        producer.send(mapper.writeValueAsString(matches));
    }

    /** Raw JSON for one competition's scoreboard. */
    public String fetchScoreboardRaw(String league) throws Exception {
        return get("/" + league + "/scoreboard");
    }

    /** Parsed matches for one competition. */
    public List<Match> fetchMatches(String league) throws Exception {
        return adapter.toMatches(fetchScoreboardRaw(league));
    }

    /** Parsed matches across ALL configured competitions, combined. */
    public List<Match> fetchAllMatches() throws Exception {
        List<Match> all = new ArrayList<>();
        for (String slug : LEAGUES.keySet()) {
            try {
                all.addAll(fetchMatches(slug));
            } catch (Exception e) {
                System.out.println("  (skipped " + slug + ": " + e.getMessage() + ")");
            }
        }
        return all;
    }

    private String get(String path) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE + path))
                .GET()
                .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new RuntimeException("API error " + response.statusCode());
        }
        return response.body();
    }

    public static void main(String[] args) throws Exception {
        CoreSportsFetcher fetcher = new CoreSportsFetcher(null);

        int totalMatches = 0;
        int liveMatches = 0;

        for (Map.Entry<String, String> entry : LEAGUES.entrySet()) {
            String slug = entry.getKey();
            String name = entry.getValue();
            List<Match> matches;
            try {
                matches = fetcher.fetchMatches(slug);
            } catch (Exception e) {
                System.out.println("\n[" + name + "] could not fetch (" + e.getMessage() + ")");
                continue;
            }

            System.out.println("\n===== " + name + " (" + slug + ") : "
                    + matches.size() + " matches =====");
            for (Match m : matches) {
                totalMatches++;
                boolean isLive = isLiveStatus(m.status());
                if (isLive)
                    liveMatches++;
                System.out.println(
                        (isLive ? "  >> LIVE  " : "  ")
                                + m.homeTeam().name() + " " + m.homeScore()
                                + "-" + m.awayScore() + " " + m.awayTeam().name()
                                + "  [" + m.status() + "]  events: " + m.events().size());
            }
        }

        System.out.println("\n========================================");
        System.out.println("TOTAL matches fetched: " + totalMatches);
        System.out.println("LIVE right now: " + liveMatches);
    }

    /** A match is live if its status is not a finished/scheduled marker. */
    private static boolean isLiveStatus(String status) {
        if (status == null)
            return false;
        String s = status.toUpperCase();
        // finished or not-started markers -> not live
        if (s.contains("FT") || s.contains("FULL"))
            return false;
        if (s.contains("NS") || s.contains("SCHEDULED"))
            return false;
        // anything with a minute/half indication is live
        return s.contains("'") || s.contains("H") || s.contains("LIVE")
                || s.matches(".*\\d+.*");
    }
}