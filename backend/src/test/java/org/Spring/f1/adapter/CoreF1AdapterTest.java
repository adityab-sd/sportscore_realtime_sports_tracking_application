package org.Spring.f1.adapter;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.Spring.model.Match;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CoreF1AdapterTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final CoreF1Adapter adapter = new CoreF1Adapter();

    private JsonNode json(String s) throws Exception {
        return mapper.readTree(s);
    }

    // ---------------------------------------------------------------
    // envelope / id / sessions validation
    // ---------------------------------------------------------------

    @Test
    void toMatches_missingEventsNode_returnsEmptyList() throws Exception {
        assertTrue(adapter.toMatches(json("{}"), "Formula 1").isEmpty());
    }

    @Test
    void toMatch_missingId_isSkipped() throws Exception {
        JsonNode root = json("{\"events\":[" + weekend(null, List.of(session("pre", "STATUS_SCHEDULED", "2026-08-01", driversOrdered()))) + "]}");
        assertTrue(adapter.toMatches(root, "Formula 1").isEmpty());
    }

    @Test
    void toMatch_nonNumericId_isSkipped() throws Exception {
        JsonNode root = json("{\"events\":[" + weekend("abc", List.of(session("pre", "STATUS_SCHEDULED", "2026-08-01", driversOrdered()))) + "]}");
        assertTrue(adapter.toMatches(root, "Formula 1").isEmpty());
    }

    @Test
    void toMatch_noCompetitionsArray_isSkipped() throws Exception {
        assertTrue(adapter.toMatches(json("{\"events\":[{\"id\":\"1\"}]}"), "Formula 1").isEmpty());
    }

    @Test
    void toMatch_emptyCompetitionsArray_isSkipped() throws Exception {
        assertTrue(adapter.toMatches(json("{\"events\":[{\"id\":\"1\",\"competitions\":[]}]}"), "Formula 1").isEmpty());
    }

    // ---------------------------------------------------------------
    // representative session selection: in-progress > earliest upcoming > latest completed
    // ---------------------------------------------------------------

    @Test
    void representativeSession_prefersInProgressOverEverything() throws Exception {
        List<String> sessions = List.of(
                session("post", "STATUS_FINAL", "2026-08-01T10:00Z", driversOrdered()),
                session("in", "STATUS_IN_PROGRESS", "2026-08-02T14:00Z", driversOrdered()),
                session("pre", "STATUS_SCHEDULED", "2026-08-03T14:00Z", driversOrdered()));
        Match m = firstMatch(weekend("1", sessions));
        assertEquals("LIVE", m.status());
    }

    @Test
    void representativeSession_multipleInProgress_keepsFirstEncountered() throws Exception {
        // both sessions are "in" - adapter keeps whichever it saw first in array order
        List<String> sessions = List.of(
                sessionLabeled("in", "STATUS_IN_PROGRESS", "2026-08-02T14:00Z", "Qualifying", driversOrdered()),
                sessionLabeled("in", "STATUS_IN_PROGRESS", "2026-08-02T15:00Z", "Sprint", driversOrdered()));
        Match m = firstMatch(weekend("1", sessions));
        assertEquals("LIVE", m.status());
        assertTrue(m.statusDetail().startsWith("Qualifying"));
    }

    @Test
    void representativeSession_noInProgress_picksEarliestUpcomingByDate_notArrayOrder() throws Exception {
        List<String> sessions = List.of(
                sessionLabeled("pre", "STATUS_SCHEDULED", "2026-08-05T10:00Z", "Race", driversOrdered()),
                sessionLabeled("pre", "STATUS_SCHEDULED", "2026-08-03T10:00Z", "Practice 1", driversOrdered()));
        Match m = firstMatch(weekend("1", sessions));
        assertEquals("Scheduled", m.status());
        assertTrue(m.statusDetail().startsWith("Practice 1"), "earliest-dated upcoming session should win, regardless of array order");
    }

    @Test
    void representativeSession_upcomingWithNullDate_sortsLast() throws Exception {
        List<String> sessions = List.of(
                sessionLabeledNoDate("pre", "STATUS_SCHEDULED", "No Date Session"),
                sessionLabeled("pre", "STATUS_SCHEDULED", "2026-08-03T10:00Z", "Practice 1", driversOrdered()));
        Match m = firstMatch(weekend("1", sessions));
        assertTrue(m.statusDetail().startsWith("Practice 1"), "session with a real date should be picked over one with no date");
    }

    @Test
    void representativeSession_noInProgressNoUpcoming_picksLatestCompletedByDate() throws Exception {
        List<String> sessions = List.of(
                sessionLabeled("post", "STATUS_FINAL", "2026-08-01T10:00Z", "Practice 1", driversOrdered()),
                sessionLabeled("post", "STATUS_FINAL", "2026-08-03T10:00Z", "Race", driversOrdered()));
        Match m = firstMatch(weekend("1", sessions));
        assertEquals("FT", m.status());
        assertTrue(m.statusDetail().startsWith("Race"), "latest-dated completed session (the race) should win over an earlier practice session");
    }

    @Test
    void representativeSession_noRecognizedState_fallsBackToFirstArrayElement() throws Exception {
        List<String> sessions = List.of(
                sessionLabeled("weird-unknown-state", "STATUS_WHATEVER", "2026-08-01T10:00Z", "Mystery", driversOrdered()));
        Match m = firstMatch(weekend("1", sessions));
        assertTrue(m.statusDetail().startsWith("Mystery"));
    }

    // ---------------------------------------------------------------
    // status mapping
    // ---------------------------------------------------------------

    @Test
    void status_post_canceled_and_postponed() throws Exception {
        assertEquals("Canceled", firstMatch(weekend("1", List.of(
                session("post", "STATUS_CANCELED", "2026-08-01T10:00Z", driversOrdered())))).status());
        assertEquals("Postponed", firstMatch(weekend("1", List.of(
                session("post", "STATUS_POSTPONED", "2026-08-01T10:00Z", driversOrdered())))).status());
    }

    @Test
    void status_pre_canceled_and_postponed() throws Exception {
        assertEquals("Canceled", firstMatch(weekend("1", List.of(
                session("pre", "STATUS_CANCELED", "2026-08-01T10:00Z", driversOrdered())))).status());
        assertEquals("Postponed", firstMatch(weekend("1", List.of(
                session("pre", "STATUS_POSTPONED", "2026-08-01T10:00Z", driversOrdered())))).status());
    }

    // ---------------------------------------------------------------
    // sessionLabel + statusDetail composition
    // ---------------------------------------------------------------

    @Test
    void sessionLabel_prefersTypeText_thenAbbreviation_thenName_thenSession() throws Exception {
        String withText = session("pre", "STATUS_SCHEDULED", "2026-08-01T10:00Z", driversOrdered());
        assertTrue(firstMatch(weekend("1", List.of(withText))).statusDetail().startsWith("Practice 1"));

        String noTypeAtAll = "{\"date\":\"2026-08-01T10:00Z\","
                + "\"status\":{\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":[" + driversOrdered() + "]}";
        assertTrue(firstMatch(weekend("1", List.of(noTypeAtAll))).statusDetail().startsWith("Session"));
    }

    @Test
    void statusDetail_appendsDetailWhenPresent() throws Exception {
        Match m = firstMatch(weekend("1", List.of(
                sessionLabeled("in", "STATUS_IN_PROGRESS", "2026-08-01T10:00Z", "Race", driversOrdered()))));
        assertTrue(m.statusDetail().contains(" - "), "statusDetail should join label and detail with ' - '");
    }

    // ---------------------------------------------------------------
    // competition fallback: event.name -> event.shortName -> event.circuit.fullName -> "Formula 1"
    // ---------------------------------------------------------------

    @Test
    void competition_fallbackChain() throws Exception {
        String withName = "{\"id\":\"1\",\"name\":\"Belgian Grand Prix\",\"date\":\"2026-08-01T10:00Z\","
                + "\"competitions\":[" + session("pre", "STATUS_SCHEDULED", "2026-08-01T10:00Z", driversOrdered()) + "]}";
        assertEquals("Belgian Grand Prix", firstMatch(withName).competition());

        String withShortNameOnly = "{\"id\":\"1\",\"shortName\":\"BEL\",\"date\":\"2026-08-01T10:00Z\","
                + "\"competitions\":[" + session("pre", "STATUS_SCHEDULED", "2026-08-01T10:00Z", driversOrdered()) + "]}";
        assertEquals("BEL", firstMatch(withShortNameOnly).competition());

        String withCircuitOnly = "{\"id\":\"1\",\"circuit\":{\"fullName\":\"Circuit de Spa-Francorchamps\"},\"date\":\"2026-08-01T10:00Z\","
                + "\"competitions\":[" + session("pre", "STATUS_SCHEDULED", "2026-08-01T10:00Z", driversOrdered()) + "]}";
        assertEquals("Circuit de Spa-Francorchamps", firstMatch(withCircuitOnly).competition());

        String withNone = "{\"id\":\"1\",\"date\":\"2026-08-01T10:00Z\","
                + "\"competitions\":[" + session("pre", "STATUS_SCHEDULED", "2026-08-01T10:00Z", driversOrdered()) + "]}";
        assertEquals("Formula 1", firstMatch(withNone).competition());
    }

    // ---------------------------------------------------------------
    // driver ranking (order field) and P1/P2 mapping
    // ---------------------------------------------------------------

    @Test
    void drivers_sortedByOrderField_ascending() throws Exception {
        String drivers = driver("101", "Driver Two", 2) + "," + driver("100", "Driver One", 1);
        Match m = firstMatch(weekend("1", List.of(session("pre", "STATUS_SCHEDULED", "2026-08-01T10:00Z", drivers))));
        assertEquals("Driver One", m.homeTeam().name());
        assertEquals("Driver Two", m.awayTeam().name());
    }

    @Test
    void drivers_missingOrder_defaultsToLastPlace() throws Exception {
        String drivers = driverNoOrder("100", "No Order Driver") + "," + driver("101", "Ordered Driver", 1);
        Match m = firstMatch(weekend("1", List.of(session("pre", "STATUS_SCHEDULED", "2026-08-01T10:00Z", drivers))));
        assertEquals("Ordered Driver", m.homeTeam().name(), "explicit order should beat a missing order (defaults to 999)");
    }

    @Test
    void drivers_onlyOneDriver_awayTeamAndDisplayAreNull() throws Exception {
        Match m = firstMatch(weekend("1", List.of(session("pre", "STATUS_SCHEDULED", "2026-08-01T10:00Z", driver("100", "Solo Driver", 1)))));
        assertNotNull(m.homeTeam());
        assertNull(m.awayTeam());
        assertNull(m.awayScoreDisplay());
    }

    @Test
    void drivers_none_bothTeamsNull() throws Exception {
        String noCompetitors = "{\"date\":\"2026-08-01T10:00Z\","
                + "\"status\":{\"type\":{\"state\":\"pre\",\"name\":\"STATUS_SCHEDULED\"}},"
                + "\"competitors\":[]}";
        Match m = firstMatch(weekend("1", List.of(noCompetitors)));
        assertNull(m.homeTeam());
        assertNull(m.awayTeam());
    }

    @Test
    void p1p2Display_formattedWithPrefix() throws Exception {
        Match m = firstMatch(weekend("1", List.of(session("pre", "STATUS_SCHEDULED", "2026-08-01T10:00Z", driversOrdered()))));
        assertEquals("P1 Driver One", m.homeScoreDisplay());
        assertEquals("P2 Driver Two", m.awayScoreDisplay());
    }

    @Test
    void driverId_fallsBackToCompetitorId_whenAthleteIdMissing() throws Exception {
        String noAthleteId = "{\"order\":1,\"id\":\"555\",\"athlete\":{\"fullName\":\"No Athlete Id\"}}";
        Match m = firstMatch(weekend("1", List.of(session("pre", "STATUS_SCHEDULED", "2026-08-01T10:00Z", noAthleteId))));
        assertEquals(555, m.homeTeam().id());
    }

    @Test
    void driverName_fallbackChain() throws Exception {
        String onlyDisplayName = "{\"order\":1,\"id\":\"1\",\"displayName\":\"Competitor Display Name\",\"athlete\":{}}";
        assertEquals("Competitor Display Name",
                firstMatch(weekend("1", List.of(session("pre", "STATUS_SCHEDULED", "2026-08-01T10:00Z", onlyDisplayName)))).homeTeam().name());

        String nothing = "{\"order\":1,\"id\":\"1\",\"athlete\":{}}";
        assertEquals("Driver",
                firstMatch(weekend("1", List.of(session("pre", "STATUS_SCHEDULED", "2026-08-01T10:00Z", nothing)))).homeTeam().name());
    }

    @Test
    void driverCountryAndFlag_fallBackToCompetitorLevel_whenAthleteLevelMissing() throws Exception {
        String competitorLevelFlag = "{\"order\":1,\"id\":\"1\",\"athlete\":{\"fullName\":\"Flag Test\"},"
                + "\"flag\":{\"alt\":\"Netherlands\",\"href\":\"https://example.com/nl.png\"}}";
        Match m = firstMatch(weekend("1", List.of(session("pre", "STATUS_SCHEDULED", "2026-08-01T10:00Z", competitorLevelFlag))));
        assertEquals("Netherlands", m.homeTeam().shortName());
        assertEquals("https://example.com/nl.png", m.homeTeam().logo());
    }

    // ---------------------------------------------------------------
    // Match shape: f1-specific null fields
    // ---------------------------------------------------------------

    @Test
    void match_hasF1Sport_noElapsedClockPeriodOrNumericScore() throws Exception {
        Match m = firstMatch(weekend("1", List.of(session("pre", "STATUS_SCHEDULED", "2026-08-01T10:00Z", driversOrdered()))));
        assertEquals("f1", m.sport());
        assertNull(m.elapsed());
        assertNull(m.clock());
        assertNull(m.period());
        assertNull(m.homeScore());
        assertNull(m.awayScore());
        assertTrue(m.events().isEmpty());
    }

    // ---------------------------------------------------------------
    // helpers
    // ---------------------------------------------------------------

    private Match firstMatch(String eventJson) throws Exception {
        JsonNode root = json("{\"events\":[" + eventJson + "]}");
        List<Match> matches = adapter.toMatches(root, "Formula 1");
        assertEquals(1, matches.size(), "expected exactly one match to be produced");
        return matches.get(0);
    }

    private String weekend(String id, List<String> sessions) {
        String idField = (id == null) ? "" : "\"id\":\"" + id + "\",";
        return "{" + idField + "\"date\":\"2026-08-01T10:00Z\",\"competitions\":[" + String.join(",", sessions) + "]}";
    }

    private String driversOrdered() {
        return driver("100", "Driver One", 1) + "," + driver("101", "Driver Two", 2);
    }

    private String driver(String id, String name, int order) {
        return "{\"order\":" + order + ",\"athlete\":{\"id\":\"" + id + "\",\"fullName\":\"" + name + "\"}}";
    }

    private String driverNoOrder(String id, String name) {
        return "{\"athlete\":{\"id\":\"" + id + "\",\"fullName\":\"" + name + "\"}}";
    }

    private String session(String state, String name, String date, String competitors) {
        return sessionLabeled(state, name, date, "Practice 1", competitors);
    }

    private String sessionLabeled(String state, String name, String date, String label, String competitors) {
        return "{\"date\":\"" + date + "\","
                + "\"status\":{\"type\":{\"state\":\"" + state + "\",\"name\":\"" + name + "\"}},"
                + "\"type\":{\"text\":\"" + label + "\"},"
                + "\"competitors\":[" + competitors + "]}";
    }

    private String sessionLabeledNoDate(String state, String name, String label) {
        return "{\"status\":{\"type\":{\"state\":\"" + state + "\",\"name\":\"" + name + "\"}},"
                + "\"type\":{\"text\":\"" + label + "\"},"
                + "\"competitors\":[" + driversOrdered() + "]}";
    }
}