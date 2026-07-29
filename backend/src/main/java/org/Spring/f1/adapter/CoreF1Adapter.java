package org.Spring.f1.adapter;

import java.util.ArrayList;
import java.util.Comparator;
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
// F1 isn't team-vs-team, so we fold a whole GP weekend into one Match for the
// live pipeline: pick a representative session (in-progress, else next up, else
// last done), then put P1 as homeTeam and P2 as awayTeam with their names in the
// score-display fields. Keeps F1 on the same Match shape as every other sport, so
// the Event Hub -> SignalR path needs no special-casing.
@Component
public class CoreF1Adapter implements ScoreboardAdapter {


    @Override
    public List<Match> toMatches(JsonNode root, String leagueName) throws Exception {
        List<Match> matches = new ArrayList<>();
        for (JsonNode event : root.path("events")) {
            Match m = toMatch(event);
            if (m != null) matches.add(m);
        }
        return matches;
    }

    // Addressed: ESPN IDs validated as non-null digit strings before parsing,
    // so missing or malformed IDs return null instead of silently becoming 0.
    private Match toMatch(JsonNode event) {
        Integer id = parseId(event.path("id"));
        if (id == null) return null;
        JsonNode sessions = event.path("competitions");
        if (!sessions.isArray() || sessions.isEmpty()) return null;

        JsonNode session = representativeSession(sessions);
        if (session == null) return null;

        JsonNode statusType = session.path("status").path("type");
        String state = statusType.path("state").asText("");
        String name  = statusType.path("name").asText("");

        String status = mapStatus(state, name);

        String sessionLabel = sessionLabel(session);
        String detail = first(
                textOrNull(statusType.path("shortDetail")),
                textOrNull(statusType.path("detail")),
                state);
        String statusDetail = sessionLabel + (detail != null ? " - " + detail : "");

        String date = first(textOrNull(session.path("date")),
                            textOrNull(event.path("date")), null);

        String competition = first(
                textOrNull(event.path("name")),
                textOrNull(event.path("shortName")),
                textOrNull(event.path("circuit").path("fullName")),
                "Formula 1");

        // Rank drivers in this session by "order" (1 = leader).
        List<JsonNode> drivers = new ArrayList<>();
        for (JsonNode c : session.path("competitors")) drivers.add(c);
        drivers.sort((a, b) -> Integer.compare(
                a.path("order").asInt(999), b.path("order").asInt(999)));

        Team p1 = drivers.size() > 0 ? toDriver(drivers.get(0)) : null;
        Team p2 = drivers.size() > 1 ? toDriver(drivers.get(1)) : null;

        String p1Display = p1 != null ? "P1 " + p1.name() : null;
        String p2Display = p2 != null ? "P2 " + p2.name() : null;

        return new Match(
                id, "f1", status,
                null,            // elapsed
                null,            // clock
                null,            // period
                statusDetail,
                date,
                competition,
                p1, p2,
                null, null,      // no numeric score for F1
                p1Display, p2Display,
                List.<MatchEvent>of());
    }

    // Addressed: representative session selection now sorts by scheduled date instead of
    // relying on ESPN's response ordering — earliest upcoming and latest completed.
    /** Returns: in-progress > earliest upcoming > latest completed. */
    private JsonNode representativeSession(JsonNode sessions) {

        JsonNode inProgress = null;
        List<JsonNode> upcoming = new ArrayList<>();
        List<JsonNode> completed = new ArrayList<>();

        for (JsonNode s : sessions) {
            String state = s.path("status").path("type").path("state").asText("");

            switch (state) {
                case "in" -> {
                    if (inProgress == null) {
                        inProgress = s;
                    }
                }
                case "pre" -> upcoming.add(s);
                case "post" -> completed.add(s);
                default -> { }
            }
        }

        if (inProgress != null) {
            return inProgress;
        }

        if (!upcoming.isEmpty()) {
            upcoming.sort(Comparator.comparing(
                    s -> textOrNull(s.path("date")),
                    Comparator.nullsLast(String::compareTo)
            ));
            return upcoming.get(0);
        }

        if (!completed.isEmpty()) {
            completed.sort(Comparator.comparing(
                    (JsonNode s) -> textOrNull(s.path("date")),
                    Comparator.nullsLast(String::compareTo)
            ).reversed());
            return completed.get(0);
        }

        return sessions.has(0) ? sessions.get(0) : null;
    }

    private String sessionLabel(JsonNode session) {
        return first(
                textOrNull(session.path("type").path("text")),
                textOrNull(session.path("type").path("abbreviation")),
                textOrNull(session.path("name")),
                "Session");
    }

    private String mapStatus(String state, String name) {
        if ("in".equals(state))   return "LIVE";
        if ("post".equals(state)) {
            if (name.contains("CANCEL"))  return "Canceled";
            if (name.contains("POSTPON")) return "Postponed";
            return "FT";
        }
        if (name.contains("CANCEL"))  return "Canceled";
        if (name.contains("POSTPON")) return "Postponed";
        return "Scheduled";
    }

    /** Driver mapped onto the Team shape: id, full name, country (flag alt), flag image. */
    private Team toDriver(JsonNode competitor) {
        JsonNode athlete = competitor.path("athlete");
        Integer id = parseId(athlete.path("id"));
        if (id == null) id = parseId(competitor.path("id"));
        String name = first(
                textOrNull(athlete.path("fullName")),
                textOrNull(athlete.path("displayName")),
                textOrNull(competitor.path("displayName")),
                "Driver");
        String country = first(
                textOrNull(athlete.path("flag").path("alt")),
                textOrNull(competitor.path("flag").path("alt")),
                null);
        String flag = first(
                textOrNull(athlete.path("flag").path("href")),
                textOrNull(competitor.path("flag").path("href")),
                null);
        return new Team(id, name, country, flag);
    }

    private String textOrNull(JsonNode n) {
        return (n == null || n.isNull() || n.isMissingNode()) ? null : n.asText();
    }

    private String first(String... vals) {
        for (String v : vals) if (v != null && !v.isBlank()) return v;
        return null;
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
}