package org.Spring.f1.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Field;
import java.net.http.HttpClient;
import java.util.ArrayList;
import java.util.List;

import org.Spring.api.EspnApiHelper;
import org.Spring.api.EspnHttpClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Unit tests for F1Service.standings() — the highest-value business logic in F1.
 *
 * We don't reconstruct ESPN's whole $ref standings tree. The site-v2 /standings
 * call returns a full drivers+constructors tree, and when it does, F1Service
 * parses it inline and never touches the core-API fallback — so ONE canned JSON
 * drives the parse AND the monotonic-cache guard.
 *
 * F1Service has no constructor; it inherits an @Autowired EspnHttpClient field
 * from EspnApiHelper, so we set that field directly with a fake (fresh instance
 * per test, so lastGoodStandings never leaks between tests). No Spring, no Mockito.
 *
 * What we're protecting:
 *   - the monotonic guard: a lower/stale points total never replaces the cached
 *     good one (this is the exact 204-vs-183 flip bug)
 *   - a genuinely higher total DOES update the cache
 *   - the season-fallback fix: a past year is computed from race results and must
 *     NOT read the current-season standings endpoint
 */
class F1ServiceStandingsTest {

    private FakeHttpClient fake;
    private F1Service service;

    @BeforeEach
    void setUp() throws Exception {
        fake = new FakeHttpClient();
        service = new F1Service();
        setInheritedField(service, "espnHttp", fake);
        setInheritedField(service, "mapper", new ObjectMapper());
    }

    @Test
    @DisplayName("first fetch is parsed and returned with drivers + constructors")
    void firstFetchParsedAndReturned() throws Exception {
        fake.standingsResponse = standingsTree(100, 80);   // driver total 180

        var s = service.standings(null);

        assertThat(s.drivers()).hasSize(2);
        assertThat(s.constructors()).hasSize(1);
        assertThat(totalDriverPoints(s)).isEqualTo(180.0);
    }

    @Test
    @DisplayName("a lower (stale) points total does NOT replace the cached good one")
    void staleTotalDoesNotReplaceCache() throws Exception {
        fake.standingsResponse = standingsTree(204, 150);  // total 354 -> cached
        assertThat(totalDriverPoints(service.standings(null))).isEqualTo(354.0);

        fake.standingsResponse = standingsTree(150, 150);  // total 300 (regressed)
        // Guard must keep serving the last-good 354, not the stale 300.
        assertThat(totalDriverPoints(service.standings(null))).isEqualTo(354.0);
    }

    @Test
    @DisplayName("a genuinely higher points total updates the cache")
    void higherTotalUpdatesCache() throws Exception {
        fake.standingsResponse = standingsTree(204, 150);  // 354
        service.standings(null);

        fake.standingsResponse = standingsTree(250, 200);  // 450 (points went up)
        assertThat(totalDriverPoints(service.standings(null))).isEqualTo(450.0);
    }

    @Test
    @DisplayName("a past season is computed from results and never reads the current standings endpoint")
    void historicalSeasonDoesNotUseCurrentStandings() throws Exception {
        // If the season-fallback branch were broken, this huge current table would
        // wrongly appear for the year 2000.
        fake.standingsResponse = standingsTree(999, 999);

        var historical = service.standings(2000);          // clearly a past season

        assertThat(historical.constructors()).isEmpty();   // history returns no constructors
        assertThat(historical.drivers()).isEmpty();         // no race data fed -> empty, not current
        assertThat(fake.requested)
                .as("historical query must not touch the untrustworthy current-standings endpoint")
                .noneMatch(url -> url.contains("apis/v2/sports/racing/f1/standings"));
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private double totalDriverPoints(F1Dto.Standings s) {
        return s.drivers().stream().mapToDouble(F1Dto.DriverStanding::points).sum();
    }

    private void setInheritedField(Object target, String name, Object value) throws Exception {
        Field f = EspnApiHelper.class.getDeclaredField(name);
        f.setAccessible(true);
        f.set(target, value);
    }

    /** Builds a site-v2 standings tree with two drivers (given points) and one constructor. */
    private JsonNode standingsTree(int driver1Points, int driver2Points) throws Exception {
        String json = """
            {
              "standings": [
                {
                  "name": "Drivers",
                  "standings": { "entries": [
                    { "athlete": {"id":"4001","fullName":"Max Verstappen","flag":{"href":"a"},"team":{"displayName":"Red Bull"}},
                      "team":{"displayName":"Red Bull"},
                      "stats":[{"name":"points","value":%d},{"name":"wins","value":5}] },
                    { "athlete": {"id":"4002","fullName":"Lando Norris","flag":{"href":"b"},"team":{"displayName":"McLaren"}},
                      "team":{"displayName":"McLaren"},
                      "stats":[{"name":"points","value":%d},{"name":"wins","value":2}] }
                  ]}
                },
                {
                  "name": "Constructors",
                  "standings": { "entries": [
                    { "team":{"id":"1","displayName":"Red Bull","logo":"c"},
                      "stats":[{"name":"points","value":300},{"name":"wins","value":7}] }
                  ]}
                }
              ]
            }
            """.formatted(driver1Points, driver2Points);
        return new ObjectMapper().readTree(json);
    }

    /**
     * Fake HTTP client: records every requested URL, returns the settable
     * standings tree for the site-v2 /standings call, and an empty node for
     * everything else (so the results-based fallback yields an empty list).
     */
    static class FakeHttpClient extends EspnHttpClient {
        private final ObjectMapper m = new ObjectMapper();
        final List<String> requested = new ArrayList<>();
        JsonNode standingsResponse;

        FakeHttpClient() { super(HttpClient.newHttpClient(), new ObjectMapper(), null); }

        @Override
        public JsonNode get(String url) {
            requested.add(url);
            if (url.endsWith("/apis/v2/sports/racing/f1/standings") && standingsResponse != null) {
                return standingsResponse;
            }
            return m.createObjectNode();
        }
    }
}