package org.Spring.f1.api;

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
 * REST reference data for Formula 1. No {league} path variable — F1 is a single
 * championship.
 *
 *   GET /api/f1/scoreboard          -> current/nearest weekend(s) + session grids
 *   GET /api/f1/schedule            -> full season calendar
 *   GET /api/f1/results/{eventId}   -> one weekend's sessions + grids
 *   GET /api/f1/standings           -> driver + constructor standings
 *   GET /api/f1/news?limit=         -> latest F1 news
 *
 * Live session leaders are pushed via Event Hub -> SignalR, not here.
 */
@RestController
@RequestMapping("/api/f1")
@CrossOrigin(origins = "*")
public class F1Controller {

    private final F1Service service;

    public F1Controller(F1Service service) {
        this.service = service;
    }

    @GetMapping("/scoreboard")
    public List<F1Dto.RaceWeekend> scoreboard() throws Exception {
        return service.scoreboard();
    }

    @GetMapping("/schedule")
    public List<F1Dto.ScheduleEntry> schedule() throws Exception {
        return service.schedule();
    }

    @GetMapping("/results/{eventId}")
    public F1Dto.RaceWeekend results(@PathVariable String eventId) throws Exception {
        return service.results(eventId);
    }

    @GetMapping("/standings")
    public F1Dto.Standings standings() throws Exception {
        return service.standings();
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
        return service.teams(page, limit);
    }

    @GetMapping("/drivers")
    public JsonNode drivers(@RequestParam(defaultValue = "1") int page,
                            @RequestParam(defaultValue = "50") int limit,
                            @RequestParam(defaultValue = "true") boolean active) throws Exception {
        return service.drivers(page, limit, active);
    }

    @GetMapping("/drivers/{driverId}")
    public JsonNode driverProfile(@PathVariable String driverId) throws Exception {
        return service.driverProfile(driverId);
    }

    @GetMapping("/circuits")
    public JsonNode circuits(@RequestParam(defaultValue = "1") int page,
                             @RequestParam(defaultValue = "50") int limit) throws Exception {
        return service.circuits(page, limit);
    }

    @GetMapping("/venues")
    public JsonNode venues(@RequestParam(defaultValue = "1") int page,
                           @RequestParam(defaultValue = "50") int limit) throws Exception {
        return service.venues(page, limit);
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
        return service.seasons(page, limit);
    }
}