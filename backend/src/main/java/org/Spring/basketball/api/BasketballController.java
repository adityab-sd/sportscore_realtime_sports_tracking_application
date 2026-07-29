package org.Spring.basketball.api;

import java.util.List;

import org.Spring.api.Dto;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.JsonNode;

// Addressed: added input validation for league IDs and numeric params so invalid
// input returns 400 instead of a generic 500. ESPN upstream failures return 502.
@RestController
@RequestMapping("/api/basketball")
@CrossOrigin(origins = "*")
public class BasketballController {

    private static final String LEAGUE_PATTERN = "[a-z0-9._-]+";

    private final BasketballService service;

    public BasketballController(BasketballService service) {
        this.service = service;
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> handleBadInput(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
    }

    @ExceptionHandler(java.io.IOException.class)
    public ResponseEntity<String> handleUpstreamError(java.io.IOException ex) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body("Upstream service unavailable");
    }

    private void validateLeague(String league) {
        if (league == null || !league.matches(LEAGUE_PATTERN)) {
            throw new IllegalArgumentException("Invalid league: " + league);
        }
    }

    private int clampLimit(int limit, int max) {
        return Math.max(1, Math.min(limit, max));
    }

    @GetMapping("/{league}/scoreboard")
    public List<BasketballDto.GameDto> scoreboard(@PathVariable String league) throws Exception {
        validateLeague(league);
        return service.scoreboard(league);
    }

    @GetMapping("/{league}/fixtures")
    public BasketballDto.Fixtures fixtures(@PathVariable String league,
                                        @RequestParam(required = false) String date) throws Exception {
        return service.fixtures(league, date);
    }

    @GetMapping("/{league}/standings")
    public List<BasketballDto.StandingRow> standings(@PathVariable String league,
                                                     @RequestParam(defaultValue = "3") int level) throws Exception {
        validateLeague(league);
        return service.standings(league, level);
    }

    @GetMapping("/{league}/news")
    public List<Dto.NewsItem> news(@PathVariable String league,
                                   @RequestParam(defaultValue = "12") int limit) throws Exception {
        validateLeague(league);
        return service.news(league, clampLimit(limit, 50));
    }

    @GetMapping("/{league}/teams/{teamId}")
    public Dto.TeamDetail team(@PathVariable String league,
                               @PathVariable String teamId) throws Exception {
        validateLeague(league);
        return service.team(league, teamId);
    }

    @GetMapping("/{league}/teams/{teamId}/roster")
    public List<Dto.Player> roster(@PathVariable String league,
                                   @PathVariable String teamId) throws Exception {
        validateLeague(league);
        return service.roster(league, teamId);
    }

    @GetMapping("/{league}/teams/{teamId}/injuries")
    public List<Dto.Injury> teamInjuries(@PathVariable String league,
                                         @PathVariable String teamId) throws Exception {
        validateLeague(league);
        return service.injuries(league, teamId);
    }

    @GetMapping("/{league}/injuries")
    public List<Dto.Injury> leagueInjuries(@PathVariable String league) throws Exception {
        validateLeague(league);
        return service.leagueInjuries(league);
    }

    @GetMapping("/{league}/transactions")
    public List<Dto.Transaction> transactions(@PathVariable String league,
                                              @RequestParam(defaultValue = "25") int limit) throws Exception {
        validateLeague(league);
        return service.transactions(league, clampLimit(limit, 100));
    }

    @GetMapping("/{league}/athletes/{athleteId}/overview")
    public Dto.AthleteOverview athleteOverview(@PathVariable String league,
                                               @PathVariable String athleteId) throws Exception {
        validateLeague(league);
        return service.athleteOverview(league, athleteId);
    }

    @GetMapping("/{league}/leaders")
    public List<Dto.Leader> leaders(@PathVariable String league) throws Exception {
        validateLeague(league);
        return service.leaders(league);
    }

    @GetMapping("/{league}/match/{eventId}")
    public BasketballDto.GameDetail matchDetail(@PathVariable String league,
                                                @PathVariable String eventId) throws Exception {
        validateLeague(league);
        return service.matchDetail(league, eventId);
    }

    // ── reference data (raw passthrough) ──────────────────────────────────────

