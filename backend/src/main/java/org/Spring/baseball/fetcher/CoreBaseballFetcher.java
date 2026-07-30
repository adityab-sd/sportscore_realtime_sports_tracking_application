package org.Spring.baseball.fetcher;

import java.net.http.HttpClient;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.Spring.baseball.adapter.CoreBaseballAdapter;
import org.Spring.fetcher.AbstractEspnFetcher;
import org.Spring.model.Match;
import org.Spring.model.MatchEvent;
import org.Spring.producer.EventHubProducer;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import org.Spring.api.EspnHttpClient;

// ============================================================================
// UPDATE:
// The duplicate skeleton has been removed and the code has been updated to use the base class properly
// ============================================================================
@Component
public class CoreBaseballFetcher extends AbstractEspnFetcher {

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

    private final CoreBaseballAdapter adapter;

    public CoreBaseballFetcher(
            EventHubProducer producer,
            EspnHttpClient client,
            ObjectMapper mapper,
            CoreBaseballAdapter adapter) {

        super(producer, client, mapper);
        this.adapter = adapter;
    }

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
        // Baseball adapter doesn't need the friendly league name.
        return adapter.toMatches(root, leagueName);
    }

    @Override
    protected boolean isLive(Match match) {
        return "LIVE".equals(match.status());
    }

    @Override
    public String sportName() {
        return "baseball";
    }

    @Override
    protected List<MatchEvent> detectCustomEvents(Match current, Match previous) {
        if (previous == null) return List.of(); // nothing to diff against yet

        List<MatchEvent> events = new ArrayList<>();
        int minute = current.period() != null ? current.period() : 0;

        if (current.homeScore() != null && previous.homeScore() != null
                && !current.homeScore().equals(previous.homeScore())) {
            events.add(new MatchEvent(minute, "RUN_SCORED", null, null, null,
                    current.homeTeam() != null ? current.homeTeam().id() : 0));
        }
        if (current.awayScore() != null && previous.awayScore() != null
                && !current.awayScore().equals(previous.awayScore())) {
            events.add(new MatchEvent(minute, "RUN_SCORED", null, null, null,
                    current.awayTeam() != null ? current.awayTeam().id() : 0));
        }
        if (current.period() != null && previous.period() != null
                && !current.period().equals(previous.period())) {
            events.add(new MatchEvent(minute, "INNING_CHANGE", current.statusDetail(), null, null, 0));
        }
        return events;
    }

    // -------------------------------------------------------------------------
    // Manual test only. Not used by Spring.
    // -------------------------------------------------------------------------

    public static void main(String[] args) throws Exception {
        // Empty strings trigger the null-guard in EventHubProducer.send()
        // so live matches are logged instead of pushed to Event Hub.
        ObjectMapper mapper = new ObjectMapper();

        EspnHttpClient httpClient =
                new EspnHttpClient(HttpClient.newHttpClient(), mapper);

        CoreBaseballAdapter adapter = new CoreBaseballAdapter();
        CoreBaseballFetcher fetcher = new CoreBaseballFetcher(new EventHubProducer("", ""),
                httpClient, mapper, adapter);

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