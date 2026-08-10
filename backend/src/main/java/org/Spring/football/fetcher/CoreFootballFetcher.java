package org.Spring.football.fetcher;

import java.net.http.HttpClient;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.Spring.api.EspnHttpClient;
import org.Spring.fetcher.AbstractEspnFetcher;
import org.Spring.football.adapter.CoreFootballAdapter;
import org.Spring.model.Match;
import org.Spring.producer.EventHubProducer;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

// Addressed: removed duplicate HTTP/JSON/fetch skeleton. Now extends AbstractEspnFetcher
// and only overrides sport-specific methods (baseUrl, leagues, adapt, isLive, sportName).
@Component
public class CoreFootballFetcher extends AbstractEspnFetcher {

    private static final String BASE =
            "https://site.web.api.espn.com/apis/site/v2/sports/soccer";

    /** Competitions to pull. Key = slug, value = friendly name. */
    private static final Map<String, String> LEAGUES = new LinkedHashMap<>();

    static {
        LEAGUES.put("fifa.world", "World Cup 2026");
        LEAGUES.put("fifa.friendly", "International Friendly");
        LEAGUES.put("uefa.champions", "Champions League");
        LEAGUES.put("uefa.europa", "Europa League");
        LEAGUES.put("uefa.europa.conf", "Conference League");
        LEAGUES.put("eng.1", "Premier League");
        LEAGUES.put("eng.2", "Championship");
        LEAGUES.put("esp.1", "La Liga");
        LEAGUES.put("ita.1", "Serie A");
        LEAGUES.put("ger.1", "Bundesliga");
        LEAGUES.put("fra.1", "Ligue 1");
        LEAGUES.put("usa.1", "MLS");
        LEAGUES.put("bra.1", "Brazil Serie A");
        LEAGUES.put("ned.1", "Eredivisie");
        LEAGUES.put("por.1", "Primeira Liga");
        LEAGUES.put("mex.1", "Liga MX");
        LEAGUES.put("arg.1", "Argentina Primera");
        LEAGUES.put("jpn.1", "J-League");
        LEAGUES.put("aus.1", "A-League");
        LEAGUES.put("club.friendly", "Club Friendly");
    }

    private final CoreFootballAdapter adapter;

    public CoreFootballFetcher(
            EventHubProducer producer,
            EspnHttpClient client,
            ObjectMapper mapper,
            CoreFootballAdapter adapter,
            ExecutorService executorService) {

        super(producer, client, mapper, executorService);
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
        return adapter.toMatches(root, leagueName);
    }

    @Override
    public String sportName() {
        return "football";
    }

    @Override
    protected boolean isLive(Match match) {
        return "LIVE".equals(match.status())
                || "HT".equals(match.status());
    }

    // -------------------------------------------------------------------------
    // Manual test only. Not used by Spring.
    // -------------------------------------------------------------------------

    public static void main(String[] args) throws Exception {

        ObjectMapper mapper = new ObjectMapper();
        ExecutorService executor = Executors.newFixedThreadPool(4);

        EspnHttpClient httpClient =
                new EspnHttpClient(HttpClient.newHttpClient(), mapper, null, executor);
        CoreFootballAdapter adapter = new CoreFootballAdapter();

        CoreFootballFetcher fetcher =
                new CoreFootballFetcher(
                        new EventHubProducer("", ""),
                        httpClient,
                        mapper,
                        adapter,
                        executor);

        List<String> live = new ArrayList<>();
        List<String> scheduled = new ArrayList<>();
        List<String> finished = new ArrayList<>();
        List<String> other = new ArrayList<>();

        System.out.println("Fetching " + LEAGUES.size() + " football competitions...\n");

        for (Map.Entry<String, String> entry : LEAGUES.entrySet()) {

            String slug = entry.getKey();
            String name = entry.getValue();

            List<Match> matches;

            try {

                matches = fetcher.fetchMatches(slug);

                if (!matches.isEmpty()) {
                    System.out.println("✓ " + name + " (" + matches.size() + " matches)");
                } else {
                    System.out.println("- " + name + " (0 matches today)");
                }

            } catch (Exception e) {

                System.out.println("✗ " + name + " [" + slug + "]: " + e.getMessage());
                continue;
            }

            for (Match m : matches) {

                String line = format(name, m);

                switch (category(m.status())) {

                    case "LIVE" -> live.add(line);
                    case "SCHEDULED" -> scheduled.add(line);
                    case "FINISHED" -> finished.add(line);
                    default -> other.add(line);
                }
            }
        }

        System.out.println();

        printSection("LIVE NOW", live);
        printSection("SCHEDULED", scheduled);
        printSection("FINISHED", finished);
        printSection("OTHER (canceled / postponed)", other);

        System.out.println("\n----------------------------------------");
        System.out.println(
                "Live: " + live.size()
                        + "   Scheduled: " + scheduled.size()
                        + "   Finished: " + finished.size()
                        + "   Other: " + other.size());
    }

    private static String category(String status) {

        if (status == null) return "OTHER";

        return switch (status) {

            case "LIVE", "HT" -> "LIVE";
            case "FT", "FT-Pens", "AET" -> "FINISHED";
            case "Scheduled", "TBD" -> "SCHEDULED";
            default -> "OTHER";
        };
    }

    private static String format(String league, Match m) {

        String home = m.homeTeam() != null ? m.homeTeam().name() : "?";
        String away = m.awayTeam() != null ? m.awayTeam().name() : "?";

        if ("SCHEDULED".equals(category(m.status()))) {

            return String.format(
                    "  [%s] %s vs %s   kickoff: %s",
                    league,
                    home,
                    away,
                    m.kickoff());
        }

        String score = m.homeScore() + "-" + m.awayScore();

        String tail = m.status();

        if (m.elapsed() != null) {
            tail = m.status() + " " + m.elapsed() + "'";
        }

        return String.format(
                "  [%s] %s %s %s   (%s)   events: %d",
                league,
                home,
                score,
                away,
                tail,
                m.events().size());
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