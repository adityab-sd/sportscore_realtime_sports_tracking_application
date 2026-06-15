package org.Spring.adapter.football;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.Spring.model.Match;
import org.Spring.model.MatchEvent;
import org.Spring.model.Team;

import java.util.ArrayList;
import java.util.List;

public class ApiFootballAdapter {

    private final ObjectMapper mapper = new ObjectMapper();

    public List<Match> toMatches(String json) throws Exception {
        JsonNode root = mapper.readTree(json);
        List<Match> matches = new ArrayList<>();
        for (JsonNode item : root.path("response")) {
            matches.add(toMatch(item));
        }
        return matches;
    }

    private Match toMatch(JsonNode item) {
        JsonNode fixture = item.path("fixture");
        JsonNode status = fixture.path("status");
        JsonNode league = item.path("league");
        JsonNode teams = item.path("teams");
        JsonNode goals = item.path("goals");

        int id = fixture.path("id").asInt();
        String statusShort = textOrNull(status.path("short"));
        Integer elapsed = intOrNull(status.path("elapsed"));
        String kickoff = textOrNull(fixture.path("date"));
        String competition = textOrNull(league.path("name"));

        Team home = toTeam(teams.path("home"));
        Team away = toTeam(teams.path("away"));

        Integer homeScore = intOrNull(goals.path("home"));
        Integer awayScore = intOrNull(goals.path("away"));

        // Read the events array (goals, cards) if present.
        // It is included for single-fixture and live (live=all) requests.
        List<MatchEvent> events = toEvents(item.path("events"));

        return new Match(id, statusShort, elapsed, kickoff, competition,
                home, away, homeScore, awayScore, events);
    }

    private Team toTeam(JsonNode t) {
        return new Team(
                t.path("id").asInt(),
                textOrNull(t.path("name")),
                "", // /fixtures has no short code
                textOrNull(t.path("logo")));
    }

    /** Reads the events array from a fixture into MatchEvent records. */
    private List<MatchEvent> toEvents(JsonNode eventsArray) {
        List<MatchEvent> events = new ArrayList<>();
        for (JsonNode e : eventsArray) {
            int minute = e.path("time").path("elapsed").asInt();
            String type = mapType(textOrNull(e.path("type")));
            String detail = e.path("detail").asText("");
            String player = textOrNull(e.path("player").path("name"));
            JsonNode assistName = e.path("assist").path("name");
            String assist = (assistName.isNull() || assistName.isMissingNode())
                    ? null
                    : assistName.asText();
            int teamId = e.path("team").path("id").asInt();
            events.add(new MatchEvent(minute, type, detail, player, assist, teamId));
        }
        return events;
    }

    /** Turns API-Football event types into our lowercase types. */
    private String mapType(String apiType) {
        String t = (apiType == null) ? "" : apiType.toLowerCase();
        return switch (t) {
            case "goal" -> "goal";
            case "card" -> "card";
            case "subst" -> "subst";
            case "var" -> "var";
            default -> t;
        };
    }

    private Integer intOrNull(JsonNode n) {
        return (n.isNull() || n.isMissingNode()) ? null : n.asInt();
    }

    private String textOrNull(JsonNode n) {
        return (n.isNull() || n.isMissingNode()) ? null : n.asText();
    }
}