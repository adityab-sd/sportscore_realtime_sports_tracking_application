package org.Spring.football.api;

import java.util.List;

import org.Spring.api.Dto;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Clean football endpoints for the frontend. Returns DTOs whose shapes match
 * the frontend's TypeScript interfaces, so Vamsi only fetches-and-uses (no parsing).
 *
 * Live scores are NOT here - they are pushed via Event Hub -> SignalR.
 *
 * Replaces FootballGatewayController.java / any earlier FootballController.java.
 * Keep only ONE controller on /api/football/** or Spring won't start.
 */
// ============================================================================
// PLEASE review — controller-wide concerns:
// 1) SECURITY: @CrossOrigin(origins = "*") allows any site to call every endpoint.
//    Restrict to known frontend origins (config-driven).
// 2) Every handler declares `throws Exception`, so any upstream failure surfaces as a
//    raw 500 + stack trace. Add a @RestControllerAdvice to map errors to clean statuses.
// 3) `@PathVariable String league` is never validated but is used to build ESPN URLs.
//    Constrain it to a known set (enum/allowlist) to avoid bad/abusive upstream calls.
// EXAMPLE:
//   @CrossOrigin(origins = "${app.allowed-origins}")
//   @ExceptionHandler(Exception.class)
//   ResponseEntity<?> onError(Exception e){ return ResponseEntity.status(502).body(...); }
//   if (!League.isValid(league)) throw new ResponseStatusException(BAD_REQUEST, "unknown league");
// ============================================================================
@RestController
@RequestMapping("/api/football")
@CrossOrigin(origins = "*")
public class FootballController {

    private final FootballService service;

    public FootballController(FootballService service) {
        this.service = service;
    }

    @GetMapping("/{league}/scoreboard")
    public List<Dto.MatchDto> scoreboard(@PathVariable String league) throws Exception {
        return service.scoreboard(league);
    }

    @GetMapping("/{league}/fixtures")
    public Dto.Fixtures fixtures(@PathVariable String league) throws Exception {
        return service.fixtures(league);
    }

    @GetMapping("/{league}/standings")
    public List<Dto.StandingRow> standings(@PathVariable String league) throws Exception {
        return service.standings(league);
    }

    @GetMapping("/{league}/news")
    public List<Dto.NewsItem> news(@PathVariable String league,
                                   @RequestParam(defaultValue = "12") int limit) throws Exception {
        return service.news(league, limit);
    }

    @GetMapping("/{league}/teams/{teamId}")
    public Dto.TeamDetail team(@PathVariable String league, @PathVariable String teamId) throws Exception {
        return service.team(league, teamId);
    }

    @GetMapping("/{league}/teams/{teamId}/roster")
    public List<Dto.Player> roster(@PathVariable String league, @PathVariable String teamId) throws Exception {
        return service.roster(league, teamId);
    }

    @GetMapping("/{league}/leaders")
    public List<Dto.Leader> leaders(@PathVariable String league) throws Exception {
        return service.leaders(league);
    }

    @GetMapping("/{league}/match/{eventId}")
    public Dto.MatchDetail matchDetail(@PathVariable String league, @PathVariable String eventId) throws Exception {
        return service.matchDetail(league, eventId);
    }

    // ── injuries / transactions / athlete overview ──────────────────────────

    @GetMapping("/{league}/teams/{teamId}/injuries")
    public List<Dto.Injury> teamInjuries(@PathVariable String league, @PathVariable String teamId) throws Exception {
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

    // ── reference data (raw passthrough — see FootballService's class comment) ──

    // PLEASE review — unbounded pagination + raw passthrough (applies to every JsonNode endpoint
    // below): `limit` is not clamped, so ?limit=100000 forces a huge upstream fetch, and returning
    // raw ESPN JsonNode leaks the provider schema and defeats this class's stated DTO contract.
    // EXAMPLE:
    //   int safe = Math.max(1, Math.min(limit, 100));   // clamp before calling upstream
    //   return service.teams(league, page, safe);        // ideally map to a Dto, not raw JsonNode
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

    @GetMapping("/worldcup/bracket")
    public List<Dto.BracketMatchDto> worldCupBracket() throws Exception {
        return service.worldCupBracket();
    }
}