package org.Spring.football.adapter;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.Spring.model.Match;
import org.Spring.model.MatchEvent;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CoreFootballAdapterTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final CoreFootballAdapter adapter = new CoreFootballAdapter();

    private JsonNode json(String s) throws Exception {
        return mapper.readTree(s);
    }

    // ---------------------------------------------------------------
    // toMatches() — envelope-level behavior
    // ---------------------------------------------------------------

    @Test
    void toMatches_missingEventsNode_returnsEmptyList() throws Exception {
        assertTrue(adapter.toMatches(json("{}"), "Premier League").isEmpty());
    }

    @Test
    void toMatches_emptyEventsArray_returnsEmptyList() throws Exception {
        assertTrue(adapter.toMatches(json("{\"events\":[]}"), "Premier League").isEmpty());
    }

    @Test
    void toMatches_dropsInvalidEvents_keepsValidOnes() throws Exception {
        String bad = event(null, "in", "STATUS_IN_PROGRESS", "45'", null);
        String good = event("612345", "in", "STATUS_IN_PROGRESS", "45'", null);
        JsonNode root = json("{\"events\":[" + bad + "," + good + "]}");
        assertEquals(1, adapter.toMatches(root, "Premier League").size());
    }

    // ---------------------------------------------------------------
    // id / competitions validation
    // ---------------------------------------------------------------

    @Test
    void toMatch_missingId_isSkipped() throws Exception {
        JsonNode root = json("{\"events\":[" + event(null, "pre", "STATUS_SCHEDULED", "", null) + "]}");
        assertTrue(adapter.toMatches(root, "Premier League").isEmpty());
    }

    @Test
    void toMatch_nonNumericId_isSkipped() throws Exception {
        JsonNode root = json("{\"events\":[" + event("not-a-number", "pre", "STATUS_SCHEDULED", "", null) + "]}");
        assertTrue(adapter.toMatches(root, "Premier League").isEmpty(),
                "non-numeric id must not silently coerce to 0 and collide with a real match");
    }

    @Test
    void toMatch_missingCompetitions_isSkipped() throws Exception {
        assertTrue(adapter.toMatches(json("{\"events\":[{\"id\":\"1\"}]}"), "Premier League").isEmpty());
    }

    // ---------------------------------------------------------------
    // legacy constructor mapping (Match's 10-arg overload)
    // ---------------------------------------------------------------

    @Test
    void match_usesLegacyConstructor_populatesSportAndStatusDetailImplicitly() throws Exception {
        Match m = firstMatch(event("1", "in", "STATUS_IN_PROGRESS", "45'", null));
        assertEquals("football", m.sport());
        assertNull(m.clock(), "football adapter's legacy constructor doesn't set clock");
        assertNull(m.period(), "football adapter's legacy constructor doesn't set period");
        assertEquals(m.status(), m.statusDetail(), "legacy constructor mirrors status into statusDetail");
    }

    // ---------------------------------------------------------------
    // status mapping
    // ---------------------------------------------------------------

    @Test
    void status_inProgress_mapsToLIVE() throws Exception {
        assertEquals("LIVE", firstMatch(event("1", "in", "STATUS_IN_PROGRESS", "45'", null)).status());
    }

    @Test
    void status_halftime_mapsToHT() throws Exception {
        assertEquals("HT", firstMatch(event("1", "in", "STATUS_HALFTIME", "", null)).status());
    }

    @Test
    void status_post_plain_mapsToFT() throws Exception {
        assertEquals("FT", firstMatch(event("1", "post", "STATUS_FULL_TIME", "", null)).status());
    }

    @Test
    void status_post_penalties_mapsToFTPens() throws Exception {
        assertEquals("FT-Pens", firstMatch(event("1", "post", "STATUS_FINAL_PEN", "", null)).status());
    }

    @Test
    void status_post_canceled() throws Exception {
        assertEquals("Canceled", firstMatch(event("1", "post", "STATUS_CANCELED", "", null)).status());
    }

    @Test
    void status_post_postponed() throws Exception {
        assertEquals("Postponed", firstMatch(event("1", "post", "STATUS_POSTPONED", "", null)).status());
    }

    @Test
    void status_pre_canceled_postponed_tbd() throws Exception {
        assertEquals("Canceled", firstMatch(event("1", "pre", "STATUS_CANCELED", "", null)).status());
        assertEquals("Postponed", firstMatch(event("1", "pre", "STATUS_POSTPONED", "", null)).status());
        assertEquals("TBD", firstMatch(event("1", "pre", "STATUS_TBD", "", null)).status());
    }

    @Test
    void status_pre_default_mapsToScheduled() throws Exception {
        assertEquals("Scheduled", firstMatch(event("1", "pre", "STATUS_SCHEDULED", "", null)).status());
    }

    @Test
    void status_unknownState_fallsThroughToScheduled() throws Exception {
        assertEquals("Scheduled", firstMatch(event("1", "mystery", "STATUS_ODD", "", null)).status());
    }

    // ---------------------------------------------------------------
    // elapsed minute — only computed for LIVE/HT, and clock-string parsing
    // ---------------------------------------------------------------

    @Test
    void elapsed_populatedForLiveMatch() throws Exception {
        Match m = firstMatch(event("1", "in", "STATUS_IN_PROGRESS", "33'", null));
        assertEquals(33, m.elapsed());
    }

    @Test
    void elapsed_handlesStoppageTimeFormat() throws Exception {
        // "90'+6'" -> should extract the base minute (90), not the stoppage add-on
        Match m = firstMatch(event("1", "in", "STATUS_IN_PROGRESS", "90'+6'", null));
        assertEquals(90, m.elapsed());
    }

    @Test
    void elapsed_nullWhenClockIsZeroOrBlank() throws Exception {
        Match m = firstMatch(event("1", "in", "STATUS_IN_PROGRESS", "", null));
        assertNull(m.elapsed());
    }

    @Test
    void elapsed_nullWhenNotLiveOrHalftime_evenIfClockPresent() throws Exception {
        // finished games can carry a stale displayClock; must not leak through
        Match m = firstMatch(event("1", "post", "STATUS_FULL_TIME", "90'", null));
        assertNull(m.elapsed());
    }

    @Test
    void elapsed_nullForGarbageClockString() throws Exception {
        Match m = firstMatch(event("1", "in", "STATUS_IN_PROGRESS", "TBD", null));
        assertNull(m.elapsed());
    }

    // ---------------------------------------------------------------
    // competition fallback chain: competition.league.name -> event.league.name -> friendlyName -> "Unknown"
    // ---------------------------------------------------------------

    @Test
    void competition_prefersCompetitionLevelLeagueName() throws Exception {
        String ev = "{\"id\":\"1\",\"date\":\"2026-07-24T20:00Z\",\"competitions\":[{"
                + "\"league\":{\"name\":\"UEFA Champions League\"},"
                + "\"status\":{\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":[" + competitor("home", "1", "Team A", null) + "," + competitor("away", "2", "Team B", null) + "],"
                + "\"details\":[]}],\"league\":{\"name\":\"fallback\"}}";
        assertEquals("UEFA Champions League", firstMatch(ev, "Friendly Name").competition());
    }

    @Test
    void competition_fallsBackToEventLeagueName() throws Exception {
        String ev = "{\"id\":\"1\",\"date\":\"2026-07-24T20:00Z\",\"competitions\":[{"
                + "\"status\":{\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":[" + competitor("home", "1", "Team A", null) + "," + competitor("away", "2", "Team B", null) + "],"
                + "\"details\":[]}],\"league\":{\"name\":\"Event Level League\"}}";
        assertEquals("Event Level League", firstMatch(ev, "Friendly Name").competition());
    }

    @Test
    void competition_fallsBackToFriendlyName_thenUnknown() throws Exception {
        String ev = "{\"id\":\"1\",\"date\":\"2026-07-24T20:00Z\",\"competitions\":[{"
                + "\"status\":{\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":[" + competitor("home", "1", "Team A", null) + "," + competitor("away", "2", "Team B", null) + "],"
                + "\"details\":[]}]}";
        assertEquals("International Friendly", firstMatch(ev, "International Friendly").competition());

        JsonNode root = json("{\"events\":[" + ev + "]}");
        Match noFriendlyName = adapter.toMatches(root, null).get(0);
        assertEquals("Unknown", noFriendlyName.competition());
    }

    // ---------------------------------------------------------------
    // teams / scores
    // ---------------------------------------------------------------

    @Test
    void homeAndAway_assignedByHomeAwayField_notArrayOrder() throws Exception {
        String ev = event("1", "pre", "STATUS_SCHEDULED", "", null,
                competitor("away", "2", "Real Madrid", null) + "," + competitor("home", "1", "Barcelona", null));
        Match m = firstMatch(ev);
        assertEquals("Barcelona", m.homeTeam().name());
        assertEquals("Real Madrid", m.awayTeam().name());
    }

    @Test
    void score_missingOrBlank_mapsToNull() throws Exception {
        String ev = "{\"id\":\"1\",\"date\":\"2026-07-24T20:00Z\",\"competitions\":[{"
                + "\"status\":{\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":["
                + "{\"homeAway\":\"home\",\"team\":{\"id\":\"1\",\"displayName\":\"Barcelona\"}},"
                + "{\"homeAway\":\"away\",\"team\":{\"id\":\"2\",\"displayName\":\"Real Madrid\"},\"score\":\"\"}"
                + "],\"details\":[]}]}";
        Match m = firstMatch(ev);
        assertNull(m.homeScore());
        assertNull(m.awayScore());
    }

    @Test
    void teamId_nonNumeric_mapsToNull() throws Exception {
        String ev = "{\"id\":\"1\",\"date\":\"2026-07-24T20:00Z\",\"competitions\":[{"
                + "\"status\":{\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":["
                + "{\"homeAway\":\"home\",\"team\":{\"id\":\"xx\",\"displayName\":\"Barcelona\"},\"score\":\"1\"},"
                + "{\"homeAway\":\"away\",\"team\":{\"id\":\"2\",\"displayName\":\"Real Madrid\"},\"score\":\"2\"}"
                + "],\"details\":[]}]}";
        assertNull(firstMatch(ev).homeTeam().id());
    }

    // ---------------------------------------------------------------
    // match events (goals, cards)
    // ---------------------------------------------------------------

    @Test
    void events_scoringPlayFlag_mapsToGoal() throws Exception {
        Match m = firstMatchWithDetail(
                "{\"clock\":{\"displayValue\":\"23'\"},\"type\":{\"text\":\"Header\"},\"scoringPlay\":true,"
                        + "\"team\":{\"id\":\"1\"},\"athletesInvolved\":[{\"displayName\":\"L. Messi\"}]}");
        MatchEvent evt = m.events().get(0);
        assertEquals("goal", evt.type());
        assertEquals("Header", evt.detail());
        assertEquals(23, evt.minute());
        assertEquals("L. Messi", evt.player());
        assertEquals(1, evt.teamId());
        assertNull(evt.assist(), "adapter never populates assist - only scorer is available");
    }

    @Test
    void events_textContainsGoal_mapsToGoal_evenWithoutFlag() throws Exception {
        Match m = firstMatchWithDetail(
                "{\"clock\":{\"displayValue\":\"10'\"},\"type\":{\"text\":\"Goal - Penalty\"},"
                        + "\"team\":{\"id\":\"1\"},\"athletesInvolved\":[]}");
        assertEquals("goal", m.events().get(0).type());
    }

    @Test
    void events_redCardFlag_mapsToCard() throws Exception {
        Match m = firstMatchWithDetail(
                "{\"clock\":{\"displayValue\":\"80'\"},\"type\":{\"text\":\"Second Yellow Card\"},\"redCard\":true,"
                        + "\"team\":{\"id\":\"2\"},\"athletesInvolved\":[]}");
        assertEquals("card", m.events().get(0).type());
    }

    @Test
    void events_yellowCardFlag_mapsToCard() throws Exception {
        Match m = firstMatchWithDetail(
                "{\"clock\":{\"displayValue\":\"55'\"},\"type\":{\"text\":\"Caution\"},\"yellowCard\":true,"
                        + "\"team\":{\"id\":\"2\"},\"athletesInvolved\":[]}");
        assertEquals("card", m.events().get(0).type());
    }

    @Test
    void events_unrecognizedType_fallsBackToLowercasedText() throws Exception {
        Match m = firstMatchWithDetail(
                "{\"clock\":{\"displayValue\":\"60'\"},\"type\":{\"text\":\"Substitution\"},"
                        + "\"team\":{\"id\":\"1\"},\"athletesInvolved\":[]}");
        assertEquals("substitution", m.events().get(0).type());
    }

    @Test
    void events_noAthletesInvolved_playerIsNull() throws Exception {
        Match m = firstMatchWithDetail(
                "{\"clock\":{\"displayValue\":\"60'\"},\"type\":{\"text\":\"Substitution\"},"
                        + "\"team\":{\"id\":\"1\"},\"athletesInvolved\":[]}");
        assertNull(m.events().get(0).player());
    }

    @Test
    void events_missingDetailsArray_producesEmptyEventsList() throws Exception {
        String ev = "{\"id\":\"1\",\"date\":\"2026-07-24T20:00Z\",\"competitions\":[{"
                + "\"status\":{\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":[" + competitor("home", "1", "A", null) + "," + competitor("away", "2", "B", null) + "]}]}";
        assertTrue(firstMatch(ev).events().isEmpty());
    }

    // ---------------------------------------------------------------
    // helpers
    // ---------------------------------------------------------------

    private Match firstMatch(String eventJson) throws Exception {
        return firstMatch(eventJson, "Test League");
    }

    private Match firstMatch(String eventJson, String friendlyName) throws Exception {
        JsonNode root = json("{\"events\":[" + eventJson + "]}");
        List<Match> matches = adapter.toMatches(root, friendlyName);
        assertEquals(1, matches.size(), "expected exactly one match to be produced");
        return matches.get(0);
    }

    private Match firstMatchWithDetail(String detailJson) throws Exception {
        String ev = "{\"id\":\"1\",\"date\":\"2026-07-24T20:00Z\",\"competitions\":[{"
                + "\"status\":{\"type\":{\"state\":\"in\",\"name\":\"STATUS_IN_PROGRESS\"}},"
                + "\"competitors\":[" + competitor("home", "1", "A", null) + "," + competitor("away", "2", "B", null) + "],"
                + "\"details\":[" + detailJson + "]}]}";
        return firstMatch(ev);
    }

    private String competitor(String homeAway, String id, String name, String score) {
        String scoreField = score == null ? "" : ",\"score\":\"" + score + "\"";
        return "{\"homeAway\":\"" + homeAway + "\",\"team\":{\"id\":\"" + id + "\",\"displayName\":\"" + name + "\"}" + scoreField + "}";
    }

    private String event(String id, String state, String name, String displayClock, String unused) {
        return event(id, state, name, displayClock, unused,
                competitor("home", "1", "Home Team", "0") + "," + competitor("away", "2", "Away Team", "0"));
    }

    private String event(String id, String state, String name, String displayClock, String unused, String competitors) {
        String idField = (id == null) ? "" : "\"id\":\"" + id + "\",";
        return "{" + idField + "\"date\":\"2026-07-24T20:00Z\",\"competitions\":[{"
                + "\"status\":{\"type\":{\"state\":\"" + state + "\",\"name\":\"" + name + "\"},"
                + "\"displayClock\":\"" + displayClock + "\"},"
                + "\"competitors\":[" + competitors + "],"
                + "\"details\":[]}]}";
    }
}