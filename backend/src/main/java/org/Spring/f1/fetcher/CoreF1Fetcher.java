package org.Spring.f1.fetcher;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import org.Spring.f1.adapter.CoreF1Adapter;
import org.Spring.model.Match;
import org.Spring.producer.EventHubProducer;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * F1 live fetcher. Unlike the team sports there is no league loop — F1 is a
 * single championship with one scoreboard endpoint. Each GP weekend is folded
 * into one Match by CoreF1Adapter; only weekends with a session in progress are
 * pushed to Event Hub.
 */
@Component
public class CoreF1Fetcher {

    private static final String BASE = "https://site.api.espn.com/apis/site/v2/sports/racing/f1";

    private final HttpClient       client  = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10)).build();
    private final CoreF1Adapter    adapter = new CoreF1Adapter();
    private final ObjectMapper     mapper  = new ObjectMapper();
    private final EventHubProducer producer;

    public CoreF1Fetcher(EventHubProducer producer) {
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
        return "LIVE".equals(status);
    }

    public String fetchScoreboardRaw() throws Exception {
        return get("/scoreboard");
    }

    public List<Match> fetchAllMatches() throws Exception {
        try {
            return adapter.toMatches(fetchScoreboardRaw());
        } catch (Exception e) {
            System.out.println("  (f1 scoreboard error: " + e.getMessage() + ")");
            return new ArrayList<>();
        }
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

    // Manual test  ->  run this main() to print F1 weekends to the terminal

    public static void main(String[] args) throws Exception {
        CoreF1Fetcher fetcher = new CoreF1Fetcher(new EventHubProducer("", ""));

        List<String> live      = new ArrayList<>();
        List<String> scheduled = new ArrayList<>();
        List<String> finished  = new ArrayList<>();
        List<String> other     = new ArrayList<>();

        System.out.println("Fetching F1 scoreboard...\n");

        List<Match> matches;
        try {
            matches = fetcher.fetchAllMatches();
            System.out.println(matches.isEmpty()
                    ? "  - F1 (0 weekends returned)"
                    : "  \u2713 F1 (" + matches.size() + " weekend(s))");
        } catch (Exception e) {
            System.out.println("  \u2717 F1: " + e.getMessage());
            return;
        }

        for (Match m : matches) {
            String line = format(m);
            switch (category(m.status())) {
                case "LIVE"      -> live.add(line);
                case "SCHEDULED" -> scheduled.add(line);
                case "FINISHED"  -> finished.add(line);
                default          -> other.add(line);
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

    // Helpers

    private static String category(String status) {
        if (status == null) return "OTHER";
        return switch (status) {
            case "LIVE"      -> "LIVE";
            case "FT"        -> "FINISHED";
            case "Scheduled" -> "SCHEDULED";
            default          -> "OTHER";
        };
    }

    private static String format(Match m) {
        String gp = m.competition() != null ? m.competition() : "Grand Prix";
        String p1 = m.homeScoreDisplay() != null ? m.homeScoreDisplay()
                  : (m.homeTeam() != null ? "P1 " + m.homeTeam().name() : "P1 ?");
        String p2 = m.awayScoreDisplay() != null ? m.awayScoreDisplay()
                  : (m.awayTeam() != null ? "P2 " + m.awayTeam().name() : "P2 ?");
        String tail = m.statusDetail() != null ? m.statusDetail() : m.status();

        if ("SCHEDULED".equals(category(m.status()))) {
            return String.format("  [%s]   starts: %s   (%s)", gp, m.kickoff(), tail);
        }
        return String.format("  [%s]   %s | %s   (%s)", gp, p1, p2, tail);
    }

    private static void printSection(String title, List<String> lines) {
        System.out.println("\n===== " + title + " (" + lines.size() + ") =====");
        if (lines.isEmpty()) System.out.println("  (none)");
        else lines.forEach(System.out::println);
    }
}