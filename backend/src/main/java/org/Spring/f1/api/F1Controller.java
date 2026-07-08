package org.Spring.f1.api;

import org.Spring.api.Dto;

import java.util.List;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

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
}