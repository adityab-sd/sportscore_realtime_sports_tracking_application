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

        // The /fixtures endpoint does not include events;
        // those come from /fixtures/events (a later task).
        List<MatchEvent> events = new ArrayList<>();

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

    private Integer intOrNull(JsonNode n) {
        return (n.isNull() || n.isMissingNode()) ? null : n.asInt();
    }

    private String textOrNull(JsonNode n) {
        return (n.isNull() || n.isMissingNode()) ? null : n.asText();
    }
}