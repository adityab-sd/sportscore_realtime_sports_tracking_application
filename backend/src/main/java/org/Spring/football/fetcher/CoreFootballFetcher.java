package org.Spring.football.fetcher;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.Spring.football.adapter.CoreFootballAdapter;
import org.Spring.model.Match;
import org.Spring.producer.EventHubProducer;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 *  it fetches football data from the ESPN provider across many leagues and competitions,
 * including the World Cup. No API key required.
 */
@Component
public class CoreFootballFetcher {

    private static final String BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

    /** Competitions to pull. Key = slug, value = friendly name. */
    private static final Map<String, String> LEAGUES = new LinkedHashMap<>();
    static {
        LEAGUES.put("fifa.world",        "World Cup 2026");
        LEAGUES.put("fifa.friendly",     "International Friendly");
        LEAGUES.put("uefa.champions",    "Champions League");
        LEAGUES.put("uefa.europa",       "Europa League");
        LEAGUES.put("uefa.europa.conf",   "Conference League");
        LEAGUES.put("eng.1",             "Premier League");
        LEAGUES.put("eng.2",             "Championship");
        LEAGUES.put("esp.1",             "La Liga");
        LEAGUES.put("ita.1",             "Serie A");
        LEAGUES.put("ger.1",             "Bundesliga");
        LEAGUES.put("fra.1",             "Ligue 1");
        LEAGUES.put("usa.1",             "MLS");
        LEAGUES.put("bra.1",             "Brazil Serie A");
        LEAGUES.put("ned.1",             "Eredivisie");
        LEAGUES.put("por.1",             "Primeira Liga");
        LEAGUES.put("mex.1",             "Liga MX");
        LEAGUES.put("arg.1",             "Argentina Primera");
        LEAGUES.put("jpn.1",             "J-League");
        LEAGUES.put("aus.1",             "A-League");
    }

    private final HttpClient     client   = HttpClient.newHttpClient();
    private final CoreFootballAdapter adapter = new CoreFootballAdapter();
    private final ObjectMapper   mapper   = new ObjectMapper();
    private final EventHubProducer producer;

    public CoreFootballFetcher(EventHubProducer producer) {
        this.producer = producer;
    }

    public void fetchAndPublishLive() throws Exception {
        List<Match> all = fetchAllMatches();
        producer.send(mapper.writeValueAsString(all));
    }

    /** Publish a pre-fetched list — avoids a second HTTP round-trip. */
    public void publishMatches(List<Match> matches) throws Exception {
        producer.send(mapper.writeValueAsString(matches));
    }

    /** Raw JSON for one competition's scoreboard. */
    public String fetchScoreboardRaw(String league) throws Exception {
        return get("/" + league + "/scoreboard");
    }

    /** Parsed matches for one competition. */
    public List<Match> fetchMatches(String league) throws Exception {
        // Pass the known friendly name so the adapter can use it as a reliable
        // fallback when ESPN's JSON doesn't include a league.name node.
        // This fixes the "Football" placeholder showing on match cards via SignalR.
        String friendlyName = LEAGUES.getOrDefault(league, league);
        return adapter.toMatches(fetchScoreboardRaw(league), friendlyName);
    }

    /** Parsed matches across ALL configured competitions, combined. */
    public List<Match> fetchAllMatches() throws Exception {
        List<Match> all = new ArrayList<>();
        for (Map.Entry<String, String> entry : LEAGUES.entrySet()) {
            try {
                all.addAll(adapter.toMatches(fetchScoreboardRaw(entry.getKey()), entry.getValue()));
            } catch (Exception e) {
                System.out.println("  (skipped " + entry.getKey() + ": " + e.getMessage() + ")");
            }
        }
        return all;
    }

    private String get(String path) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE + path))
                .header("User-Agent", "SportScore/1.0")
                .GET()
                .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new RuntimeException("API error " + response.statusCode());
        }
        return response.body();
    }

    // Manual test which is for only me, not part of the production service.

    public static void main(String[] args) throws Exception {
        // Empty strings trigger the null-guard in EventHubProducer.send()
        // so live matches are logged instead of crashing with NullPointerException
        CoreFootballFetcher fetcher = new CoreFootballFetcher(new EventHubProducer("", ""));

        List<String> live      = new ArrayList<>();
        List<String> scheduled = new ArrayList<>();
        List<String> finished  = new ArrayList<>();
        List<String> other     = new ArrayList<>();

        System.out.println("Fetching " + LEAGUES.size() + " football competitions...\n");

        for (Map.Entry<String, String> entry : LEAGUES.entrySet()) {
            String slug = entry.getKey();
            String name = entry.getValue();
            List<Match> matches;
            try {
                matches = fetcher.fetchMatches(slug);
                if (!matches.isEmpty()) {
                    System.out.println("  ✓ " + name + " (" + matches.size() + " matches)");
                } else {
                    System.out.println("  - " + name + " (0 matches today)");
                }
            } catch (Exception e) {
                System.out.println("  ✗ " + name + " [" + slug + "]: " + e.getMessage());
                continue;
            }
            for (Match m : matches) {
                String line = format(name, m);
                switch (category(m.status())) {
                    case "LIVE"      -> live.add(line);
                    case "SCHEDULED" -> scheduled.add(line);
                    case "FINISHED"  -> finished.add(line);
                    default          -> other.add(line);
                }
            }
        }

        System.out.println();
        printSection("LIVE NOW",                     live);
        printSection("SCHEDULED",                    scheduled);
        printSection("FINISHED",                     finished);
        printSection("OTHER (canceled / postponed)", other);

        System.out.println("\n----------------------------------------");
        System.out.println("Live: "     + live.size()
                + "   Scheduled: " + scheduled.size()
                + "   Finished: "  + finished.size()
                + "   Other: "     + other.size());
    }

    // Helpers for the manual test above.
    private static String category(String status) {
        if (status == null) return "OTHER";
        return switch (status) {
            case "LIVE", "HT"            -> "LIVE";
            case "FT", "FT-Pens", "AET" -> "FINISHED";
            case "Scheduled", "TBD"      -> "SCHEDULED";
            default                      -> "OTHER"; // Canceled, Postponed
        };
    }

    private static String format(String league, Match m) {
        String home = m.homeTeam() != null ? m.homeTeam().name() : "?";
        String away = m.awayTeam() != null ? m.awayTeam().name() : "?";

        if ("SCHEDULED".equals(category(m.status()))) {
            return String.format("  [%s] %s vs %s   kickoff: %s",
                    league, home, away, m.kickoff());
        }

        String score = m.homeScore() + "-" + m.awayScore();
        String tail  = m.status();
        if (m.elapsed() != null) {
            tail = m.status() + " " + m.elapsed() + "'";
        }
        return String.format("  [%s] %s %s %s   (%s)   events: %d",
                league, home, score, away, tail, m.events().size());
    }

    private static void printSection(String title, List<String> lines) {
        System.out.println("\n===== " + title + " (" + lines.size() + ") =====");
        if (lines.isEmpty()) {
            System.out.println("  (none)");
        } else {
            lines.forEach(System.out::println);
        }
    }
}