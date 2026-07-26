package org.Spring.baseball.api;

import java.util.List;

import org.Spring.api.Dto;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.JsonNode;

// ============================================================================
// PLEASE review — REST boundary validation and error mapping
// ----------------------------------------------------------------------------
// The controller lets raw path/query values and thrown Exceptions cross the REST
// boundary. That makes bad league IDs, negative limits/pages, and ESPN failures
// surface as generic 500s instead of explicit 400/502 responses.
//
// EXAMPLE:
//   @Validated
//   @RestController
//   class BaseballController {
//       @GetMapping("/{league}/news")
//       ResponseEntity<List<Dto.NewsItem>> news(@PathVariable @Pattern(regexp = "[a-z0-9-]+") String league,
//               @RequestParam(defaultValue = "12") @Min(1) @Max(50) int limit) { ... }
//   }
//
// WHY: Controllers are the API contract; validation and status codes belong at this boundary.
// ============================================================================
@RestController
@RequestMapping("/api/baseball")
@CrossOrigin(origins = "*")
public class BaseballController {

    private final BaseballService service;

    public BaseballController(BaseballService service) {
        this.service = service;
    }

    @GetMapping("/{league}/scoreboard")
    public List<BaseballDto.GameDto> scoreboard(@PathVariable String league) throws Exception {
        return service.scoreboard(league);
    }

    @GetMapping("/{league}/fixtures")
    public BaseballDto.Fixtures fixtures(@PathVariable String league) throws Exception {
        return service.fixtures(league);
    }

    @GetMapping("/{league}/standings")
    public List<BaseballDto.StandingRow> standings(@PathVariable String league,
                                                   @RequestParam(defaultValue = "3") int level) throws Exception {
        return service.standings(league, level);
    }

    @GetMapping("/{league}/news")
    public List<Dto.NewsItem> news(@PathVariable String league,
                                   @RequestParam(defaultValue = "12") int limit) throws Exception {
        return service.news(league, limit);
    }

    @GetMapping("/{league}/teams/{teamId}")
    public Dto.TeamDetail team(@PathVariable String league,
                               @PathVariable String teamId) throws Exception {
        return service.team(league, teamId);
    }

    @GetMapping("/{league}/teams/{teamId}/roster")
    public List<Dto.Player> roster(@PathVariable String league,
                                   @PathVariable String teamId) throws Exception {
        return service.roster(league, teamId);
    }

    @GetMapping("/{league}/teams/{teamId}/injuries")
    public List<Dto.Injury> teamInjuries(@PathVariable String league,
                                         @PathVariable String teamId) throws Exception {
        return service.injuries(league, teamId);
    }

    @GetMapping("/{league}/injuries")
    public List<Dto.Injury> leagueInjuries(@PathVariable String league) throws Exception {
        return service.leagueInjuries(league);
    }

    @GetMapping("/{league}/transactions")
    public List<Dto.Transaction> transactions(@PathVariable String league,
                                              @RequestParam(defaultValue = "25") int limit) throws Exception {
        return service.transactions(league, limit);
    }

    @GetMapping("/{league}/athletes/{athleteId}/overview")
    public Dto.AthleteOverview athleteOverview(@PathVariable String league,
                                               @PathVariable String athleteId) throws Exception {
        return service.athleteOverview(league, athleteId);
    }

    @GetMapping("/{league}/leaders")
    public List<Dto.Leader> leaders(@PathVariable String league) throws Exception {
        return service.leaders(league);
    }

    @GetMapping("/{league}/match/{eventId}")
    public BaseballDto.GameDetail matchDetail(@PathVariable String league,
                                              @PathVariable String eventId) throws Exception {
        return service.matchDetail(league, eventId);
    }

    // ── reference data (raw passthrough) ──────────────────────────────────────

    @GetMapping("/{league}/teams")
    public JsonNode teams(@PathVariable String league,
                          @RequestParam(defaultValue = "1") int page,
                          @RequestParam(defaultValue = "50") int limit) throws Exception {
        return service.teams(league, page, limit);
    }

    @GetMapping("/{league}/teams/{teamId}/schedule")
    public JsonNode teamSchedule(@PathVariable String league, @PathVariable String teamId) throws Exception {
        return service.teamSchedule(league, teamId);
    }

