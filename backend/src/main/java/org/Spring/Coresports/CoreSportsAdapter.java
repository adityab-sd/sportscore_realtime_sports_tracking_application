package org.Spring.Coresports;

import java.util.ArrayList;
import java.util.List;

import org.Spring.model.Match;
import org.Spring.model.MatchEvent;
import org.Spring.model.Team;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Adapter for the Core Sports football provider.
 * Maps its scoreboard response into the unified Match model.
 * Shape: events[] -> competitions[0] -> competitors[] (teams) + details[]
 * (events).
 */
public class CoreSportsAdapter {

    private final ObjectMapper mapper = new ObjectMapper();

    public List<Match> toMatches(String json) throws Exception {
        return toMatches(json, null);
    }

    /**
     * @param friendlyName Known league name from the LEAGUES map (e.g. "Premier League").
     *                     Used as a guaranteed fallback when ESPN's JSON omits league.name,
     *                     which fixes match cards showing "Football" or "Unknown" via SignalR.
     */
    public List<Match> toMatches(String json, String friendlyName) throws Exception {
        JsonNode root = mapper.readTree(json);
        List<Match> matches = new ArrayList<>();
        for (JsonNode event : root.path("events")) {
            matches.add(toMatch(event, friendlyName));
        }
        return matches;
    }

    private Match toMatch(JsonNode event) {
        return toMatch(event, null);
    }

    private Match toMatch(JsonNode event, String friendlyName) {
        int id = event.path("id").asInt();
        JsonNode comp = event.path("competitions").path(0);

        // The reliable signal is status.type.state ("pre" | "in" | "post"),
        // NOT status.type.detail (which holds the kickoff date for unplayed games).
        JsonNode statusNode = comp.path("status");
        JsonNode statusType = statusNode.path("type");
        String status = mapStatus(statusType);

        // Real match minute only exists while a game is in progress.
        Integer elapsed = ("LIVE".equals(status) || "HT".equals(status))
                ? liveMinute(statusNode)
                : null;

        String kickoff = textOrNull(event.path("date"));
        JsonNode leagueNode = event.path("competitions").path(0).path("league");
        String competition = textOrNull(leagueNode.path("name"));
        if (competition == null) competition = textOrNull(event.path("league").path("name"));
        // FIX (Issue 2): use the known friendly name from the LEAGUES map as a reliable
        // fallback instead of "Unknown", so match cards via SignalR show the real league name.
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

    /**
     * Turns ESPN's status.type into a small, reliable vocabulary the rest of
     * the system can group on: LIVE, HT, FT, FT-Pens, Scheduled, TBD,
     * Canceled, Postponed.
     */
    private String mapStatus(JsonNode type) {
        String state = type.path("state").asText("");   // pre | in | post
        String name = type.path("name").asText("");      // STATUS_*

        if ("in".equals(state)) {
            return name.contains("HALFTIME") ? "HT" : "LIVE";
        }
        if ("post".equals(state)) {
            if (name.contains("PEN")) return "FT-Pens";
            if (name.contains("CANCEL")) return "Canceled";
            if (name.contains("POSTPON")) return "Postponed";
            return "FT";
        }
        // state == "pre" (or unknown) -> not started yet
        if (name.contains("CANCEL")) return "Canceled";
        if (name.contains("POSTPON")) return "Postponed";
        if (name.contains("TBD")) return "TBD";
        return "Scheduled";
    }

    /** Parses the live minute from displayClock (e.g. "67'") into 67. */
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

    /** Maps the details[] array (goals, cards) into MatchEvent records. */
    private List<MatchEvent> toEvents(JsonNode details) {
        List<MatchEvent> events = new ArrayList<>();
        for (JsonNode d : details) {
            int minute = parseMinute(d.path("clock").path("displayValue").asText(""));
            String typeText = d.path("type").path("text").asText("");
            String type = mapType(typeText, d);
            String detail = typeText;
            String player = null;
            JsonNode athletes = d.path("athletesInvolved");
            if (athletes.isArray() && athletes.size() > 0) {
                player = textOrNull(athletes.path(0).path("displayName"));
            }
            String assist = null; // this provider lists the scorer in details, not the assist
            int teamId = d.path("team").path("id").asInt();
            events.add(new MatchEvent(minute, type, detail, player, assist, teamId));
        }
        return events;
    }

    /** Turns this provider's event text into our lowercase types. */
    private String mapType(String text, JsonNode d) {
        String t = text.toLowerCase();
        if (d.path("scoringPlay").asBoolean(false) || t.contains("goal"))
            return "goal";
        if (d.path("redCard").asBoolean(false))
            return "card";
        if (d.path("yellowCard").asBoolean(false))
            return "card";
        if (t.contains("card"))
            return "card";
        return t;
    }

    /** "33'" -> 33, "90'+6'" -> 90. */
    private int parseMinute(String display) {
        if (display == null || display.isBlank())
            return 0;
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