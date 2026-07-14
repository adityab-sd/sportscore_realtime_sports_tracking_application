package org.Spring.baseball.fetcher;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.Spring.baseball.adapter.CoreBaseballAdapter;
import org.Spring.model.Match;
import org.Spring.producer.EventHubProducer;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;

// ============================================================================
// PLEASE review — Template Method (GoF)   [duplicate skeleton — see CoreFootballFetcher]
// ----------------------------------------------------------------------------
// Same skeleton as the other sports; only the LEAGUES map (12 entries) and isLive()
// differ. The subclass supplies just those pieces:
//
// EXAMPLE:
//   @Component
//   class BaseballFetcher extends LiveSportFetcher {
//       protected String baseUrl() { return BASE; }
//       protected Map<String,String> leagues() { return LEAGUES; }
//       @Override protected boolean isLive(Match m) { return "LIVE".equals(m.status()); }
//   }
// ============================================================================
@Component
public class CoreBaseballFetcher {

    private static final String BASE = "https://site.api.espn.com/apis/site/v2/sports/baseball";

    // Every baseball/softball competition ESPN documents for this sport slug.
    // Previously only mlb + college-baseball were polled here, silently dropping
    // live-score push for the other 10 leagues even though BaseballController
    // could already be pointed at them via the {league} path variable.
    private static final Map<String, String> LEAGUES = new LinkedHashMap<>();
    static {
        LEAGUES.put("mlb",                       "MLB");
        LEAGUES.put("college-baseball",          "NCAA Baseball");
        LEAGUES.put("college-softball",          "NCAA Softball");
        LEAGUES.put("world-baseball-classic",    "World Baseball Classic");
        LEAGUES.put("caribbean-series",          "Caribbean Series");
        LEAGUES.put("mexican-winter-league",     "Mexican League");
        LEAGUES.put("dominican-winter-league",   "Dominican Winter League");
        LEAGUES.put("puerto-rican-winter-league","Puerto Rican Winter League");
        LEAGUES.put("venezuelan-winter-league",  "Venezuelan Winter League");
        LEAGUES.put("olympics-baseball",         "Olympics Men's Baseball");
        LEAGUES.put("llb",                       "Little League Baseball World Series");
        LEAGUES.put("lls",                       "Little League Softball World Series");
    }

    private final HttpClient          client  = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10)).build();
    private final CoreBaseballAdapter adapter = new CoreBaseballAdapter();
    private final ObjectMapper        mapper  = new ObjectMapper();
    private final EventHubProducer    producer;

    public CoreBaseballFetcher(EventHubProducer producer) {
        this.producer = producer;
    }

    // Pipeline

    public void fetchAndPublishLive() throws Exception {
        List<Match> live = new ArrayList<>();
        for (Match m : fetchAllMatches()) {
            if (isLive(m.status())) live.add(m);
        }
        if (!live.isEmpty()) {
            producer.send(mapper.writeValueAsString(live));
        }
    }

    private static boolean isLive(String status) {
        if (status == null) return false;
        return switch (status) {
            case "LIVE" -> true;
            default     -> false;
        };
    }

    public String fetchScoreboardRaw(String league) throws Exception {
        return get("/" + league + "/scoreboard");
    }

    public List<Match> fetchMatches(String league) throws Exception {
        return adapter.toMatches(fetchScoreboardRaw(league));
    }

    public List<Match> fetchAllMatches() throws Exception {
        List<Match> all = new ArrayList<>();
        for (String slug : LEAGUES.keySet()) {
            try {
                all.addAll(fetchMatches(slug));
            } catch (Exception e) {
                System.out.println("  (baseball skipped " + slug + ": " + e.getMessage() + ")");
            }
        }
        return all;
    }

    private String get(String path) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE + path))
                .header("User-Agent", "SportScore/1.0")
                .timeout(Duration.ofSeconds(15))
                .GET().build();
        HttpResponse<String> response =
                client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200)
            throw new RuntimeException("API error " + response.statusCode());
        return response.body();
    }

    // Manual test for only me, not part of the production service.

    public static void main(String[] args) throws Exception {
        // Empty strings trigger the null-guard in EventHubProducer.send()
        // so live matches are logged instead of pushed to Event Hub.
        CoreBaseballFetcher fetcher = new CoreBaseballFetcher(new EventHubProducer("", ""));

        List<String> live      = new ArrayList<>();
        List<String> scheduled = new ArrayList<>();
        List<String> finished  = new ArrayList<>();
        List<String> other     = new ArrayList<>();

        System.out.println("Fetching " + LEAGUES.size() + " baseball competitions...\n");

        for (Map.Entry<String, String> entry : LEAGUES.entrySet()) {
            String slug = entry.getKey();
            String name = entry.getValue();
            List<Match> matches;
            try {
                matches = fetcher.fetchMatches(slug);
                if (!matches.isEmpty()) {
                    System.out.println("  ✓ " + name + " (" + matches.size() + " games)");
                } else {
                    System.out.println("  - " + name + " (0 games today)");
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
        System.out.println("Live: "      + live.size()
                + "   Scheduled: " + scheduled.size()
                + "   Finished: "  + finished.size()
                + "   Other: "     + other.size());
    }

    // Helpers for the manual test above.

    private static String category(String status) {
        if (status == null) return "OTHER";
        return switch (status) {
            case "LIVE"             -> "LIVE";
            case "FT", "Forfeit"    -> "FINISHED";
            case "Scheduled", "TBD" -> "SCHEDULED";
            default                 -> "OTHER";
        };
    }

    private static String format(String league, Match m) {
        String home = m.homeTeam() != null ? m.homeTeam().name() : "?";
        String away = m.awayTeam() != null ? m.awayTeam().name() : "?";

        if ("SCHEDULED".equals(category(m.status()))) {
            return String.format("  [%s] %s vs %s   first pitch: %s",
                    league, home, away, m.kickoff());
        }

        String score = m.homeScore() + "-" + m.awayScore();
        String tail  = m.statusDetail() != null ? m.statusDetail() : m.status();
        return String.format("  [%s] %s %s %s   (%s)",
                league, home, score, away, tail);
    }

    private static void printSection(String title, List<String> lines) {
        System.out.println("\n===== " + title + " (" + lines.size() + ") =====");
        if (lines.isEmpty()) System.out.println("  (none)");
        else lines.forEach(System.out::println);
    }
}