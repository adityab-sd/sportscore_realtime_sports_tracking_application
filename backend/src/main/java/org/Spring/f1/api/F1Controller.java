package org.Spring.f1.api;

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

/**
 * REST reference data for Formula 1. No {league} path variable — F1 is a single
 * championship.
 *
 *   GET /api/f1/scoreboard[?year=]        -> current/nearest weekend(s) + session grids
 *   GET /api/f1/schedule[?year=]          -> full season calendar
 *   GET /api/f1/results/{eventId}[?year=] -> one weekend's sessions + grids
 *   GET /api/f1/standings[?year=]         -> driver + constructor standings
 *   GET /api/f1/news?limit=               -> latest F1 news
 *
 * The optional ?year= (added on the four season-scoped endpoints) selects a past
 * season; omitting it keeps the current-season behaviour. It maps straight onto the
 * F1Service.*(Integer year) overloads, which thread the year through ESPN's
 * /seasons/{year}/... resources.
 *
 * Live session leaders are pushed via Event Hub -> SignalR, not here.
 */
// ============================================================================
// PLEASE review — REST boundary validation and security defaults
// ----------------------------------------------------------------------------
// F1 endpoints accept unbounded page/limit and IDs, and @CrossOrigin("*") exposes
// every response to any origin. Invalid input currently reaches ESPN or generic
// Exception handling instead of producing clear 400/502 responses.
//
// EXAMPLE:
//   @Validated
//   @CrossOrigin(origins = "${app.cors.allowed-origins}")
//   @GetMapping("/drivers")
//   JsonNode drivers(@RequestParam(defaultValue = "1") @Min(1) int page,
//                    @RequestParam(defaultValue = "50") @Min(1) @Max(100) int limit) { ... }
//
// WHY: Public REST adapters should constrain input before making blocking upstream calls.
// ============================================================================
@RestController
@RequestMapping("/api/f1")
@CrossOrigin(origins = "*")
public class F1Controller {

    private final F1Service service;

    public F1Controller(F1Service service) {
        this.service = service;
    }

    // ── input validation ─────────────────────────────────────────────────────
    // The optional ?year= picks a past season. We only accept real F1 seasons
    // (1950 = the first F1 world championship, up to next year), so a nonsense
    // value like ?year=1800 or ?year=99999 is rejected with a 400 rather than
    // being sent on to ESPN. A missing year just means "current season" and is fine.
    private void validateYear(Integer year) {
        if (year == null) return;
        int next = java.time.LocalDate.now().getYear() + 1;
        if (year < 1950 || year > next) {
            throw new IllegalArgumentException("Invalid year: " + year);
        }
    }

    // page can't go below 1; limit is kept within 1..max, so a caller can't force
    // an oversized upstream request with something like ?limit=999999.
    private int clampPage(int page)            { return Math.max(1, page); }
    private int clampLimit(int limit, int max) { return Math.max(1, Math.min(limit, max)); }

    // Bad input (from validateYear) -> a clean 400 Bad Request instead of a 500.
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> handleBadInput(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
    }

    @GetMapping("/scoreboard")
    public List<F1Dto.RaceWeekend> scoreboard(
            @RequestParam(required = false) Integer year) throws Exception {
        validateYear(year);   // reject impossible seasons
        return service.scoreboard(year);
    }

    @GetMapping("/schedule")
    public List<F1Dto.ScheduleEntry> schedule(
            @RequestParam(required = false) Integer year) throws Exception {
        validateYear(year);   // reject impossible seasons
        return service.schedule(year);
    }

    @GetMapping("/results/{eventId}")
    public F1Dto.RaceWeekend results(
            @PathVariable String eventId,
            @RequestParam(required = false) Integer year) throws Exception {
        validateYear(year);   // reject impossible seasons
        return service.results(eventId, year);
    }

    @GetMapping("/standings")
    public F1Dto.Standings standings(
            @RequestParam(required = false) Integer year) throws Exception {
        validateYear(year);   // reject impossible seasons
        return service.standings(year);
    }

    @GetMapping("/news")
    public List<Dto.NewsItem> news(@RequestParam(defaultValue = "12") int limit) throws Exception {
        return service.news(limit);
    }

