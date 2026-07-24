package org.Spring.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class EspnApiHelperTest {

    /** Concrete stand-in for the abstract base — exposes its protected helpers for testing. */
    static class TestHelper extends EspnApiHelper {
        JsonNode publicGet(String url) throws Exception { return get(url); }
        JsonNode publicGetPaged(String base, int page, int limit) throws Exception { return getPaged(base, page, limit); }
        String publicTxt(JsonNode n) { return txt(n); }
        Integer publicNum(JsonNode n) { return num(n); }
        String publicStr(JsonNode n) { return str(n); }
        String publicStr(JsonNode n, String fallback) { return str(n, fallback); }
        String publicFirst(String... vals) { return first(vals); }
        JsonNode publicCompetitor(JsonNode comp, String side, int fallbackIdx) { return competitor(comp, side, fallbackIdx); }
        Dto.TeamRef publicTeamRef(JsonNode t) { return teamRef(t); }
        String publicBestImage(JsonNode images) { return bestImage(images); }
        String publicResolveTeamId(JsonNode teamNode) { return resolveTeamId(teamNode); }
        String publicResolveAthleteName(JsonNode play, Map<String, String> cache) { return resolveAthleteName(play, cache); }
        String publicAthleteName(JsonNode ath, Map<String, String> cache) { return athleteName(ath, cache); }
        JsonNode publicResolveRef(JsonNode node, Map<String, JsonNode> cache) { return resolveRef(node, cache); }
    }

    private final ObjectMapper mapper = new ObjectMapper();
    private final EspnHttpClient espnHttp = mock(EspnHttpClient.class);
    private TestHelper helper;

    @BeforeEach
    void setUp() {
        helper = new TestHelper();
        helper.espnHttp = espnHttp;
        helper.mapper = mapper;
    }

    private JsonNode json(String s) throws Exception {
        return mapper.readTree(s);
    }

    // ---------------------------------------------------------------
    // get / getPaged
    // ---------------------------------------------------------------

    @Test
    void get_delegatesToEspnHttpClient() throws Exception {
        JsonNode expected = json("{\"ok\":true}");
        when(espnHttp.get("https://example.com/x")).thenReturn(expected);

        assertSame(expected, helper.publicGet("https://example.com/x"));
    }

    @Test
    void getPaged_appendsPageAndLimit_whenUrlHasNoQuery() throws Exception {
        when(espnHttp.get(any())).thenReturn(json("{}"));

        helper.publicGetPaged("https://example.com/scoreboard", 2, 25);

        verify(espnHttp).get("https://example.com/scoreboard?page=2&limit=25");
    }

    @Test
    void getPaged_appendsWithAmpersand_whenUrlAlreadyHasQuery() throws Exception {
        when(espnHttp.get(any())).thenReturn(json("{}"));

        helper.publicGetPaged("https://example.com/scoreboard?dates=20260724", 1, 10);

        verify(espnHttp).get("https://example.com/scoreboard?dates=20260724&page=1&limit=10");
    }

    @Test
    void getPaged_clampsPageBelowOneUpToOne() throws Exception {
        when(espnHttp.get(any())).thenReturn(json("{}"));

        helper.publicGetPaged("https://example.com/x", 0, 10);
        verify(espnHttp).get("https://example.com/x?page=1&limit=10");

        helper.publicGetPaged("https://example.com/x", -5, 10);
        verify(espnHttp).get("https://example.com/x?page=1&limit=10");
    }

    @Test
    void getPaged_clampsLimitIntoOneToOneHundredRange() throws Exception {
        when(espnHttp.get(any())).thenReturn(json("{}"));

        helper.publicGetPaged("https://example.com/x", 1, 0);
        verify(espnHttp).get("https://example.com/x?page=1&limit=1");

        helper.publicGetPaged("https://example.com/x", 1, -10);
        verify(espnHttp).get("https://example.com/x?page=1&limit=1");

        helper.publicGetPaged("https://example.com/x", 1, 5000);
        verify(espnHttp).get("https://example.com/x?page=1&limit=100");
    }

    // ---------------------------------------------------------------
    // node helpers: txt / num / str / first
    // ---------------------------------------------------------------

    @Test
    void txt_nullMissingAndNullNode_returnNull() throws Exception {
        JsonNode obj = json("{\"present\":null}");
        assertNull(helper.publicTxt(null));
        assertNull(helper.publicTxt(obj.path("absent")));
        assertNull(helper.publicTxt(obj.path("present")));
    }

    @Test
    void txt_presentValue_returnsAsText() throws Exception {
        JsonNode obj = json("{\"name\":\"Yankees\"}");
        assertEquals("Yankees", helper.publicTxt(obj.path("name")));
    }

    @Test
    void num_nullMissingNullAndBlank_returnNull() throws Exception {
        JsonNode obj = json("{\"present\":null,\"blank\":\"\"}");
        assertNull(helper.publicNum(null));
        assertNull(helper.publicNum(obj.path("absent")));
        assertNull(helper.publicNum(obj.path("present")));
        assertNull(helper.publicNum(obj.path("blank")));
    }

    @Test
    void num_numericText_parsesToTruncatedInt() throws Exception {
        JsonNode obj = json("{\"score\":\"5\",\"decimal\":\"5.9\"}");
        assertEquals(5, helper.publicNum(obj.path("score")));
        assertEquals(5, helper.publicNum(obj.path("decimal")));
    }

    @Test
    void str_missingNode_returnsEmptyStringByDefault() throws Exception {
        JsonNode obj = json("{}");
        assertEquals("", helper.publicStr(obj.path("absent")));
    }

    @Test
    void str_missingNode_usesGivenFallback() throws Exception {
        JsonNode obj = json("{}");
        assertEquals("fallback", helper.publicStr(obj.path("absent"), "fallback"));
    }

    @Test
    void str_presentValue_ignoresFallback() throws Exception {
        JsonNode obj = json("{\"name\":\"Mets\"}");
        assertEquals("Mets", helper.publicStr(obj.path("name"), "fallback"));
    }

    @Test
    void first_returnsFirstNonNullArgument() {
        assertEquals("b", helper.publicFirst(null, "b", "c"));
        assertNull(helper.publicFirst((String) null, null));
    }

    // ---------------------------------------------------------------
    // competitor
    // ---------------------------------------------------------------

    @Test
    void competitor_matchesByHomeAwayField() throws Exception {
        JsonNode comp = json("{\"competitors\":["
                + "{\"homeAway\":\"home\",\"id\":\"1\"},"
                + "{\"homeAway\":\"away\",\"id\":\"2\"}]}");

        assertEquals("2", helper.publicCompetitor(comp, "away", 0).path("id").asText());
    }

    @Test
    void competitor_noMatch_fallsBackToIndex() throws Exception {
        JsonNode comp = json("{\"competitors\":["
                + "{\"homeAway\":\"home\",\"id\":\"1\"},"
                + "{\"homeAway\":\"home\",\"id\":\"2\"}]}");

        assertEquals("2", helper.publicCompetitor(comp, "away", 1).path("id").asText());
    }

    @Test
    void competitor_noMatchAndFallbackOutOfBounds_returnsNull() throws Exception {
        JsonNode comp = json("{\"competitors\":[{\"homeAway\":\"home\",\"id\":\"1\"}]}");

        assertNull(helper.publicCompetitor(comp, "away", 5));
    }

    // ---------------------------------------------------------------
    // teamRef
    // ---------------------------------------------------------------

    @Test
    void teamRef_prefersInlineLogoOverLogosArray() throws Exception {
        JsonNode t = json("{\"id\":\"1\",\"displayName\":\"Red Sox\",\"abbreviation\":\"BOS\","
                + "\"logo\":\"https://example.com/inline.png\","
                + "\"logos\":[{\"href\":\"https://example.com/array.png\"}]}");

        Dto.TeamRef ref = helper.publicTeamRef(t);

        assertEquals("1", ref.id());
        assertEquals("Red Sox", ref.name());
        assertEquals("BOS", ref.shortName());
        assertEquals("https://example.com/inline.png", ref.logo());
    }

    @Test
    void teamRef_fallsBackToLogosArray_whenNoInlineLogo() throws Exception {
        JsonNode t = json("{\"id\":\"1\",\"displayName\":\"Red Sox\","
                + "\"logos\":[{\"href\":\"https://example.com/array.png\"}]}");

        assertEquals("https://example.com/array.png", helper.publicTeamRef(t).logo());
    }

    @Test
    void teamRef_nameAndAbbreviationFallbacks() throws Exception {
        JsonNode t = json("{\"id\":\"1\",\"name\":\"Red Sox\",\"shortDisplayName\":\"BOS\"}");

        Dto.TeamRef ref = helper.publicTeamRef(t);

        assertEquals("Red Sox", ref.name());
        assertEquals("BOS", ref.shortName());
    }

    @Test
    void teamRef_missingNameAndAbbreviation_usesDefaults() throws Exception {
        JsonNode t = json("{\"id\":\"1\"}");

        Dto.TeamRef ref = helper.publicTeamRef(t);

        assertEquals("-", ref.name());
        assertEquals("", ref.shortName());
        assertNull(ref.logo());
    }

    // ---------------------------------------------------------------
    // bestImage
    // ---------------------------------------------------------------

    @Test
    void bestImage_picksWidestHttpImage() throws Exception {
        JsonNode images = json("[{\"href\":\"https://example.com/small.png\",\"width\":100},"
                + "{\"href\":\"https://example.com/large.png\",\"width\":800},"
                + "{\"href\":\"https://example.com/medium.png\",\"width\":400}]");

        assertEquals("https://example.com/large.png", helper.publicBestImage(images));
    }

    @Test
    void bestImage_skipsNonHttpSources() throws Exception {
        JsonNode images = json("[{\"src\":\"data:image/png;base64,abc\",\"width\":900}]");

        assertNull(helper.publicBestImage(images));
    }

    @Test
    void bestImage_emptyArray_returnsNull() throws Exception {
        assertNull(helper.publicBestImage(json("[]")));
    }

    @Test
    void bestImage_fallsBackThroughUrlAndSrcFields() throws Exception {
        JsonNode images = json("[{\"url\":\"https://example.com/from-url.png\",\"width\":300}]");

        assertEquals("https://example.com/from-url.png", helper.publicBestImage(images));
    }

    // ---------------------------------------------------------------
    // resolveTeamId
    // ---------------------------------------------------------------

    @Test
    void resolveTeamId_missingOrNullNode_returnsNull() throws Exception {
        assertNull(helper.publicResolveTeamId(json("{}").path("absent")));
        assertNull(helper.publicResolveTeamId(json("{\"team\":null}").path("team")));
    }

    @Test
    void resolveTeamId_prefersInlineId() throws Exception {
        JsonNode team = json("{\"id\":\"42\",\"$ref\":\"https://example.com/teams/99\"}");
        assertEquals("42", helper.publicResolveTeamId(team));
    }

    @Test
    void resolveTeamId_extractsFromRefWhenNoInlineId() throws Exception {
        JsonNode team = json("{\"$ref\":\"https://sports.core.api.espn.com/v2/teams/99?lang=en\"}");
        assertEquals("99", helper.publicResolveTeamId(team));
    }

    @Test
    void resolveTeamId_refWithoutTeamsSegment_returnsNull() throws Exception {
        JsonNode team = json("{\"$ref\":\"https://example.com/athletes/99\"}");
        assertNull(helper.publicResolveTeamId(team));
    }

    @Test
    void resolveTeamId_noIdAndNoRef_returnsNull() throws Exception {
        assertNull(helper.publicResolveTeamId(json("{}")));
    }

    // ---------------------------------------------------------------
    // athleteName / resolveAthleteName
    // ---------------------------------------------------------------

    @Test
    void athleteName_missingOrNullNode_returnsNull() throws Exception {
        Map<String, String> cache = new HashMap<>();
        assertNull(helper.publicAthleteName(json("{}").path("absent"), cache));
        assertNull(helper.publicAthleteName(json("{\"athlete\":null}").path("athlete"), cache));
    }

    @Test
    void athleteName_prefersInlineDisplayNameOverFullNameAndShortName() throws Exception {
        JsonNode ath = json("{\"displayName\":\"Mike Trout\",\"fullName\":\"Michael Trout\",\"shortName\":\"M. Trout\"}");
        assertEquals("Mike Trout", helper.publicAthleteName(ath, new HashMap<>()));
    }

    @Test
    void athleteName_ref_fetchesAndCachesResult() throws Exception {
        JsonNode ath = json("{\"$ref\":\"http://sports.core.api.espn.com/v2/athletes/1\"}");
        when(espnHttp.get("https://sports.core.api.espn.com/v2/athletes/1"))
                .thenReturn(json("{\"displayName\":\"Shohei Ohtani\"}"));
        Map<String, String> cache = new HashMap<>();

        String name = helper.publicAthleteName(ath, cache);

        assertEquals("Shohei Ohtani", name);
        assertEquals("Shohei Ohtani", cache.get("http://sports.core.api.espn.com/v2/athletes/1"));
        verify(espnHttp, times(1)).get("https://sports.core.api.espn.com/v2/athletes/1");
    }

    @Test
    void athleteName_ref_upgradesHttpToHttps() throws Exception {
        JsonNode ath = json("{\"$ref\":\"http://sports.core.api.espn.com/v2/athletes/1\"}");
        when(espnHttp.get(any())).thenReturn(json("{\"displayName\":\"Shohei Ohtani\"}"));

        helper.publicAthleteName(ath, new HashMap<>());

        verify(espnHttp).get(eq("https://sports.core.api.espn.com/v2/athletes/1"));
    }

    @Test
    void athleteName_ref_secondLookupUsesCache_doesNotCallEspnAgain() throws Exception {
        JsonNode ath = json("{\"$ref\":\"http://sports.core.api.espn.com/v2/athletes/1\"}");
        when(espnHttp.get(any())).thenReturn(json("{\"displayName\":\"Shohei Ohtani\"}"));
        Map<String, String> cache = new HashMap<>();

        helper.publicAthleteName(ath, cache);
        helper.publicAthleteName(ath, cache);

        verify(espnHttp, times(1)).get(any());
    }

    @Test
    void athleteName_ref_exceptionDuringFetch_cachesNullAndReturnsNull() throws Exception {
        JsonNode ath = json("{\"$ref\":\"http://sports.core.api.espn.com/v2/athletes/1\"}");
        when(espnHttp.get(any())).thenThrow(new RuntimeException("boom"));
        Map<String, String> cache = new HashMap<>();

        assertNull(helper.publicAthleteName(ath, cache));
        assertTrue(cache.containsKey("http://sports.core.api.espn.com/v2/athletes/1"));
        assertNull(cache.get("http://sports.core.api.espn.com/v2/athletes/1"));
    }

    @Test
    void athleteName_noInlineNameAndNoRef_returnsNull() throws Exception {
        assertNull(helper.publicAthleteName(json("{}"), new HashMap<>()));
    }

    @Test
    void resolveAthleteName_prefersParticipantsOverAthletesInvolved() throws Exception {
        JsonNode play = json("{\"participants\":[{\"athlete\":{\"displayName\":\"Aaron Judge\"}}],"
                + "\"athletesInvolved\":[{\"displayName\":\"Other Player\"}]}");

        assertEquals("Aaron Judge", helper.publicResolveAthleteName(play, new HashMap<>()));
    }

    @Test
    void resolveAthleteName_fallsBackToAthletesInvolved_whenParticipantsEmpty() throws Exception {
        JsonNode play = json("{\"participants\":[],\"athletesInvolved\":[{\"displayName\":\"Other Player\"}]}");

        assertEquals("Other Player", helper.publicResolveAthleteName(play, new HashMap<>()));
    }

    @Test
    void resolveAthleteName_neitherPresent_returnsNull() throws Exception {
        assertNull(helper.publicResolveAthleteName(json("{}"), new HashMap<>()));
    }

    // ---------------------------------------------------------------
    // resolveRef
    // ---------------------------------------------------------------

    @Test
    void resolveRef_nullOrMissingNode_returnsNull() throws Exception {
        assertNull(helper.publicResolveRef(null, new HashMap<>()));
        assertNull(helper.publicResolveRef(json("{\"x\":null}").path("x"), new HashMap<>()));
        assertNull(helper.publicResolveRef(json("{}").path("absent"), new HashMap<>()));
    }

    @Test
    void resolveRef_alreadyInlineExpanded_returnsAsIsWithoutFetching() throws Exception {
        JsonNode node = json("{\"displayName\":\"Already Resolved\"}");

        assertSame(node, helper.publicResolveRef(node, new HashMap<>()));
        verifyNoInteractions(espnHttp);
    }

    @Test
    void resolveRef_ref_fetchesAndCaches() throws Exception {
        JsonNode node = json("{\"$ref\":\"https://example.com/teams/1\"}");
        JsonNode resolved = json("{\"displayName\":\"Resolved Team\"}");
        when(espnHttp.get("https://example.com/teams/1")).thenReturn(resolved);
        Map<String, JsonNode> cache = new HashMap<>();

        assertSame(resolved, helper.publicResolveRef(node, cache));
        assertSame(resolved, helper.publicResolveRef(node, cache));
        verify(espnHttp, times(1)).get("https://example.com/teams/1");
    }

    @Test
    void resolveRef_ref_exceptionDuringFetch_cachesNullAndReturnsNull() throws Exception {
        JsonNode node = json("{\"$ref\":\"https://example.com/teams/1\"}");
        when(espnHttp.get(any())).thenThrow(new RuntimeException("boom"));
        Map<String, JsonNode> cache = new HashMap<>();

        assertNull(helper.publicResolveRef(node, cache));
        assertTrue(cache.containsKey("https://example.com/teams/1"));
        assertNull(cache.get("https://example.com/teams/1"));
    }

    @Test
    void resolveRef_noDisplayNameFullNameAndNoRef_returnsNull() throws Exception {
        assertNull(helper.publicResolveRef(json("{\"id\":\"1\"}"), new HashMap<>()));
    }
}
