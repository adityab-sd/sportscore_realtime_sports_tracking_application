package org.Spring.football.adapter;

import java.util.ArrayList;
import java.util.List;

import org.Spring.adapter.ScoreboardAdapter;
import org.Spring.model.Match;
import org.Spring.model.MatchEvent;
import org.Spring.model.Team;

import com.fasterxml.jackson.databind.JsonNode;

import org.springframework.stereotype.Component;

// Maps ESPN's soccer scoreboard (events -> competitions[0] -> competitors[] + details[]) into the unified Match model.
@Component
// ============================================================================
// PLEASE review — Adapter (GoF)   [you are already doing this — formalize it]
// ----------------------------------------------------------------------------
// These *Adapter classes correctly translate ESPN's wire JSON into our own Match
// model — that IS the Adapter pattern. The gap: callers do `new CoreFootballAdapter()`,
// so the provider is hard-wired and cannot be swapped or mocked. Extract the role
// into an interface OUR domain owns:
//
// EXAMPLE:
//   public interface ScoreboardAdapter {                 // target interface WE own
//       List<Match> toMatches(String providerJson, String friendlyName);
//   }
//   class EspnFootballAdapter implements ScoreboardAdapter { ... }
//   // A future Opta / Sportradar feed = a new adapter, and nothing else changes.
//
// WHY: isolates the core from third-party formats we don't control, and lets tests
// feed canned JSON without hitting the network.
// UPDATE
// Refactored to implement the shared ScoreboardAdapter interface, decoupling
// fetchers from the ESPN-specific implementation and standardizing the adapter contract.
// ============================================================================
public class CoreFootballAdapter implements ScoreboardAdapter {


    // friendlyName comes from the fetcher's LEAGUES map and is used when ESPN omits
    // league.name, so cards don't fall back to "Unknown" over SignalR.
    @Override
    public List<Match> toMatches(JsonNode root, String friendlyName) throws Exception {
        List<Match> matches = new ArrayList<>();
        for (JsonNode event : root.path("events")) {
            Match m = toMatch(event, friendlyName);
            if (m != null) matches.add(m);
        }
        return matches;
    }

    // PLEASE review — unchecked JsonNode numeric coercion: missing/non-numeric ESPN ids become 0 and
    // can collapse distinct matches. Same fix as CoreBaseballAdapter, applied here for consistency.
    private Match toMatch(JsonNode event, String friendlyName) {
        Integer id = parseId(event.path("id"));
        if (id == null) return null;

        JsonNode comp = event.path("competitions").path(0);
        if (comp.isMissingNode()) return null;

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

    // ------------------------------------------------------------------------
    // PLEASE review — judgement note: do NOT reach for the State pattern here.
    // mapStatus() can look like a State candidate, but State is for objects whose
    // BEHAVIOUR changes across a lifecycle — this is a pure value lookup. A switch
    // (or a small map) is clearer; State here would be over-engineering.
    //
    // EXAMPLE — a lookup table is enough:
    //   private static final Map<String,String> STATE = Map.of("in","LIVE","post","FT");
    // UPDATE
    // Status mapping is intentionally kept as a simple lookup/switch since it is
    // value translation rather than behavior that changes over an object's lifecyclE
    // ------------------------------------------------------------------------
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
                parseId(t.path("id")),
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
            Integer teamId = parseId(d.path("team").path("id"));
            events.add(new MatchEvent(minute, type, typeText, player, null, teamId));
        }
        return events;
    }

    private String mapType(String text, JsonNode d) {
        String t = text.toLowerCase();
        if (d.path("ownGoal").asBoolean(false)) return "OWN_GOAL";
        if (d.path("scoringPlay").asBoolean(false) || t.contains("goal")) return "GOAL";
        if (d.path("redCard").asBoolean(false) || t.contains("red card")) return "RED_CARD";
        if (d.path("yellowCard").asBoolean(false) || t.contains("yellow card")) return "YELLOW_CARD";
        if (t.contains("substitution")) return "SUBSTITUTION";
        if (t.contains("penalty") && t.contains("miss")) return "PENALTY_MISSED";
        if (t.contains("penalty")) return "PENALTY_SCORED";
        if (t.contains("var")) return "VAR_REVIEW";
        return t; // unrecognized ESPN text still falls to CommentaryService's default template
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

    // Validates an ESPN id field is present and numeric before parsing it, so a
    // missing/non-numeric id comes through as null instead of silently becoming 0
    // (which could collapse two distinct matches/teams into the same id).
    private Integer parseId(JsonNode idNode) {
        String text = textOrNull(idNode);
        if (text == null || !text.matches("\\d+")) return null;
        try {
            return Integer.parseInt(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String textOrNull(JsonNode n) {
        return (n.isNull() || n.isMissingNode()) ? null : n.asText();
    }
}