    @GetMapping("/athletes/{athleteId}/news")
    public JsonNode athleteNews(@PathVariable String athleteId,
                                @RequestParam(defaultValue = "12") int limit) throws Exception {
        return service.athleteNews(athleteId, limit);
    }

    // ── reference data (raw passthrough) ────────────────────────────────────

    @GetMapping("/teams")
    public JsonNode teams(@RequestParam(defaultValue = "1") int page,
                          @RequestParam(defaultValue = "50") int limit) throws Exception {
        return service.teams(clampPage(page), clampLimit(limit, 100));
    }

    @GetMapping("/drivers")
    public JsonNode drivers(@RequestParam(defaultValue = "1") int page,
                            @RequestParam(defaultValue = "50") int limit,
                            @RequestParam(defaultValue = "true") boolean active) throws Exception {
        return service.drivers(clampPage(page), clampLimit(limit, 100), active);
    }

    @GetMapping("/drivers/{driverId}")
    public JsonNode driverProfile(@PathVariable String driverId) throws Exception {
        return service.driverProfile(driverId);
    }

    @GetMapping("/circuits")
    public JsonNode circuits(@RequestParam(defaultValue = "1") int page,
                             @RequestParam(defaultValue = "50") int limit) throws Exception {
        return service.circuits(clampPage(page), clampLimit(limit, 100));
    }

    @GetMapping("/venues")
    public JsonNode venues(@RequestParam(defaultValue = "1") int page,
                           @RequestParam(defaultValue = "50") int limit) throws Exception {
        return service.venues(clampPage(page), clampLimit(limit, 100));
    }

    @GetMapping("/providers")
    public JsonNode providers() throws Exception {
        return service.providers();
    }

    @GetMapping("/calendar")
    public JsonNode calendar(@RequestParam(required = false) String dates) throws Exception {
        return service.calendar(dates);
    }

    @GetMapping("/seasons")
    public JsonNode seasons(@RequestParam(defaultValue = "1") int page,
                            @RequestParam(defaultValue = "25") int limit) throws Exception {
        return service.seasons(clampPage(page), clampLimit(limit, 100));
    }

    // ADDED — constructors (Ferrari, Red Bull, etc.) for a given season.
    @GetMapping("/seasons/{season}/manufacturers")
    public JsonNode manufacturers(@PathVariable String season,
                                  @RequestParam(defaultValue = "1") int page,
                                  @RequestParam(defaultValue = "50") int limit) throws Exception {
        return service.manufacturers(season, clampPage(page), clampLimit(limit, 100));
    }

    // ADDED — current season, mirroring every other sport's currentSeason().
    @GetMapping("/season")
    public JsonNode currentSeason() throws Exception {
        return service.currentSeason();
    }

    // ADDED — league-wide media (previously only per-athlete news existed).
    @GetMapping("/media")
    public JsonNode media() throws Exception {
        return service.media();
    }

    // ADDED — event/session-level passthrough (weekend = event, session = competition).

    @GetMapping("/events/{eventId}")
    public JsonNode eventDetail(@PathVariable String eventId) throws Exception {
        return service.eventDetail(eventId);
    }

    @GetMapping("/events/{eventId}/competitions/{competitionId}")
    public JsonNode competitionDetail(@PathVariable String eventId,
                                      @PathVariable String competitionId) throws Exception {
        return service.competitionDetail(eventId, competitionId);
    }

    @GetMapping("/events/{eventId}/competitions/{competitionId}/broadcasts")
    public JsonNode broadcasts(@PathVariable String eventId,
                               @PathVariable String competitionId) throws Exception {
        return service.broadcasts(eventId, competitionId);
    }

    @GetMapping("/events/{eventId}/competitions/{competitionId}/odds")
    public JsonNode competitionOdds(@PathVariable String eventId, @PathVariable String competitionId,
                                    @RequestParam(defaultValue = "1") int page,
                                    @RequestParam(defaultValue = "50") int limit) throws Exception {
        return service.competitionOdds(eventId, competitionId, clampPage(page), clampLimit(limit, 100));
    }

    @GetMapping("/events/{eventId}/competitions/{competitionId}/officials")
    public JsonNode officials(@PathVariable String eventId,
                              @PathVariable String competitionId) throws Exception {
        return service.officials(eventId, competitionId);
    }
}