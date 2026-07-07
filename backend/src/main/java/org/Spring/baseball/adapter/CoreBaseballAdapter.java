package org.Spring.baseball.adapter;

import java.util.ArrayList;
import java.util.List;

import org.Spring.model.Match;
import org.Spring.model.MatchEvent;
import org.Spring.model.Team;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

// ESPN's MLB scoreboard uses the same envelope as basketball, so this mirrors
// CoreBasketballAdapter. Baseball specifics: period holds the inning,
// homeScore/awayScore are runs, and statusDetail carries ESPN's "Top 5th" text.
public class CoreBaseballAdapter {

    private final ObjectMapper mapper = new ObjectMapper();

    public List<Match> toMatches(String json) throws Exception {
        JsonNode root = mapper.readTree(json);
        List<Match> matches = new ArrayList<>();
        for (JsonNode event : root.path("events")) {
            Match m = toMatch(event);
            if (m != null) matches.add(m);
        }
        return matches;
    }

    private Match toMatch(JsonNode event) {
        int id = event.path("id").asInt();
        JsonNode comp = event.path("competitions").path(0);
        if (comp.isMissingNode()) return null;

        JsonNode statusNode = comp.path("status");
        JsonNode statusType = statusNode.path("type");

        int    inning = statusNode.path("period").canConvertToInt()
                      ? statusNode.path("period").asInt() : 0;
        String state  = statusType.path("state").asText("");
        String name   = statusType.path("name").asText("");

        String status       = mapStatus(state, name);
        boolean inPlay      = "LIVE".equals(status);
        Integer periodOut   = (inPlay && inning > 0) ? inning : null;
        String  statusDetail = first(
                textOrNull(statusType.path("shortDetail")),
                textOrNull(statusType.path("detail")),
                status);

        String firstPitch  = textOrNull(event.path("date"));
        String competition = first(
                textOrNull(comp.path("league").path("name")),
                textOrNull(event.path("league").path("name")),
                "Baseball");

        Team    home = null, away = null;
        Integer homeScore = null, awayScore = null;

        for (JsonNode c : comp.path("competitors")) {
            Team    team  = toTeam(c.path("team"));
            Integer score = intOrNull(c.path("score"));
            if ("home".equals(c.path("homeAway").asText())) {
                home = team; homeScore = score;
            } else {
                away = team; awayScore = score;
            }
        }

        return new Match(
                id, "baseball", status,
                null,           // elapsed - football only
                null,           // clock - baseball has no game clock
                periodOut,      // period - inning
                statusDetail,
                firstPitch,
                competition,
                home, away,
                homeScore, awayScore,
                null, null,     // score display strings - cricket only
                List.<MatchEvent>of());
    }

    private String mapStatus(String state, String name) {
        if ("in".equals(state)) {
            if (name.contains("DELAY")) return "Delayed";
            return "LIVE";
        }
        if ("post".equals(state)) {
            if (name.contains("CANCEL"))  return "Canceled";
            if (name.contains("POSTPON")) return "Postponed";
            if (name.contains("FORFEIT")) return "Forfeit";
            return "FT";
        }
        // pre
        if (name.contains("DELAY"))   return "Delayed";
        if (name.contains("CANCEL"))  return "Canceled";
        if (name.contains("POSTPON")) return "Postponed";
        if (name.contains("TBD"))     return "TBD";
        return "Scheduled";
    }

    private Team toTeam(JsonNode t) {
        String logo = first(
                textOrNull(t.path("logo")),
                textOrNull(t.path("logos").path(0).path("href")),
                null);
        return new Team(
                t.path("id").asInt(),
                first(textOrNull(t.path("displayName")), textOrNull(t.path("name")), null),
                first(textOrNull(t.path("abbreviation")), textOrNull(t.path("shortDisplayName")), null),
                logo);
    }

    private Integer intOrNull(JsonNode n) {
        return (n.isNull() || n.isMissingNode() || n.asText().isBlank())
                ? null : (int) n.asDouble();
    }

    private String textOrNull(JsonNode n) {
        return (n == null || n.isNull() || n.isMissingNode()) ? null : n.asText();
    }

    private String first(String... vals) {
        for (String v : vals) if (v != null && !v.isBlank()) return v;
        return null;
    }
}