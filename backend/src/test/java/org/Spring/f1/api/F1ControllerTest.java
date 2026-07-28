package org.Spring.f1.api;

import java.util.List;

import org.Spring.api.Dto;
import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/**
 * API tests for F1Controller.
 *
 * Standalone MockMvc on purpose: we build the controller directly around a
 * hand-written FakeF1Service — no Spring context, so no Mockito (Java 26 issue),
 * no security config, no Redis. This still exercises the real MVC layer: URL
 * routing, query-param binding, @RequestParam defaults, and JSON serialization.
 *
 * What we're protecting:
 *   - the endpoints are wired to the right paths and return 200 with the expected JSON
 *   - ?year= binds through to the service (and defaults to null when omitted)
 *   - ?limit= defaults to 12 and is overridable
 */
class F1ControllerTest {

    private FakeF1Service service;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        service = new FakeF1Service();
        mvc = MockMvcBuilders.standaloneSetup(new F1Controller(service)).build();
    }

    @Test
    @DisplayName("GET /api/f1/standings returns 200 with the driver table")
    void standingsReturnsOk() throws Exception {
        mvc.perform(get("/api/f1/standings"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.drivers[0].driver").value("Max Verstappen"))
           .andExpect(jsonPath("$.drivers[0].rank").value(1))
           .andExpect(jsonPath("$.constructors[0].team").value("Red Bull"));
    }

    @Test
    @DisplayName("GET /api/f1/standings?year=2022 passes the year through to the service")
    void standingsPassesYear() throws Exception {
        mvc.perform(get("/api/f1/standings").param("year", "2022"))
           .andExpect(status().isOk());
        assertThat(service.lastYear).isEqualTo(2022);
    }

    @Test
    @DisplayName("GET /api/f1/standings with no year defaults the year to null")
    void standingsDefaultsYearToNull() throws Exception {
        mvc.perform(get("/api/f1/standings"))
           .andExpect(status().isOk());
        assertThat(service.lastYear).isNull();
    }

    @Test
    @DisplayName("GET /api/f1/scoreboard returns 200 with a list of weekends")
    void scoreboardReturnsOk() throws Exception {
        mvc.perform(get("/api/f1/scoreboard"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$[0].name").value("Monaco Grand Prix"));
    }

    @Test
    @DisplayName("GET /api/f1/news defaults limit to 12")
    void newsDefaultsLimit() throws Exception {
        mvc.perform(get("/api/f1/news"))
           .andExpect(status().isOk());
        assertThat(service.lastNewsLimit).isEqualTo(12);
    }

    @Test
    @DisplayName("GET /api/f1/news?limit=5 overrides the default limit")
    void newsRespectsLimit() throws Exception {
        mvc.perform(get("/api/f1/news").param("limit", "5"))
           .andExpect(status().isOk());
        assertThat(service.lastNewsLimit).isEqualTo(5);
    }

    /**
     * Hand-written stand-in for F1Service. Overrides only the methods these tests
     * hit and records the arguments the controller passed, so we can assert
     * param binding without any mocking framework.
     */
    static class FakeF1Service extends F1Service {
        Integer lastYear;
        int lastNewsLimit = -1;

        @Override
        public F1Dto.Standings standings(Integer year) {
            this.lastYear = year;
            return new F1Dto.Standings(
                    List.of(new F1Dto.DriverStanding(1, "4001", "Max Verstappen", "flag", "Red Bull", 204, 5)),
                    List.of(new F1Dto.ConstructorStanding(1, "1", "Red Bull", "logo", 300, 7)));
        }

        @Override
        public List<F1Dto.RaceWeekend> scoreboard(Integer year) {
            this.lastYear = year;
            return List.of(new F1Dto.RaceWeekend(
                    "600001", "Monaco Grand Prix", "Circuit de Monaco", "Monaco", "Monaco",
                    "2026-05-22", "2026-05-24", "in", List.of()));
        }

        @Override
        public List<Dto.NewsItem> news(int limit) {
            this.lastNewsLimit = limit;
            return List.of();
        }
    }
}