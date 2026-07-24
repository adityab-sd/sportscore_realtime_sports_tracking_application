package org.Spring.baseball.adapter;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.Spring.model.Match;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CoreBaseballAdapterTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final CoreBaseballAdapter adapter = new CoreBaseballAdapter();

    private JsonNode json(String s) throws Exception {
        return mapper.readTree(s);
    }

    // ---------------------------------------------------------------
    // envelope / id / competitions validation
    // ---------------------------------------------------------------

    @Test
    void toMatches_missingEventsNode_returnsEmptyList() throws Exception {
        assertTrue(adapter.toMatches(json("{}"), "MLB").isEmpty());
    }

    @Test
    void toMatch_missingId_isSkipped() throws Exception {
        JsonNode root = json("{\"events\":[" + event(null, "pre", "STATUS_SCHEDULED", 0) + "]}");
        assertTrue(adapter.toMatches(root, "MLB").isEmpty());
    }

    @Test
    void toMatch_nonNumericId_isSkipped() throws Exception {
        JsonNode root = json("{\"events\":[" + event("ABC", "pre", "STATUS_SCHEDULED", 0) + "]}");
        assertTrue(adapter.toMatches(root, "MLB").isEmpty());
    }

    @Test
    void toMatch_missingCompetitions_isSkipped() throws Exception {
        assertTrue(adapter.toMatches(json("{\"events\":[{\"id\":\"1\"}]}"), "MLB").isEmpty());
    }

    @Test
    void toMatches_dropsInvalidEvents_keepsValidOnes() throws Exception {
        JsonNode root = json("{\"events\":[" + event(null, "pre", "STATUS_SCHEDULED", 0) + ","
                + event("1", "pre", "STATUS_SCHEDULED", 0) + "]}");
        assertEquals(1, adapter.toMatches(root, "MLB").size());
    }

    // ---------------------------------------------------------------
    // sport / elapsed / clock always null-shaped for baseball
    // ---------------------------------------------------------------

    @Test
    void match_hasBaseballSport_noClock_noElapsed() throws Exception {
        Match m = firstMatch(event("1", "in", "STATUS_IN_PROGRESS", 5));
        assertEquals("baseball", m.sport());
        assertNull(m.elapsed(), "baseball has no elapsed-minute concept");
        assertNull(m.clock(), "baseball has no game clock");
    }

    // ---------------------------------------------------------------
    // status mapping
    // ---------------------------------------------------------------

    @Test
    void status_inProgress_mapsToLIVE() throws Exception {
        assertEquals("LIVE", firstMatch(event("1", "in", "STATUS_IN_PROGRESS", 3)).status());
    }

    @Test
    void status_inProgress_withDelayInName_mapsToDelayed() throws Exception {
        assertEquals("Delayed", firstMatch(event("1", "in", "STATUS_RAIN_DELAY", 3)).status());
    }

    @Test
    void status_post_plain_mapsToFT() throws Exception {
        assertEquals("FT", firstMatch(event("1", "post", "STATUS_FINAL", 9)).status());
    }

    @Test
    void status_post_forfeit_canceled_postponed() throws Exception {
        assertEquals("Forfeit", firstMatch(event("1", "post", "STATUS_FORFEIT", 5)).status());
        assertEquals("Canceled", firstMatch(event("1", "post", "STATUS_CANCELED", 0)).status());
        assertEquals("Postponed", firstMatch(event("1", "post", "STATUS_POSTPONED", 0)).status());
    }

    @Test
    void status_pre_delay_canceled_postponed_tbd_scheduled() throws Exception {
        assertEquals("Delayed", firstMatch(event("1", "pre", "STATUS_DELAYED", 0)).status());
        assertEquals("Canceled", firstMatch(event("1", "pre", "STATUS_CANCELED", 0)).status());
        assertEquals("Postponed", firstMatch(event("1", "pre", "STATUS_POSTPONED", 0)).status());
        assertEquals("TBD", firstMatch(event("1", "pre", "STATUS_TBD", 0)).status());
        assertEquals("Scheduled", firstMatch(event("1", "pre", "STATUS_SCHEDULED", 0)).status());
    }

    @Test
    void status_unknownState_fallsThroughToScheduled() throws Exception {
        assertEquals("Scheduled", firstMatch(event("1", "weird", "STATUS_WHATEVER", 0)).status());
    }

    // ---------------------------------------------------------------
    // inning (period) only surfaces when status is exactly "LIVE"
    // ---------------------------------------------------------------

    @Test
    void inning_populatedWhenLive() throws Exception {
        Match m = firstMatch(event("1", "in", "STATUS_IN_PROGRESS", 6));
        assertEquals(6, m.period());
    }

    @Test
    void inning_suppressedWhenDelayed_evenThoughGameIsMidInning() throws Exception {
        // state is "in" (mid-game) but status maps to "Delayed", not "LIVE" -
        // inPlay is strictly status=="LIVE", so period must be null here.
        Match m = firstMatch(event("1", "in", "STATUS_RAIN_DELAY", 6));
        assertNull(m.period());
    }

    @Test
    void inning_nullWhenFinished_evenIfPeriodPresentInPayload() throws Exception {
        Match m = firstMatch(event("1", "post", "STATUS_FINAL", 9));
        assertNull(m.period());
    }

    @Test
    void inning_nullWhenLiveButInningIsZero() throws Exception {
        Match m = firstMatch(event("1", "in", "STATUS_IN_PROGRESS", 0));
        assertNull(m.period());
    }

    // ---------------------------------------------------------------
    // statusDetail fallback: shortDetail -> detail -> status
    // ---------------------------------------------------------------

    @Test
    void statusDetail_prefersShortDetail_thenDetail_thenStatus() throws Exception {
        String withShort = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":5,\"type\":{\"state\":\"in\",\"name\":\"STATUS_IN_PROGRESS\","
                + "\"shortDetail\":\"Top 5th\",\"detail\":\"Top of the 5th\"}},"
                + "\"competitors\":[" + competitor("home", "1", "A", "2") + "," + competitor("away", "2", "B", "1") + "]}]}";
        assertEquals("Top 5th", firstMatch(withShort).statusDetail());

        String withDetailOnly = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":5,\"type\":{\"state\":\"in\",\"name\":\"STATUS_IN_PROGRESS\","
                + "\"detail\":\"Top of the 5th\"}},"
                + "\"competitors\":[" + competitor("home", "1", "A", "2") + "," + competitor("away", "2", "B", "1") + "]}]}";
        assertEquals("Top of the 5th", firstMatch(withDetailOnly).statusDetail());

        String withNeither = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":5,\"type\":{\"state\":\"in\",\"name\":\"STATUS_IN_PROGRESS\"}},"
                + "\"competitors\":[" + competitor("home", "1", "A", "2") + "," + competitor("away", "2", "B", "1") + "]}]}";
        assertEquals("LIVE", firstMatch(withNeither).statusDetail());
    }

    // ---------------------------------------------------------------
    // competition fallback: competition.league.name -> event.league.name -> "Baseball"
    // ---------------------------------------------------------------

    @Test
    void competition_fallbackChain() throws Exception {
        String competitionLevel = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"league\":{\"name\":\"MLB Regular Season\"},"
                + "\"status\":{\"period\":0,\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":[" + competitor("home", "1", "A", null) + "," + competitor("away", "2", "B", null) + "]}],"
                + "\"league\":{\"name\":\"fallback\"}}";
        assertEquals("MLB Regular Season", firstMatch(competitionLevel).competition());

        String eventLevel = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":0,\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":[" + competitor("home", "1", "A", null) + "," + competitor("away", "2", "B", null) + "]}],"
                + "\"league\":{\"name\":\"Caribbean Series\"}}";
        assertEquals("Caribbean Series", firstMatch(eventLevel).competition());

        String neither = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":0,\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":[" + competitor("home", "1", "A", null) + "," + competitor("away", "2", "B", null) + "]}]}";
        assertEquals("Baseball", firstMatch(neither).competition());
    }

    // ---------------------------------------------------------------
    // teams / scores
    // ---------------------------------------------------------------

    @Test
    void homeAndAway_assignedByHomeAwayField() throws Exception {
        String ev = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":0,\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":[" + competitor("away", "2", "Yankees", "0") + "," + competitor("home", "1", "Red Sox", "0") + "]}]}";
        Match m = firstMatch(ev);
        assertEquals("Red Sox", m.homeTeam().name());
        assertEquals("Yankees", m.awayTeam().name());
    }

    @Test
    void score_missingOrBlank_mapsToNull() throws Exception {
        String ev = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":0,\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":["
                + "{\"homeAway\":\"home\",\"team\":{\"id\":\"1\",\"displayName\":\"Red Sox\"}},"
                + "{\"homeAway\":\"away\",\"team\":{\"id\":\"2\",\"displayName\":\"Yankees\"},\"score\":\"\"}"
                + "]}]}";
        Match m = firstMatch(ev);
        assertNull(m.homeScore());
        assertNull(m.awayScore());
    }

    @Test
    void teamId_nonNumeric_mapsToNull() throws Exception {
        String ev = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":0,\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":["
                + "{\"homeAway\":\"home\",\"team\":{\"id\":\"nope\",\"displayName\":\"Red Sox\"},\"score\":\"1\"},"
                + "{\"homeAway\":\"away\",\"team\":{\"id\":\"2\",\"displayName\":\"Yankees\"},\"score\":\"2\"}"
                + "]}]}";
        assertNull(firstMatch(ev).homeTeam().id());
    }

    @Test
    void teamLogo_fallsBackToLogosArray() throws Exception {
        String ev = "{\"id\":\"1\",\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":0,\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":["
                + "{\"homeAway\":\"home\",\"team\":{\"id\":\"1\",\"displayName\":\"Red Sox\","
                + "\"logos\":[{\"href\":\"https://example.com/sox.png\"}]},\"score\":\"1\"},"
                + "{\"homeAway\":\"away\",\"team\":{\"id\":\"2\",\"displayName\":\"Yankees\"},\"score\":\"2\"}"
                + "]}]}";
        assertEquals("https://example.com/sox.png", firstMatch(ev).homeTeam().logo());
    }

    @Test
    void events_alwaysEmpty_baseballAdapterDoesNotParseDetails() throws Exception {
        Match m = firstMatch(event("1", "in", "STATUS_IN_PROGRESS", 3));
        assertNotNull(m.events());
        assertTrue(m.events().isEmpty());
    }

    // ---------------------------------------------------------------
    // helpers
    // ---------------------------------------------------------------

    private Match firstMatch(String eventJson) throws Exception {
        JsonNode root = json("{\"events\":[" + eventJson + "]}");
        List<Match> matches = adapter.toMatches(root, "MLB");
        assertEquals(1, matches.size(), "expected exactly one match to be produced");
        return matches.get(0);
    }

    private String competitor(String homeAway, String id, String name, String score) {
        String scoreField = score == null ? "" : ",\"score\":\"" + score + "\"";
        return "{\"homeAway\":\"" + homeAway + "\",\"team\":{\"id\":\"" + id + "\",\"displayName\":\"" + name + "\"}" + scoreField + "}";
    }

    private String event(String id, String state, String name, int period) {
        String idField = (id == null) ? "" : "\"id\":\"" + id + "\",";
        return "{" + idField + "\"date\":\"2026-07-24T00:00Z\",\"competitions\":[{"
                + "\"status\":{\"period\":" + period + ",\"type\":{\"state\":\"" + state + "\",\"name\":\"" + name + "\"}},"
                + "\"competitors\":[" + competitor("home", "1", "Home", "0") + "," + competitor("away", "2", "Away", "0") + "]}]}";
    }
}