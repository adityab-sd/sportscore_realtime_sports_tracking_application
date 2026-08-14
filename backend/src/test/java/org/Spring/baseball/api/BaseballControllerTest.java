package org.Spring.baseball.api;

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
 * API tests for BaseballController (standalone MockMvc).
 * Same shape as basketball: {league} path var, validateLeague -> 400, clampLimit.
 */
class BaseballControllerTest {

    private FakeBaseballService service;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        service = new FakeBaseballService();
        mvc = MockMvcBuilders.standaloneSetup(new BaseballController(service)).build();
    }

    @Test
    @DisplayName("GET /{league}/scoreboard is 200 and binds the league")
    void scoreboardOk() throws Exception {
        mvc.perform(get("/api/baseball/mlb/scoreboard")).andExpect(status().isOk());
        assertThat(service.lastLeague).isEqualTo("mlb");
    }

    @Test
    @DisplayName("GET /{league}/standings defaults level to 3")
    void standingsDefaultLevel() throws Exception {
        mvc.perform(get("/api/baseball/mlb/standings")).andExpect(status().isOk());
        assertThat(service.lastLevel).isEqualTo(3);
    }

    @Test
    @DisplayName("GET /{league}/standings?level=1 overrides the default level")
    void standingsOverrideLevel() throws Exception {
        mvc.perform(get("/api/baseball/mlb/standings").param("level", "1")).andExpect(status().isOk());
        assertThat(service.lastLevel).isEqualTo(1);
    }

    @Test
    @DisplayName("GET /{league}/news?limit=999 is clamped to the 50 max")
    void newsClampsHugeLimit() throws Exception {
        mvc.perform(get("/api/baseball/mlb/news").param("limit", "999")).andExpect(status().isOk());
        assertThat(service.lastNewsLimit).isEqualTo(50);
    }

    @Test
    @DisplayName("an invalid league slug returns 400 (validateLeague)")
    void invalidLeagueReturns400() throws Exception {
        mvc.perform(get("/api/baseball/INVALID/standings")).andExpect(status().isBadRequest());
    }

    static class FakeBaseballService extends BaseballService {
        String lastLeague;
        int lastLevel = -1;
        int lastNewsLimit = -1;

        @Override public List<BaseballDto.GameDto> scoreboard(String league) { lastLeague = league; return List.of(); }

        // ADDRESSED: the controller now calls the three-arg standings(league, level, season)
        // directly (confirmed by the stack trace: controller -> BaseballService line 140 with
        // no delegating frame in between). The old two-arg override no longer intercepted that
        // call, so the real method ran and hit ESPN through a null espnHttp. Overriding the
        // three-arg version puts the fake back in control. season is unused by these tests.
        @Override public List<BaseballDto.StandingRow> standings(String league, int level, String season) {
            lastLeague = league; lastLevel = level; return List.of();
        }

        @Override public List<Dto.NewsItem> news(String league, int limit) {
            lastLeague = league; lastNewsLimit = limit; return List.of();
        }
    }
}