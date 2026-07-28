package org.Spring.basketball.adapter;

import java.util.ArrayList;
import java.util.List;

import org.Spring.adapter.ScoreboardAdapter;
import org.Spring.model.Match;
import org.Spring.model.MatchEvent;
import org.Spring.model.Team;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;

// Addressed: removed per-class ObjectMapper — now implements ScoreboardAdapter and works
// directly with JsonNode passed in, keeping JSON behavior consistent across adapters.
//
// Maps ESPN's basketball scoreboard into our Match model.
// Live status is period-aware: HT, Q1-Q4, then OT for period 5+.
@Component
public class CoreBasketballAdapter implements ScoreboardAdapter {

    @Override
    public List<Match> toMatches(JsonNode root, String leagueName) throws Exception {
        List<Match> matches = new ArrayList<>();
        for (JsonNode event : root.path("events")) {
            Match m = toMatch(event);
            if (m != null) matches.add(m);
        }
        return matches;
    }

    private Match toMatch(JsonNode event) {
        // Addressed: ESPN match IDs are validated as non-null digit strings before parsing,
        // so missing or malformed IDs return null instead of silently becoming 0.
        Integer id = parseId(event.path("id"));
        if (id == null) return null;
        JsonNode comp = event.path("competitions").path(0);
        if (comp.isMissingNode()) return null;

        JsonNode statusNode = comp.path("status");
        JsonNode statusType = statusNode.path("type");

        int    period = statusNode.path("period").canConvertToInt()
                      ? statusNode.path("period").asInt() : 0;
        String state  = statusType.path("state").asText("");
        String name   = statusType.path("name").asText("");

        String status      = mapStatus(state, name, period);
        boolean inPlay     = isInPlay(status);
        String  clock      = inPlay ? textOrNull(statusNode.path("displayClock")) : null;
        Integer periodOut  = (inPlay && period > 0) ? period : null;
        String  statusDetail = first(
                textOrNull(statusType.path("shortDetail")),
                textOrNull(statusType.path("detail")),
                status);

        String tipoff      = textOrNull(event.path("date"));
        String competition = first(
                textOrNull(comp.path("league").path("name")),
                textOrNull(event.path("league").path("name")),
                "Basketball");

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
                id, "basketball", status,
                null,          // elapsed - football only
                clock,
                periodOut,
                statusDetail,
                tipoff,
                competition,
                home, away,
                homeScore, awayScore,
                null, null,    // score display strings - used by cricket
                List.<MatchEvent>of());
    }

    // Collapse ESPN state/name/period into our status vocabulary.
    private String mapStatus(String state, String name, int period) {
        if ("in".equals(state)) {
            if (name.contains("HALFTIME")) return "HT";
                        if (period >= 5) return "OT";
            return switch (period) {
                case 1  -> "Q1";
                case 2  -> "Q2";
                case 3  -> "Q3";
                case 4  -> "Q4";
                default -> "LIVE"; // fallback if period not set
            };
        }
        if ("post".equals(state)) {
            if (name.contains("CANCEL"))   return "Canceled";
            if (name.contains("POSTPON"))  return "Postponed";
                        if (name.contains("OT") || name.contains("OVERTIME")) return "FT-OT";
            return "FT";
        }
        // pre
        if (name.contains("CANCEL"))  return "Canceled";
        if (name.contains("POSTPON")) return "Postponed";
        if (name.contains("TBD"))     return "TBD";
        return "Scheduled";
    }

    private boolean isInPlay(String status) {
        return switch (status) {
            case "LIVE", "HT", "Q1", "Q2", "Q3", "Q4", "OT" -> true;
            default -> false;
        };
    }

    private Team toTeam(JsonNode t) {
        String logo = first(
                textOrNull(t.path("logo")),
                textOrNull(t.path("logos").path(0).path("href")),
                null);
        return new Team(
                parseId(t.path("id")),
                first(textOrNull(t.path("displayName")), textOrNull(t.path("name")), null),
                first(textOrNull(t.path("abbreviation")), textOrNull(t.path("shortDisplayName")), null),
                logo);
    }

    private Integer intOrNull(JsonNode n) {
        return (n.isNull() || n.isMissingNode() || n.asText().isBlank())
                ? null : (int) n.asDouble();
    }

    // Validates an ESPN id field is present and numeric before parsing it, so a
    // missing/non-numeric id comes through as null instead of silently becoming 0.
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
        return (n == null || n.isNull() || n.isMissingNode()) ? null : n.asText();
    }

    private String first(String... vals) {
        for (String v : vals) if (v != null && !v.isBlank()) return v;
        return null;
    }
}