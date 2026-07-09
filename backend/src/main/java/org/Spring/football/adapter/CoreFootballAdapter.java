package org.Spring.football.adapter;

import java.util.ArrayList;
import java.util.List;

import org.Spring.model.Match;
import org.Spring.model.MatchEvent;
import org.Spring.model.Team;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

// Maps ESPN's soccer scoreboard (events -> competitions[0] -> competitors[] + details[]) into the unified Match model.
public class CoreFootballAdapter {

    private final ObjectMapper mapper = new ObjectMapper();

    public List<Match> toMatches(String json) throws Exception {
        return toMatches(json, null);
    }

    // friendlyName comes from the fetcher's LEAGUES map and is used when ESPN omits
    // league.name, so cards don't fall back to "Unknown" over SignalR.
    public List<Match> toMatches(String json, String friendlyName) throws Exception {
        JsonNode root = mapper.readTree(json);
        List<Match> matches = new ArrayList<>();
        for (JsonNode event : root.path("events")) {
            matches.add(toMatch(event, friendlyName));
        }
        return matches;
    }

    private Match toMatch(JsonNode event, String friendlyName) {
        int id = event.path("id").asInt();
        JsonNode comp = event.path("competitions").path(0);

        // status.type.state ("pre"/"in"/"post") is the reliable signal; .detail holds
        // the kickoff date for unplayed games, so don't read status off that.
        JsonNode statusNode = comp.path("status");
        JsonNode statusType = statusNode.path("type");
        String status = mapStatus(statusType);

        Integer elapsed = ("LIVE".equals(status) || "HT".equals(status))
                ? liveMinute(statusNode)
                : null;

        String kickoff = textOrNull(event.path("date"));
        JsonNode leagueNode = comp.path("league");
        String competition = textOrNull(leagueNode.path("name"));
        if (competition == null) competition = textOrNull(event.path("league").path("name"));
        if (competition == null) competition = friendlyName != null ? friendlyName : "Unknown";

        Team home = null, away = null;
        Integer homeScore = null, awayScore = null;
        for (JsonNode c : comp.path("competitors")) {
            Team team = toTeam(c.path("team"));
            Integer score = intOrNull(c.path("score"));
            if ("home".equals(c.path("homeAway").asText())) {
                home = team;
                homeScore = score;
            } else {
                away = team;
                awayScore = score;
            }
        }

        List<MatchEvent> events = toEvents(comp.path("details"));

        return new Match(id, status, elapsed, kickoff, competition,
                home, away, homeScore, awayScore, events);
    }

    // Collapse ESPN's status into the small vocabulary the pipeline groups on.
    private String mapStatus(JsonNode type) {
        String state = type.path("state").asText("");
        String name = type.path("name").asText("");

        if ("in".equals(state)) {
            return name.contains("HALFTIME") ? "HT" : "LIVE";
        }
        if ("post".equals(state)) {
            if (name.contains("PEN")) return "FT-Pens";
            if (name.contains("CANCEL")) return "Canceled";
            if (name.contains("POSTPON")) return "Postponed";
            return "FT";
        }
        if (name.contains("CANCEL")) return "Canceled";
        if (name.contains("POSTPON")) return "Postponed";
        if (name.contains("TBD")) return "TBD";
        return "Scheduled";
    }

    private Integer liveMinute(JsonNode statusNode) {
        int m = parseMinute(statusNode.path("displayClock").asText(""));
        return m > 0 ? m : null;
    }

    private Team toTeam(JsonNode t) {
        return new Team(
                t.path("id").asInt(),
                textOrNull(t.path("displayName")),
                textOrNull(t.path("abbreviation")),
                textOrNull(t.path("logo")));
    }

    private List<MatchEvent> toEvents(JsonNode details) {
        List<MatchEvent> events = new ArrayList<>();
        for (JsonNode d : details) {
            int minute = parseMinute(d.path("clock").path("displayValue").asText(""));
            String typeText = d.path("type").path("text").asText("");
            String type = mapType(typeText, d);
            String player = null;
            JsonNode athletes = d.path("athletesInvolved");
            if (athletes.isArray() && athletes.size() > 0) {
                player = textOrNull(athletes.path(0).path("displayName"));
            }
            // this provider only lists the scorer in details, never the assist
            int teamId = d.path("team").path("id").asInt();
            events.add(new MatchEvent(minute, type, typeText, player, null, teamId));
        }
        return events;
    }

    private String mapType(String text, JsonNode d) {
        String t = text.toLowerCase();
        if (d.path("scoringPlay").asBoolean(false) || t.contains("goal")) return "goal";
        if (d.path("redCard").asBoolean(false)) return "card";
        if (d.path("yellowCard").asBoolean(false)) return "card";
        if (t.contains("card")) return "card";
        return t;
    }

    // "33'" -> 33, "90'+6'" -> 90
    private int parseMinute(String display) {
        if (display == null || display.isBlank()) return 0;
        String digits = display.replaceAll("[^0-9].*$", "");
        try {
            return Integer.parseInt(digits);
        } catch (Exception e) {
            return 0;
        }
    }

    private Integer intOrNull(JsonNode n) {
        return (n.isNull() || n.isMissingNode() || n.asText().isBlank()) ? null : n.asInt();
    }

    private String textOrNull(JsonNode n) {
        return (n.isNull() || n.isMissingNode()) ? null : n.asText();
    }
}
