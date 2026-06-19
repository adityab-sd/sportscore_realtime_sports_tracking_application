package org.Spring.Coresports;


import org.Spring.model.Match;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

/**
 * Client for the Core Sports football provider.
 *
 * Design: scoreboard and summary are parsed into the unified Match model
 * (these flow through the pipeline, cache, and dashboard). All other data
 * (standings, teams, rosters, players, news, venues, etc.) is returned as
 * raw JSON for the frontend to display directly, since it is reference data
 * that does not pass through the unified model.
 */
public class CoreSportsClient {

    private static final String SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
    private static final String SITE_V2 = "https://site.api.espn.com/apis/v2/sports/soccer";
    private static final String CORE = "https://sports.core.api.espn.com/v2/sports/soccer/leagues";
    private static final String CORE_V3 = "https://sports.core.api.espn.com/v3/sports/soccer";

    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final CoreSportsAdapter adapter = new CoreSportsAdapter();

    // ---- CORE (parsed into the unified Match model) ----

    /** Live scores & schedule, parsed into Match objects. */
    public List<Match> liveMatches(String league) throws Exception {
        return adapter.toMatches(scoreboardRaw(league));
    }

    /** Raw scoreboard JSON (handed to the ingestion pipeline). */
    public String scoreboardRaw(String league) throws Exception {
        return get(SITE + "/" + league + "/scoreboard");
    }

    /** Scoreboard for a specific date (YYYYMMDD), parsed into Match objects. */
    public List<Match> matchesByDate(String league, String yyyymmdd) throws Exception {
        return adapter.toMatches(get(SITE + "/" + league + "/scoreboard?dates=" + yyyymmdd));
    }

    /** Full match report for one event (events, stats). Raw JSON. */
    public String matchSummary(String league, String eventId) throws Exception {
        return get(SITE + "/" + league + "/summary?event=" + eventId);
    }

    // ---- REFERENCE DATA (raw JSON for the frontend to display) ----

    /** League table / standings. Uses the /apis/v2/ path per provider docs. */
    public String standings(String league) throws Exception {
        return get(SITE_V2 + "/" + league + "/standings");
    }

    /** All teams in a league. */
    public String teams(String league) throws Exception {
        return get(SITE + "/" + league + "/teams");
    }

    /** One team's details. */
    public String team(String league, String teamId) throws Exception {
        return get(SITE + "/" + league + "/teams/" + teamId);
    }

    /** A team's squad / players. */
    public String teamRoster(String league, String teamId) throws Exception {
        return get(SITE + "/" + league + "/teams/" + teamId + "/roster");
    }

    /** A team's injury report. */
    public String teamInjuries(String league, String teamId) throws Exception {
        return get(SITE + "/" + league + "/teams/" + teamId + "/injuries");
    }

    /** A team's fixtures / schedule. */
    public String teamSchedule(String league, String teamId) throws Exception {
        return get(SITE + "/" + league + "/teams/" + teamId + "/schedule");
    }

    /** Top scorers / leaders for the current season. */
    public String leaders(String league) throws Exception {
        // The leaders endpoint lives under the current season in the core API.
        return get(CORE + "/" + league + "/seasons/" + currentYear() + "/leaders");
    }

    /** Latest news & media. */
    public String news(String league) throws Exception {
        return get(SITE + "/" + league + "/news");
    }

    /** Available seasons. */
    public String seasons(String league) throws Exception {
        return get(CORE + "/" + league + "/seasons");
    }

    /** Calendar of matchdays. */
    public String calendar(String league) throws Exception {
        return get(CORE + "/" + league + "/calendar");
    }

    /** Venues in a league. */
    public String venues(String league) throws Exception {
        return get(CORE + "/" + league + "/venues");
    }

    /** Active players list. */
    public String athletes(String league) throws Exception {
        return get(CORE_V3 + "/" + league + "/athletes?limit=100&active=true");
    }

    // ---- shared HTTP ----

    private String get(String url) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(15))
                .GET()
                .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new RuntimeException("API error " + response.statusCode() + " for " + url);
        }
        return response.body();
    }

    private static int currentYear() {
        return java.time.Year.now().getValue();
    }

    // ---- quick manual test ----

    /** Small functional interface so each reference call can fail independently. */
    private interface Fetch {
        String run() throws Exception;
    }

    private static void printLength(String label, Fetch f) {
        try {
            System.out.println(label + " JSON length: " + f.run().length());
        } catch (Exception e) {
            System.out.println(label + " — not available (" + e.getMessage() + ")");
        }
    }

    public static void main(String[] args) throws Exception {
        CoreSportsClient c = new CoreSportsClient();
        String league = "eng.1";

        List<Match> matches = c.liveMatches(league);
        System.out.println("Matches: " + matches.size());
        matches.stream().findFirst().ifPresent(m -> System.out.println(
                "  " + m.homeTeam().name() + " " + m.homeScore()
                        + "-" + m.awayScore() + " " + m.awayTeam().name()
                        + " [" + m.status() + "] events: " + m.events().size()));

        // Reference data — each call is independent; one failure won't stop the rest.
        printLength("Standings", () -> c.standings(league));
        printLength("Teams", () -> c.teams(league));
        printLength("News", () -> c.news(league));
        printLength("Leaders", () -> c.leaders(league));
        printLength("Seasons", () -> c.seasons(league));
        printLength("Venues", () -> c.venues(league));
    }
}