    @GetMapping("/{league}/teams/{teamId}/record")
    public JsonNode teamRecord(@PathVariable String league, @PathVariable String teamId) throws Exception {
        return service.teamRecord(league, teamId);
    }

    @GetMapping("/{league}/teams/{teamId}/depth-charts")
    public JsonNode teamDepthChart(@PathVariable String league, @PathVariable String teamId) throws Exception {
        return service.teamDepthChart(league, teamId);
    }

    @GetMapping("/{league}/statistics")
    public JsonNode statistics(@PathVariable String league) throws Exception {
        return service.statistics(league);
    }

    @GetMapping("/{league}/groups")
    public JsonNode groups(@PathVariable String league) throws Exception {
        return service.groups(league);
    }

    @GetMapping("/{league}/rankings")
    public JsonNode rankings(@PathVariable String league) throws Exception {
        return service.rankings(league);
    }

    @GetMapping("/{league}/athletes/{athleteId}/news")
    public JsonNode athleteNews(@PathVariable String league, @PathVariable String athleteId,
                                @RequestParam(defaultValue = "12") int limit) throws Exception {
        return service.athleteNews(league, athleteId, limit);
    }

    @GetMapping("/{league}/athletes")
    public JsonNode athletes(@PathVariable String league,
                             @RequestParam(defaultValue = "1") int page,
                             @RequestParam(defaultValue = "50") int limit,
                             @RequestParam(defaultValue = "true") boolean active) throws Exception {
        return service.athletes(league, page, limit, active);
    }

    @GetMapping("/{league}/athletes/{athleteId}/stats")
    public JsonNode athleteStats(@PathVariable String league, @PathVariable String athleteId) throws Exception {
        return service.athleteStats(league, athleteId);
    }

    @GetMapping("/{league}/athletes/{athleteId}/gamelog")
    public JsonNode athleteGamelog(@PathVariable String league, @PathVariable String athleteId) throws Exception {
        return service.athleteGamelog(league, athleteId);
    }

    @GetMapping("/{league}/athletes/{athleteId}/splits")
    public JsonNode athleteSplits(@PathVariable String league, @PathVariable String athleteId) throws Exception {
        return service.athleteSplits(league, athleteId);
    }

    @GetMapping("/{league}/statistics/byathlete")
    public JsonNode statsByAthlete(@PathVariable String league,
                                   @RequestParam(required = false) String category,
                                   @RequestParam(required = false) String season,
                                   @RequestParam(required = false) String seasontype,
                                   @RequestParam(required = false) String sort) throws Exception {
        return service.statsByAthlete(league, category, season, seasontype, sort);
    }

    @GetMapping("/{league}/seasons/{season}/draft")
    public JsonNode draft(@PathVariable String league, @PathVariable String season,
                          @RequestParam(defaultValue = "1") int page,
                          @RequestParam(defaultValue = "50") int limit) throws Exception {
        return service.draft(league, season, page, limit);
    }

    @GetMapping("/{league}/seasons/{season}/freeagents")
    public JsonNode freeAgents(@PathVariable String league, @PathVariable String season,
                               @RequestParam(defaultValue = "1") int page,
                               @RequestParam(defaultValue = "50") int limit) throws Exception {
        return service.freeAgents(league, season, page, limit);
    }

    @GetMapping("/{league}/seasons/{season}/manufacturers")
    public JsonNode manufacturers(@PathVariable String league, @PathVariable String season,
                                  @RequestParam(defaultValue = "1") int page,
                                  @RequestParam(defaultValue = "50") int limit) throws Exception {
        return service.manufacturers(league, season, page, limit);
    }

    @GetMapping("/{league}/venues")
    public JsonNode venues(@PathVariable String league,
                           @RequestParam(defaultValue = "1") int page,
                           @RequestParam(defaultValue = "50") int limit) throws Exception {
        return service.venues(league, page, limit);
    }

    @GetMapping("/{league}/franchises")
    public JsonNode franchises(@PathVariable String league,
                               @RequestParam(defaultValue = "1") int page,
                               @RequestParam(defaultValue = "50") int limit) throws Exception {
        return service.franchises(league, page, limit);
    }

    @GetMapping("/{league}/positions")
    public JsonNode positions(@PathVariable String league,
                              @RequestParam(defaultValue = "1") int page,
                              @RequestParam(defaultValue = "50") int limit) throws Exception {
        return service.positions(league, page, limit);
    }

