package org.Spring.basketball.adapter;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.Spring.model.Match;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * NOTE: Match/Team accessor names below (status(), homeTeam(), name(), etc.)
 * are inferred from how CoreBasketballAdapter.toMatch() constructs Match/Team.
 * If your actual record field names differ, only the accessor calls need
 * updating — the assertions/scenarios themselves are still valid.
 */
class CoreBasketballAdapterTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final CoreBasketballAdapter adapter = new CoreBasketballAdapter();

    private JsonNode json(String s) throws Exception {
        return mapper.readTree(s);
    }

    // ---------------------------------------------------------------
    // toMatches() — envelope-level behavior
    // ---------------------------------------------------------------

    @Test
    void toMatches_missingEventsNode_returnsEmptyList() throws Exception {
        JsonNode root = json("{}");
        List<Match> result = adapter.toMatches(root, "NBA");
        assertTrue(result.isEmpty());
    }

    @Test
    void toMatches_emptyEventsArray_returnsEmptyList() throws Exception {
        JsonNode root = json("{\"events\":[]}");
        assertTrue(adapter.toMatches(root, "NBA").isEmpty());
    }

    @Test
    void toMatches_skipsInvalidEventsButKeepsValidOnes() throws Exception {
        String eventNoId = validEventJson(null, "in", "STATUS_IN_PROGRESS", 2);
        String eventValid = validEventJson("401584669", "in", "STATUS_IN_PROGRESS", 2);
        JsonNode root = json("{\"events\":[" + eventNoId + "," + eventValid + "]}");

        List<Match> result = adapter.toMatches(root, "NBA");
        assertEquals(1, result.size(), "event with missing id should be silently dropped, not crash the batch");
    }

    // ---------------------------------------------------------------
    // id validation
    // ---------------------------------------------------------------

    @Test
    void toMatch_missingId_isSkipped() throws Exception {
        JsonNode root = json("{\"events\":[" + validEventJson(null, "in", "STATUS_IN_PROGRESS", 1) + "]}");
        assertTrue(adapter.toMatches(root, "NBA").isEmpty());
    }

    @Test
    void toMatch_nonNumericId_isSkipped() throws Exception {
        JsonNode root = json("{\"events\":[" + validEventJson("abc123", "in", "STATUS_IN_PROGRESS", 1) + "]}");
        assertTrue(adapter.toMatches(root, "NBA").isEmpty(),
                "non-numeric id must not silently coerce to 0 and produce a phantom match");
    }

    @Test
    void toMatch_missingCompetitions_isSkipped() throws Exception {
        JsonNode root = json("{\"events\":[{\"id\":\"123\"}]}");
        assertTrue(adapter.toMatches(root, "NBA").isEmpty());
    }

    // ---------------------------------------------------------------
    // status mapping — the core branching logic
    // ---------------------------------------------------------------

    @Test
    void status_inProgress_period1_mapsToQ1() throws Exception {
        Match m = firstMatch(validEventJson("1", "in", "STATUS_IN_PROGRESS", 1));
        assertEquals("Q1", m.status());
    }

    @Test
    void status_inProgress_period4_mapsToQ4() throws Exception {
        Match m = firstMatch(validEventJson("1", "in", "STATUS_IN_PROGRESS", 4));
        assertEquals("Q4", m.status());
    }

    @Test
    void status_inProgress_period5OrMore_mapsToOT() throws Exception {
        Match m = firstMatch(validEventJson("1", "in", "STATUS_IN_PROGRESS", 5));
        assertEquals("OT", m.status());

        Match m2 = firstMatch(validEventJson("1", "in", "STATUS_IN_PROGRESS", 7));
        assertEquals("OT", m2.status(), "any period >= 5 should collapse to OT, not just exactly 5");
    }

    @Test
    void status_inProgress_periodZeroOrUnset_fallsBackToLIVE() throws Exception {
        Match m = firstMatch(validEventJson("1", "in", "STATUS_IN_PROGRESS", 0));
        assertEquals("LIVE", m.status());
    }

    @Test
    void status_halftime_regardlessOfPeriod_mapsToHT() throws Exception {
        Match m = firstMatch(validEventJson("1", "in", "STATUS_HALFTIME", 2));
        assertEquals("HT", m.status());
    }

    @Test
    void status_post_plain_mapsToFT() throws Exception {
        Match m = firstMatch(validEventJson("1", "post", "STATUS_FINAL", 4));
        assertEquals("FT", m.status());
    }

    @Test
    void status_post_overtimeInName_mapsToFTOT() throws Exception {
        Match m = firstMatch(validEventJson("1", "post", "STATUS_FINAL_OVERTIME", 5));
        assertEquals("FT-OT", m.status());
    }

    @Test
    void status_post_canceled_takesPriorityOverPost() throws Exception {
        Match m = firstMatch(validEventJson("1", "post", "STATUS_CANCELED", 0));
        assertEquals("Canceled", m.status());
    }

    @Test
    void status_post_postponed() throws Exception {
        Match m = firstMatch(validEventJson("1", "post", "STATUS_POSTPONED", 0));
        assertEquals("Postponed", m.status());
    }

    @Test
    void status_pre_tbd() throws Exception {
        Match m = firstMatch(validEventJson("1", "pre", "STATUS_TBD", 0));
        assertEquals("TBD", m.status());
    }

    @Test
    void status_pre_canceled() throws Exception {
        Match m = firstMatch(validEventJson("1", "pre", "STATUS_CANCELED", 0));
        assertEquals("Canceled", m.status());
    }

    @Test
    void status_pre_default_mapsToScheduled() throws Exception {
        Match m = firstMatch(validEventJson("1", "pre", "STATUS_SCHEDULED", 0));
        assertEquals("Scheduled", m.status());
    }

    @Test
    void status_unknownState_fallsThroughToScheduled() throws Exception {
        // e.g. ESPN adds a new state value we don't recognize
        Match m = firstMatch(validEventJson("1", "weird", "STATUS_WHATEVER", 0));
        assertEquals("Scheduled", m.status());
    }

    // ---------------------------------------------------------------
    // clock / period only populated while in play
    // ---------------------------------------------------------------

    @Test
    void clockAndPeriod_populatedWhileInPlay() throws Exception {
        Match m = firstMatch(validEventJson("1", "in", "STATUS_IN_PROGRESS", 3));
        assertEquals(3, m.period());
        assertNotNull(m.clock());
    }

    @Test
    void clockAndPeriod_nullWhenNotInPlay_evenIfPeriodPresentInPayload() throws Exception {
        // ESPN sometimes leaves a stale "period" value on a finished game.
        String event = eventWithPeriodAndClock("1", "post", "STATUS_FINAL", 4, "0:00");
        Match m = firstMatch(event);
        assertNull(m.clock(), "clock must not leak through once game is finished");
        assertNull(m.period(), "period must not leak through once game is finished");
    }

    @Test
    void period_nullWhenInPlayButPeriodIsZero() throws Exception {
        Match m = firstMatch(validEventJson("1", "in", "STATUS_IN_PROGRESS", 0));
        assertNull(m.period());
    }

    // ---------------------------------------------------------------
    // statusDetail fallback chain: shortDetail -> detail -> status
    // ---------------------------------------------------------------

    @Test
    void statusDetail_prefersShortDetail() throws Exception {
        String event = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":2,\"displayClock\":\"5:00\","
                + "\"type\":{\"state\":\"in\",\"name\":\"STATUS_IN_PROGRESS\","
                + "\"shortDetail\":\"2nd Qtr\",\"detail\":\"Second Quarter - 5:00\"}},"
                + "\"competitors\":[" + competitor("home", "10", "H") + "," + competitor("away", "20", "A") + "]}]}";
        Match m = firstMatch(event);
        assertEquals("2nd Qtr", m.statusDetail());
    }

    @Test
    void statusDetail_fallsBackToDetail_thenStatus() throws Exception {
        String noShortDetail = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":2,\"displayClock\":\"5:00\","
                + "\"type\":{\"state\":\"in\",\"name\":\"STATUS_IN_PROGRESS\",\"detail\":\"Second Quarter\"}},"
                + "\"competitors\":[" + competitor("home", "10", "H") + "," + competitor("away", "20", "A") + "]}]}";
        assertEquals("Second Quarter", firstMatch(noShortDetail).statusDetail());

        String noneAtAll = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":2,\"displayClock\":\"5:00\","
                + "\"type\":{\"state\":\"in\",\"name\":\"STATUS_IN_PROGRESS\"}},"
                + "\"competitors\":[" + competitor("home", "10", "H") + "," + competitor("away", "20", "A") + "]}]}";
        assertEquals("Q2", firstMatch(noneAtAll).statusDetail());
    }

    // ---------------------------------------------------------------
    // competition name fallback chain
    // ---------------------------------------------------------------

    @Test
    void competition_prefersCompetitionLeagueName() throws Exception {
        String event = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"league\":{\"name\":\"NBA Playoffs\"},"
                + "\"status\":{\"period\":1,\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":[" + competitor("home", "10", "H") + "," + competitor("away", "20", "A") + "]}],"
                + "\"league\":{\"name\":\"NBA\"}}";
        assertEquals("NBA Playoffs", firstMatch(event).competition());
    }

    @Test
    void competition_fallsBackToEventLeague_thenDefault() throws Exception {
        String eventLevelOnly = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":1,\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":[" + competitor("home", "10", "H") + "," + competitor("away", "20", "A") + "]}],"
                + "\"league\":{\"name\":\"WNBA\"}}";
        assertEquals("WNBA", firstMatch(eventLevelOnly).competition());

        String neither = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":1,\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":[" + competitor("home", "10", "H") + "," + competitor("away", "20", "A") + "]}]}";
        assertEquals("Basketball", firstMatch(neither).competition());
    }

    // ---------------------------------------------------------------
    // team / score parsing
    // ---------------------------------------------------------------

    @Test
    void homeAndAway_assignedByHomeAwayField_notArrayOrder() throws Exception {
        // away listed first in the array - adapter must still assign correctly
        String event = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":1,\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":[" + competitor("away", "20", "Lakers") + "," + competitor("home", "10", "Celtics") + "]}]}";
        Match m = firstMatch(event);
        assertEquals("Celtics", m.homeTeam().name());
        assertEquals("Lakers", m.awayTeam().name());
    }

    @Test
    void score_missingOrBlank_mapsToNull() throws Exception {
        String event = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":1,\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":["
                + "{\"homeAway\":\"home\",\"team\":{\"id\":\"10\",\"displayName\":\"Celtics\"}},"
                + "{\"homeAway\":\"away\",\"team\":{\"id\":\"20\",\"displayName\":\"Lakers\"},\"score\":\"\"}"
                + "]}]}";
        Match m = firstMatch(event);
        assertNull(m.homeScore());
        assertNull(m.awayScore());
    }

    @Test
    void teamId_nonNumeric_mapsToNull_notZero() throws Exception {
        String event = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":1,\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":["
                + "{\"homeAway\":\"home\",\"team\":{\"id\":\"bad\",\"displayName\":\"Celtics\"},\"score\":\"1\"},"
                + "{\"homeAway\":\"away\",\"team\":{\"id\":\"20\",\"displayName\":\"Lakers\"},\"score\":\"2\"}"
                + "]}]}";
        Match m = firstMatch(event);
        assertNull(m.homeTeam().id());
    }

    @Test
    void teamLogo_fallsBackToLogosArray_whenTopLevelLogoMissing() throws Exception {
        String event = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":1,\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":["
                + "{\"homeAway\":\"home\",\"team\":{\"id\":\"10\",\"displayName\":\"Celtics\","
                + "\"logos\":[{\"href\":\"https://example.com/celtics.png\"}]},\"score\":\"1\"},"
                + "{\"homeAway\":\"away\",\"team\":{\"id\":\"20\",\"displayName\":\"Lakers\"},\"score\":\"2\"}"
                + "]}]}";
        Match m = firstMatch(event);
        assertEquals("https://example.com/celtics.png", m.homeTeam().logo());
    }

    @Test
    void teamShortName_fallsBackToShortDisplayNameWhenAbbreviationMissing() throws Exception {
        String event = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":1,\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":["
                + "{\"homeAway\":\"home\",\"team\":{\"id\":\"10\",\"displayName\":\"Celtics\",\"shortDisplayName\":\"BOS\"},\"score\":\"1\"},"
                + "{\"homeAway\":\"away\",\"team\":{\"id\":\"20\",\"displayName\":\"Lakers\"},\"score\":\"2\"}"
                + "]}]}";
        Match m = firstMatch(event);
        // ESPN's "abbreviation" field wasn't present, so the adapter should fall
        // back to "shortDisplayName" and map it into Team.shortName().
        assertEquals("BOS", m.homeTeam().shortName());
    }

    @Test
    void teamShortName_prefersAbbreviationOverShortDisplayName() throws Exception {
        String event = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":1,\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":["
                + "{\"homeAway\":\"home\",\"team\":{\"id\":\"10\",\"displayName\":\"Celtics\",\"abbreviation\":\"BOS\",\"shortDisplayName\":\"Celtics\"},\"score\":\"1\"},"
                + "{\"homeAway\":\"away\",\"team\":{\"id\":\"20\",\"displayName\":\"Lakers\"},\"score\":\"2\"}"
                + "]}]}";
        Match m = firstMatch(event);
        assertEquals("BOS", m.homeTeam().shortName());
    }

    // ---------------------------------------------------------------
    // helpers
    // ---------------------------------------------------------------

    private Match firstMatch(String eventJson) throws Exception {
        JsonNode root = json("{\"events\":[" + eventJson + "]}");
        List<Match> matches = adapter.toMatches(root, "NBA");
        assertEquals(1, matches.size(), "expected exactly one match to be produced");
        return matches.get(0);
    }

    private String competitor(String homeAway, String teamId, String name) {
        return "{\"homeAway\":\"" + homeAway + "\",\"score\":\"" + (teamId.equals("10") ? "5" : "3") + "\","
                + "\"team\":{\"id\":\"" + teamId + "\",\"displayName\":\"" + name + "\"}}";
    }

    private String validEventJson(String id, String state, String name, int period) {
        String idField = (id == null) ? "" : "\"id\":\"" + id + "\",";
        return "{" + idField + "\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":" + period + ",\"displayClock\":\"5:00\","
                + "\"type\":{\"state\":\"" + state + "\",\"name\":\"" + name + "\"}},"
                + "\"competitors\":[" + competitor("home", "10", "Home Team") + "," + competitor("away", "20", "Away Team") + "]}]}";
    }

    private String eventWithPeriodAndClock(String id, String state, String name, int period, String clock) {
        return "{\"id\":\"" + id + "\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":" + period + ",\"displayClock\":\"" + clock + "\","
                + "\"type\":{\"state\":\"" + state + "\",\"name\":\"" + name + "\"}},"
                + "\"competitors\":[" + competitor("home", "10", "Home Team") + "," + competitor("away", "20", "Away Team") + "]}]}";
    }
}