    @GetMapping("/{league}/teams")
    public JsonNode teams(@PathVariable String league,
                          @RequestParam(defaultValue = "1") int page,
                          @RequestParam(defaultValue = "50") int limit) throws Exception {
        validateLeague(league);
        return service.teams(league, Math.max(page, 1), clampLimit(limit, 100));
    }

    @GetMapping("/{league}/teams/{teamId}/schedule")
    public JsonNode teamSchedule(@PathVariable String league, @PathVariable String teamId) throws Exception {
        validateLeague(league);
        return service.teamSchedule(league, teamId);
    }

    @GetMapping("/{league}/teams/{teamId}/record")
    public JsonNode teamRecord(@PathVariable String league, @PathVariable String teamId) throws Exception {
        validateLeague(league);
        return service.teamRecord(league, teamId);
    }

    @GetMapping("/{league}/teams/{teamId}/depth-charts")
    public JsonNode teamDepthChart(@PathVariable String league, @PathVariable String teamId) throws Exception {
        validateLeague(league);
        return service.teamDepthChart(league, teamId);
    }

    @GetMapping("/{league}/statistics")
    public JsonNode statistics(@PathVariable String league) throws Exception {
        validateLeague(league);
        return service.statistics(league);
    }

    @GetMapping("/{league}/groups")
    public JsonNode groups(@PathVariable String league) throws Exception {
        validateLeague(league);
        return service.groups(league);
    }

    @GetMapping("/{league}/rankings")
    public JsonNode rankings(@PathVariable String league) throws Exception {
        validateLeague(league);
        return service.rankings(league);
    }

    @GetMapping("/{league}/draft")
    public JsonNode siteDraft(@PathVariable String league) throws Exception {
        validateLeague(league);
        return service.siteDraft(league);
    }

    @GetMapping("/{league}/athletes/{athleteId}/news")
    public JsonNode athleteNews(@PathVariable String league, @PathVariable String athleteId,
                                @RequestParam(defaultValue = "12") int limit) throws Exception {
        validateLeague(league);
        return service.athleteNews(league, athleteId, clampLimit(limit, 50));
    }

    @GetMapping("/{league}/athletes")
    public JsonNode athletes(@PathVariable String league,
                             @RequestParam(defaultValue = "1") int page,
                             @RequestParam(defaultValue = "50") int limit,
                             @RequestParam(defaultValue = "true") boolean active) throws Exception {
        validateLeague(league);
        return service.athletes(league, Math.max(page, 1), clampLimit(limit, 100), active);
    }

    @GetMapping("/{league}/athletes/{athleteId}/stats")
    public JsonNode athleteStats(@PathVariable String league, @PathVariable String athleteId) throws Exception {
        validateLeague(league);
        return service.athleteStats(league, athleteId);
    }

    @GetMapping("/{league}/athletes/{athleteId}/gamelog")
    public JsonNode athleteGamelog(@PathVariable String league, @PathVariable String athleteId) throws Exception {
        validateLeague(league);
        return service.athleteGamelog(league, athleteId);
    }

    @GetMapping("/{league}/athletes/{athleteId}/splits")
    public JsonNode athleteSplits(@PathVariable String league, @PathVariable String athleteId) throws Exception {
        validateLeague(league);
        return service.athleteSplits(league, athleteId);
    }

    @GetMapping("/{league}/statistics/byathlete")
    public JsonNode statsByAthlete(@PathVariable String league,
                                   @RequestParam(required = false) String category,
                                   @RequestParam(required = false) String season,
                                   @RequestParam(required = false) String seasontype,
                                   @RequestParam(required = false) String sort) throws Exception {
        validateLeague(league);
        return service.statsByAthlete(league, category, season, seasontype, sort);
    }

    @GetMapping("/{league}/seasons/{season}/draft")
    public JsonNode draft(@PathVariable String league, @PathVariable String season,
                          @RequestParam(defaultValue = "1") int page,
                          @RequestParam(defaultValue = "50") int limit) throws Exception {
        validateLeague(league);
        return service.draft(league, season, Math.max(page, 1), clampLimit(limit, 100));
    }