    @GetMapping("/{league}/providers")
    public JsonNode providers(@PathVariable String league) throws Exception {
        return service.providers(league);
    }

    @GetMapping("/{league}/countries")
    public JsonNode countries(@PathVariable String league,
                              @RequestParam(defaultValue = "1") int page,
                              @RequestParam(defaultValue = "100") int limit) throws Exception {
        return service.countries(league, page, limit);
    }

    @GetMapping("/{league}/recruiting")
    public JsonNode recruiting(@PathVariable String league,
                               @RequestParam(defaultValue = "1") int page,
                               @RequestParam(defaultValue = "50") int limit) throws Exception {
        return service.recruiting(league, page, limit);
    }

    @GetMapping("/{league}/tournaments")
    public JsonNode tournaments(@PathVariable String league,
                                @RequestParam(defaultValue = "false") boolean majorsOnly) throws Exception {
        return service.tournaments(league, majorsOnly);
    }

    @GetMapping("/{league}/calendar")
    public JsonNode calendar(@PathVariable String league,
                             @RequestParam(required = false) String dates) throws Exception {
        return service.calendar(league, dates);
    }

    @GetMapping("/{league}/seasons")
    public JsonNode seasons(@PathVariable String league,
                            @RequestParam(defaultValue = "1") int page,
                            @RequestParam(defaultValue = "25") int limit) throws Exception {
        return service.seasons(league, page, limit);
    }

    @GetMapping("/{league}/season")
    public JsonNode currentSeason(@PathVariable String league) throws Exception {
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

    @GetMapping("/cdn/{siteSlug}/scoreboard")
    public JsonNode cdnScoreboard(@PathVariable String siteSlug) throws Exception {
        return service.cdnScoreboard(siteSlug);
    }

    // ADDED — league-wide media (previously missing; this is the endpoint the
    // frontend's "Media & Video — backend endpoint in progress" placeholder
    // was waiting on, same gap as basketball/F1).
    @GetMapping("/{league}/media")
    public JsonNode media(@PathVariable String league) throws Exception {
        return service.media(league);
    }

    // ADDED — event/competition-level passthrough (broadcasts/odds/officials
    // as standalone resources, matching what matchDetail already embeds).

    @GetMapping("/{league}/events/{eventId}")
    public JsonNode eventDetail(@PathVariable String league, @PathVariable String eventId) throws Exception {
        return service.eventDetail(league, eventId);
    }

    @GetMapping("/{league}/events/{eventId}/competitions/{competitionId}")
    public JsonNode competitionDetail(@PathVariable String league, @PathVariable String eventId,
                                      @PathVariable String competitionId) throws Exception {
        return service.competitionDetail(league, eventId, competitionId);
    }

    @GetMapping("/{league}/events/{eventId}/competitions/{competitionId}/broadcasts")
    public JsonNode broadcasts(@PathVariable String league, @PathVariable String eventId,
                               @PathVariable String competitionId) throws Exception {
        return service.broadcasts(league, eventId, competitionId);
    }

    @GetMapping("/{league}/events/{eventId}/competitions/{competitionId}/odds")
    public JsonNode competitionOdds(@PathVariable String league, @PathVariable String eventId,
                                    @PathVariable String competitionId,
                                    @RequestParam(defaultValue = "1") int page,
                                    @RequestParam(defaultValue = "50") int limit) throws Exception {
        return service.competitionOdds(league, eventId, competitionId, page, limit);
    }

    @GetMapping("/{league}/events/{eventId}/competitions/{competitionId}/officials")
    public JsonNode officials(@PathVariable String league, @PathVariable String eventId,
                              @PathVariable String competitionId) throws Exception {
        return service.officials(league, eventId, competitionId);
    }

    // ADDED — raw JsonNode passthrough versions, matching what football already
    // exposes alongside its bespoke DTO endpoints.

    @GetMapping("/{league}/athletes/{athleteId}/overview/raw")
    public JsonNode athleteOverviewRaw(@PathVariable String league, @PathVariable String athleteId) throws Exception {
        return service.athleteOverviewRaw(league, athleteId);
    }

    @GetMapping("/{league}/seasons/{season}/leaders/raw")
    public JsonNode rawLeaders(@PathVariable String league, @PathVariable String season) throws Exception {
        return service.rawLeaders(league, season);
    }
}