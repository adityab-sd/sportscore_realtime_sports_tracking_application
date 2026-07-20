package org.Spring.basketball.fetcher;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.Spring.api.EspnHttpClient;
import org.Spring.basketball.adapter.CoreBasketballAdapter;
import org.Spring.fetcher.AbstractEspnFetcher;
import org.Spring.model.Match;
import org.Spring.producer.EventHubProducer;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import org.Spring.api.EspnHttpClient;


// ============================================================================
// PLEASE review — Template Method (GoF)   [duplicate skeleton — see CoreFootballFetcher]
// ----------------------------------------------------------------------------
// Same skeleton as the other sports. Basketball's only real variation is isLive()
// (it is period-aware). In the shared base class it becomes a one-method override:
//
// EXAMPLE:
//   @Override protected boolean isLive(Match m) {
//       return java.util.Set.of("LIVE","HT","Q1","Q2","Q3","Q4","OT").contains(m.status());
//   }
//    UPDATE:
//    The duplicate skeleton has been removed and the code has been updated to use the base class properly
// ============================================================================
@Component
public class CoreBasketballFetcher extends AbstractEspnFetcher {

    private static final String BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball";

    private static final Map<String, String> LEAGUES = new LinkedHashMap<>();
    static {
        // ── Professional (US) ─────────────────────────────────────────────
        LEAGUES.put("nba",                        "NBA");
        LEAGUES.put("wnba",                       "WNBA");
        LEAGUES.put("nba-development",            "NBA G League");

        // ── NBA Summer Leagues (active June–July) ─────────────────────────
        LEAGUES.put("nba-summer-las-vegas",       "NBA Summer League (Las Vegas)");
        LEAGUES.put("nba-summer-california",      "NBA Summer League (California)");
        LEAGUES.put("nba-summer-orlando",         "NBA Summer League (Orlando)");
        LEAGUES.put("nba-summer-utah",            "NBA Summer League (Salt Lake City)");
        LEAGUES.put("nba-summer-golden-state",    "NBA Summer League (Golden State)");
        LEAGUES.put("nba-summer-sacramento",      "NBA Summer League (Sacramento)");

        // ── College (US) ──────────────────────────────────────────────────
        LEAGUES.put("mens-college-basketball",    "NCAA Men's");
        LEAGUES.put("womens-college-basketball",  "NCAA Women's");

        // ── International ─────────────────────────────────────────────────
        LEAGUES.put("fiba",                       "FIBA World Cup");
        LEAGUES.put("nbl",                        "NBL (Australia)");
        LEAGUES.put("mens-olympics-basketball",   "Olympics Men's Basketball");
        LEAGUES.put("womens-olympics-basketball", "Olympics Women's Basketball");
    }

    private final CoreBasketballAdapter adapter;

    public CoreBasketballFetcher(
            EventHubProducer producer,
            EspnHttpClient client,
            ObjectMapper mapper,
            CoreBasketballAdapter adapter) {

        super(producer, client, mapper);
        this.adapter = adapter;
    }

    // Pipeline
    @Override
    protected String baseUrl() {
        return BASE;
    }

    @Override
    protected Map<String, String> leagues() {
        return LEAGUES;
    }

    @Override
    protected List<Match> adapt(JsonNode root, String leagueName) throws Exception {
        return adapter.toMatches(root, leagueName);
    }

    @Override
    protected boolean isLive(Match match) {
        if (match.status() == null) {
            return false;
        }

        return switch (match.status()) {
            case "LIVE", "HT", "Q1", "Q2", "Q3", "Q4", "OT" -> true;
            default -> false;
        };
    }

    @Override
    public String sportName() {
        return "basketball";
    }



    // Manual test

    public static void main(String[] args) throws Exception {
        // Empty strings trigger the null-guard in EventHubProducer.send()
        // so live matches are logged instead of crashing with NullPointerException
        ObjectMapper mapper = new ObjectMapper();

        EspnHttpClient httpClient =
                new EspnHttpClient(HttpClient.newHttpClient(), mapper);
        CoreBasketballAdapter adapter = new CoreBasketballAdapter();
        CoreBasketballFetcher fetcher = new CoreBasketballFetcher(new EventHubProducer("", ""),
                httpClient, mapper, adapter);

        List<String> live      = new ArrayList<>();
        List<String> scheduled = new ArrayList<>();
        List<String> finished  = new ArrayList<>();
        List<String> other     = new ArrayList<>();

        System.out.println("Fetching " + LEAGUES.size() + " basketball competitions...\n");

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
        System.out.println("Live: "      + live.size()
                + "   Scheduled: " + scheduled.size()
                + "   Finished: "  + finished.size()
                + "   Other: "     + other.size());
    }

    // Helpers

    private static String category(String status) {
        if (status == null) return "OTHER";
        return switch (status) {
            case "LIVE", "HT", "Q1", "Q2", "Q3", "Q4", "OT" -> "LIVE";
            case "FT", "FT-OT", "END"                        -> "FINISHED";
            case "Scheduled", "TBD"                          -> "SCHEDULED";
            default                                          -> "OTHER";
        };
    }

    private static String format(String league, Match m) {
        String home = m.homeTeam() != null ? m.homeTeam().name() : "?";
        String away = m.awayTeam() != null ? m.awayTeam().name() : "?";

        if ("SCHEDULED".equals(category(m.status()))) {
            return String.format("  [%s] %s vs %s   tip-off: %s",
                    league, home, away, m.kickoff());
        }

        String score = m.homeScore() + "-" + m.awayScore();
        String tail;
        if (m.period() != null && m.clock() != null) {
            tail = "Q" + m.period() + " " + m.clock();
        } else if (m.period() != null) {
            tail = "Q" + m.period();
        } else {
            tail = m.statusDetail() != null ? m.statusDetail() : m.status();
        }

        return String.format("  [%s] %s %s %s   (%s)",
                league, home, score, away, tail);
    }

    private static void printSection(String title, List<String> lines) {
        System.out.println("\n===== " + title + " (" + lines.size() + ") =====");
        if (lines.isEmpty()) System.out.println("  (none)");
        else lines.forEach(System.out::println);
    }
}