package org.Spring.basketball.api;

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
 * API tests for BasketballController (standalone MockMvc).
 * Basketball has a {league} path variable AND controller-side validation
 * (validateLeague -> 400, clampLimit on news), so we test those too.
 */
class BasketballControllerTest {

    private FakeBasketballService service;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        service = new FakeBasketballService();
        mvc = MockMvcBuilders.standaloneSetup(new BasketballController(service)).build();
    }

    @Test
    @DisplayName("GET /{league}/scoreboard is 200 and binds the league")
    void scoreboardOk() throws Exception {
        mvc.perform(get("/api/basketball/nba/scoreboard")).andExpect(status().isOk());
        assertThat(service.lastLeague).isEqualTo("nba");
    }

    @Test
    @DisplayName("GET /{league}/standings defaults level to 3")
    void standingsDefaultLevel() throws Exception {
        mvc.perform(get("/api/basketball/nba/standings")).andExpect(status().isOk());
        assertThat(service.lastLevel).isEqualTo(3);
    }

    @Test
    @DisplayName("GET /{league}/standings?level=1 overrides the default level")
    void standingsOverrideLevel() throws Exception {
        mvc.perform(get("/api/basketball/nba/standings").param("level", "1")).andExpect(status().isOk());
        assertThat(service.lastLevel).isEqualTo(1);
    }

    @Test
    @DisplayName("GET /{league}/news?limit=999 is clamped to the 50 max")
    void newsClampsHugeLimit() throws Exception {
        mvc.perform(get("/api/basketball/nba/news").param("limit", "999")).andExpect(status().isOk());
        assertThat(service.lastNewsLimit).isEqualTo(50);
    }

    @Test
    @DisplayName("an invalid league slug returns 400 (validateLeague)")
    void invalidLeagueReturns400() throws Exception {
        mvc.perform(get("/api/basketball/INVALID/standings")).andExpect(status().isBadRequest());
    }

    static class FakeBasketballService extends BasketballService {
        String lastLeague;
        int lastLevel = -1;
        int lastNewsLimit = -1;

        @Override public List<BasketballDto.GameDto> scoreboard(String league) { lastLeague = league; return List.of(); }

        // ADDRESSED: same root cause as baseball. The controller now calls the three-arg
        // standings(league, level, season) directly (stack trace: controller -> line 108 with
        // no delegating frame), so the old two-arg override was bypassed and the real method
        // hit ESPN through a null espnHttp. Overriding the three-arg version fixes it.
        @Override public List<BasketballDto.StandingRow> standings(String league, int level, String season) {
            lastLeague = league; lastLevel = level; return List.of();
        }

        @Override public List<Dto.NewsItem> news(String league, int limit) {
            lastLeague = league; lastNewsLimit = limit; return List.of();
        }
    }
}