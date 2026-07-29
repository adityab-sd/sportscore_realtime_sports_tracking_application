package org.Spring.football.api;

import java.util.List;

import org.Spring.api.Dto;
import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/**
 * API tests for FootballController (standalone MockMvc — no Spring/Mockito/Redis).
 * Football has a {league} path variable and no controller-side validation.
 * We check routing, that {league} binds through, and the news limit default.
 */
class FootballControllerTest {

    private FakeFootballService service;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        service = new FakeFootballService();
        mvc = MockMvcBuilders.standaloneSetup(new FootballController(service)).build();
    }

    @Test
    @DisplayName("GET /api/football/{league}/scoreboard is 200 and binds the league")
    void scoreboardOk() throws Exception {
        mvc.perform(get("/api/football/eng.1/scoreboard")).andExpect(status().isOk());
        assertThat(service.lastLeague).isEqualTo("eng.1");
    }

    @Test
    @DisplayName("GET /api/football/{league}/standings is 200")
    void standingsOk() throws Exception {
        mvc.perform(get("/api/football/eng.1/standings")).andExpect(status().isOk());
        assertThat(service.lastLeague).isEqualTo("eng.1");
    }

    @Test
    @DisplayName("GET /api/football/{league}/news defaults limit to 12")
    void newsDefaultLimit() throws Exception {
        mvc.perform(get("/api/football/eng.1/news")).andExpect(status().isOk());
        assertThat(service.lastNewsLimit).isEqualTo(12);
    }

    @Test
    @DisplayName("GET /api/football/{league}/news?limit=5 overrides the default")
    void newsOverrideLimit() throws Exception {
        mvc.perform(get("/api/football/eng.1/news").param("limit", "5")).andExpect(status().isOk());
        assertThat(service.lastNewsLimit).isEqualTo(5);
    }

    @Test
    @DisplayName("an invalid league slug now returns 400 (new validateLeague)")
    void invalidLeagueReturns400() throws Exception {
        mvc.perform(get("/api/football/INVALID/standings")).andExpect(status().isBadRequest());
    }

    static class FakeFootballService extends FootballService {
        String lastLeague;
        int lastNewsLimit = -1;

        @Override public List<Dto.MatchDto> scoreboard(String league) { lastLeague = league; return List.of(); }
        @Override public List<Dto.StandingRow> standings(String league) { lastLeague = league; return List.of(); }
        @Override public List<Dto.NewsItem> news(String league, int limit) {
            lastLeague = league; lastNewsLimit = limit; return List.of();
        }
    }
}