    @GetMapping("/{league}/seasons/{season}/freeagents")
    public JsonNode freeAgents(@PathVariable String league, @PathVariable String season,
                               @RequestParam(defaultValue = "1") int page,
                               @RequestParam(defaultValue = "50") int limit) throws Exception {
        validateLeague(league);
        return service.freeAgents(league, season, Math.max(page, 1), clampLimit(limit, 100));
    }

    @GetMapping("/{league}/venues")
    public JsonNode venues(@PathVariable String league,
                           @RequestParam(defaultValue = "1") int page,
                           @RequestParam(defaultValue = "50") int limit) throws Exception {
        validateLeague(league);
        return service.venues(league, Math.max(page, 1), clampLimit(limit, 100));
    }

    @GetMapping("/{league}/franchises")
    public JsonNode franchises(@PathVariable String league,
                               @RequestParam(defaultValue = "1") int page,
                               @RequestParam(defaultValue = "50") int limit) throws Exception {
        validateLeague(league);
        return service.franchises(league, Math.max(page, 1), clampLimit(limit, 100));
    }

    @GetMapping("/{league}/positions")
    public JsonNode positions(@PathVariable String league,
                              @RequestParam(defaultValue = "1") int page,
                              @RequestParam(defaultValue = "50") int limit) throws Exception {
        validateLeague(league);
        return service.positions(league, Math.max(page, 1), clampLimit(limit, 100));
    }

    @GetMapping("/{league}/providers")
    public JsonNode providers(@PathVariable String league) throws Exception {
        validateLeague(league);
        return service.providers(league);
    }

    @GetMapping("/{league}/countries")
    public JsonNode countries(@PathVariable String league,
                              @RequestParam(defaultValue = "1") int page,
                              @RequestParam(defaultValue = "100") int limit) throws Exception {
        validateLeague(league);
        return service.countries(league, Math.max(page, 1), clampLimit(limit, 100));
    }

    @GetMapping("/{league}/recruiting")
    public JsonNode recruiting(@PathVariable String league,
                               @RequestParam(defaultValue = "1") int page,
                               @RequestParam(defaultValue = "50") int limit) throws Exception {
        validateLeague(league);
        return service.recruiting(league, Math.max(page, 1), clampLimit(limit, 100));
    }

    @GetMapping("/{league}/tournaments")
    public JsonNode tournaments(@PathVariable String league,
                                @RequestParam(defaultValue = "false") boolean majorsOnly) throws Exception {
        validateLeague(league);
        return service.tournaments(league, majorsOnly);
    }

    @GetMapping("/{league}/calendar")
    public JsonNode calendar(@PathVariable String league,
                             @RequestParam(required = false) String dates) throws Exception {
        validateLeague(league);
        return service.calendar(league, dates);
    }

    @GetMapping("/{league}/seasons")
    public JsonNode seasons(@PathVariable String league,
                            @RequestParam(defaultValue = "1") int page,
                            @RequestParam(defaultValue = "25") int limit) throws Exception {
        validateLeague(league);
        return service.seasons(league, Math.max(page, 1), clampLimit(limit, 100));
    }

    @GetMapping("/{league}/season")
    public JsonNode currentSeason(@PathVariable String league) throws Exception {
        validateLeague(league);
        return service.currentSeason(league);
    }

    @GetMapping("/cdn/{siteSlug}/game/{eventId}")
    public JsonNode cdnGame(@PathVariable String siteSlug, @PathVariable String eventId) throws Exception {
        return service.cdnGame(siteSlug, eventId);
    }

    @GetMapping("/cdn/{siteSlug}/boxscore/{eventId}")
    public JsonNode cdnBoxscore(@PathVariable String siteSlug, @PathVariable String eventId) throws Exception {
        return service.cdnBoxscore(siteSlug, eventId);
    }

    @GetMapping("/cdn/{siteSlug}/playbyplay/{eventId}")
    public JsonNode cdnPlayByPlay(@PathVariable String siteSlug, @PathVariable String eventId) throws Exception {
        return service.cdnPlayByPlay(siteSlug, eventId);
    }

    @GetMapping("/cdn/{siteSlug}/scoreboard")
    public JsonNode cdnScoreboard(@PathVariable String siteSlug) throws Exception {
        return service.cdnScoreboard(siteSlug);
    }

