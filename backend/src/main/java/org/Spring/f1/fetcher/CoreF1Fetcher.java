package org.Spring.f1.fetcher;

import java.net.http.HttpClient;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.Spring.api.EspnHttpClient;
import org.Spring.f1.adapter.CoreF1Adapter;
import org.Spring.fetcher.AbstractEspnFetcher;
import org.Spring.model.Match;
import org.Spring.model.MatchEvent;
import org.Spring.producer.EventHubProducer;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * F1 live fetcher. Unlike the team sports there is no league loop — F1 is a
 * single championship with one scoreboard endpoint. Each GP weekend is folded
 * into one Match by CoreF1Adapter; only weekends with a session in progress are
 * pushed to Event Hub.
 */
// Addressed: removed duplicate HTTP/JSON/fetch skeleton. Now extends AbstractEspnFetcher
// and only overrides sport-specific methods. F1 uses a single-entry leagues map instead
// of a league loop, with scoreboardUrl() overridden to skip the league slug.
@Component
public class CoreF1Fetcher extends AbstractEspnFetcher {

    private static final String BASE = "https://site.web.api.espn.com/apis/site/v2/sports/racing/f1";

    private static final Map<String, String> LEAGUES = Map.of(
            "f1", "Formula 1"
    );
    private final CoreF1Adapter    adapter;

    public CoreF1Fetcher(
            EventHubProducer producer,
            EspnHttpClient client,
            ObjectMapper mapper,
            CoreF1Adapter adapter) {

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
        return "LIVE".equals(match.status());
    }

    @Override
    protected String scoreboardUrl(String league) {
        return BASE + "/scoreboard";
    }

    @Override
    public String sportName() {
        return "f1";
    }

    @Override
    protected List<MatchEvent> detectCustomEvents(Match current, Match previous) {
        if (previous == null) return List.of();

        String prevLeader = previous.homeTeam() != null ? previous.homeTeam().name() : null;
        String curLeader  = current.homeTeam()  != null ? current.homeTeam().name()  : null;

        if (curLeader != null && prevLeader != null && !curLeader.equals(prevLeader)) {
            return List.of(new MatchEvent(0, "LEAD_CHANGE", current.statusDetail(),
                    curLeader, prevLeader, current.homeTeam().id()));
        }
        return List.of();
    }


    // Manual test  ->  run this main() to print F1 weekends to the terminal

    public static void main(String[] args) throws Exception {
        ObjectMapper mapper = new ObjectMapper();

        EspnHttpClient httpClient =
                new EspnHttpClient(HttpClient.newHttpClient(), mapper, null);

        CoreF1Adapter adapter = new CoreF1Adapter();
        CoreF1Fetcher fetcher = new CoreF1Fetcher(new EventHubProducer("", ""), httpClient, mapper, adapter);

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