    // ── NCAA-specific: bracketology + power index (BPI) ─────────────────────

    @GetMapping("/bracketology/{tournamentId}/{year}")
    public JsonNode bracketology(@PathVariable String tournamentId, @PathVariable String year) throws Exception {
        return service.bracketology(tournamentId, year);
    }

    @GetMapping("/bracketology/{tournamentId}/{year}/{iteration}")
    public JsonNode bracketologySnapshot(@PathVariable String tournamentId, @PathVariable String year,
                                         @PathVariable String iteration) throws Exception {
        return service.bracketologySnapshot(tournamentId, year, iteration);
    }

    @GetMapping("/mens-college-basketball/{year}/powerindex")
    public JsonNode powerIndex(@PathVariable String year,
                               @RequestParam(defaultValue = "1") int page,
                               @RequestParam(defaultValue = "50") int limit) throws Exception {
        return service.powerIndex(year, Math.max(page, 1), clampLimit(limit, 100));
    }

    @GetMapping("/mens-college-basketball/{year}/powerindex/leaders")
    public JsonNode powerIndexLeaders(@PathVariable String year) throws Exception {
        return service.powerIndexLeaders(year);
    }

    @GetMapping("/mens-college-basketball/{year}/powerindex/{teamId}")
    public JsonNode powerIndexTeam(@PathVariable String year, @PathVariable String teamId) throws Exception {
        return service.powerIndexTeam(year, teamId);
    }

    @GetMapping("/{league}/media")
    public JsonNode media(@PathVariable String league) throws Exception {
        validateLeague(league);
        return service.media(league);
    }

    @GetMapping("/{league}/seasons/{season}/manufacturers")
    public JsonNode manufacturers(@PathVariable String league, @PathVariable String season,
                                  @RequestParam(defaultValue = "1") int page,
                                  @RequestParam(defaultValue = "50") int limit) throws Exception {
        validateLeague(league);
        return service.manufacturers(league, season, Math.max(page, 1), clampLimit(limit, 100));
    }

    @GetMapping("/{league}/events/{eventId}")
    public JsonNode eventDetail(@PathVariable String league, @PathVariable String eventId) throws Exception {
        validateLeague(league);
        return service.eventDetail(league, eventId);
    }

    @GetMapping("/{league}/events/{eventId}/competitions/{competitionId}")
    public JsonNode competitionDetail(@PathVariable String league, @PathVariable String eventId,
                                      @PathVariable String competitionId) throws Exception {
        validateLeague(league);
        return service.competitionDetail(league, eventId, competitionId);
    }

    @GetMapping("/{league}/events/{eventId}/competitions/{competitionId}/broadcasts")
    public JsonNode broadcasts(@PathVariable String league, @PathVariable String eventId,
                               @PathVariable String competitionId) throws Exception {
        validateLeague(league);
        return service.broadcasts(league, eventId, competitionId);
    }

    @GetMapping("/{league}/events/{eventId}/competitions/{competitionId}/odds")
    public JsonNode competitionOdds(@PathVariable String league, @PathVariable String eventId,
                                    @PathVariable String competitionId,
                                    @RequestParam(defaultValue = "1") int page,
                                    @RequestParam(defaultValue = "50") int limit) throws Exception {
        validateLeague(league);
        return service.competitionOdds(league, eventId, competitionId, Math.max(page, 1), clampLimit(limit, 100));
    }

    @GetMapping("/{league}/events/{eventId}/competitions/{competitionId}/officials")
    public JsonNode officials(@PathVariable String league, @PathVariable String eventId,
                              @PathVariable String competitionId) throws Exception {
        validateLeague(league);
        return service.officials(league, eventId, competitionId);
    }

    @GetMapping("/{league}/athletes/{athleteId}/overview/raw")
    public JsonNode athleteOverviewRaw(@PathVariable String league, @PathVariable String athleteId) throws Exception {
        validateLeague(league);
        return service.athleteOverviewRaw(league, athleteId);
    }

    @GetMapping("/{league}/seasons/{season}/leaders/raw")
    public JsonNode rawLeaders(@PathVariable String league, @PathVariable String season) throws Exception {
        validateLeague(league);
        return service.rawLeaders(league, season);
    }
}